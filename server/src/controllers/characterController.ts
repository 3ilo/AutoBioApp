import { Request, Response, NextFunction } from 'express';
import { Character } from '../models/Character';
import { handleError } from '../utils/errorHandler';
import { s3Client } from '../utils/s3Client';
import logger from '../utils/logger';
import { ApiResponse } from '../../../shared/types/ApiResponse';
import { ICharacter, CreateCharacterInput, UpdateCharacterInput } from '../../../shared/types/Character';
import { getIllustrationService, getConfiguredProvider } from '../services/illustrationServiceFactory';
import { OpenAISubjectIllustrationOptions, SDXLSubjectIllustrationOptions } from '../services/interfaces/IIllustrationService';
import { IllustrationOrchestratorService } from '../services/illustrationOrchestratorService';

// Configuration constants
const MAX_REFERENCE_IMAGES = parseInt(process.env.MAX_CHARACTER_REFERENCE_IMAGES || '5', 10);

/**
 * Create a new character
 */
export const createCharacter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        status: 'fail',
        message: 'User not authenticated',
      });
    }

    const { firstName, lastName, age, gender, relationship, culturalBackground } = req.body;

    if (!firstName || !lastName || age === undefined) {
      return res.status(400).json({
        status: 'fail',
        message: 'First name, last name, and age are required',
      });
    }

    const character = new Character({
      userId: req.user._id,
      firstName,
      lastName,
      age,
      gender,
      relationship,
      culturalBackground,
    });

    await character.save();

    logger.info('Character created', { userId: req.user._id, characterId: character._id });

    const response: ApiResponse<{ character: ICharacter }> = {
      status: 'success',
      data: { character: character.toObject() as unknown as ICharacter },
      message: 'Character created successfully',
    };

    res.status(201).json(response);
  } catch (error) {
    handleError(error as Error, req, res, next);
  }
};

/**
 * Get all characters for the current user
 */
export const getCharacters = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        status: 'fail',
        message: 'User not authenticated',
      });
    }

    const characters = await Character.find({ userId: req.user._id }).sort({ firstName: 1, lastName: 1 });

    logger.debug('Characters retrieved', { userId: req.user._id, count: characters.length });

    const response: ApiResponse<{ characters: ICharacter[] }> = {
      status: 'success',
      data: { characters: characters.map(c => c.toObject() as unknown as ICharacter) },
    };

    res.status(200).json(response);
  } catch (error) {
    handleError(error as Error, req, res, next);
  }
};

/**
 * Get a single character by ID
 */
export const getCharacter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        status: 'fail',
        message: 'User not authenticated',
      });
    }

    const { id } = req.params;

    const character = await Character.findOne({ _id: id, userId: req.user._id });

    if (!character) {
      return res.status(404).json({
        status: 'fail',
        message: 'Character not found',
      });
    }

    const response: ApiResponse<{ character: ICharacter }> = {
      status: 'success',
      data: { character: character.toObject() as unknown as ICharacter },
    };

    res.status(200).json(response);
  } catch (error) {
    handleError(error as Error, req, res, next);
  }
};

/**
 * Update a character
 */
export const updateCharacter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        status: 'fail',
        message: 'User not authenticated',
      });
    }

    const { id } = req.params;
    const allowedUpdates: (keyof UpdateCharacterInput)[] = [
      'firstName',
      'lastName',
      'age',
      'gender',
      'relationship',
      'culturalBackground',
      'referenceImageS3Uri',
      'avatarS3Uri',
    ];

    const updates = Object.keys(req.body).filter(key => 
      allowedUpdates.includes(key as keyof UpdateCharacterInput)
    );

    if (updates.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'No valid updates provided',
      });
    }

    const character = await Character.findOne({ _id: id, userId: req.user._id });

    if (!character) {
      return res.status(404).json({
        status: 'fail',
        message: 'Character not found',
      });
    }

    updates.forEach(update => {
      (character as any)[update] = req.body[update];
    });

    await character.save();

    logger.info('Character updated', { userId: req.user._id, characterId: id, updatedFields: updates });

    const response: ApiResponse<{ character: ICharacter }> = {
      status: 'success',
      data: { character: character.toObject() as unknown as ICharacter },
      message: 'Character updated successfully',
    };

    res.status(200).json(response);
  } catch (error) {
    handleError(error as Error, req, res, next);
  }
};

/**
 * Delete a character
 */
export const deleteCharacter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        status: 'fail',
        message: 'User not authenticated',
      });
    }

    const { id } = req.params;

    const character = await Character.findOneAndDelete({ _id: id, userId: req.user._id });

    if (!character) {
      return res.status(404).json({
        status: 'fail',
        message: 'Character not found',
      });
    }

    logger.info('Character deleted', { userId: req.user._id, characterId: id });

    const response: ApiResponse<null> = {
      status: 'success',
      data: null,
      message: 'Character deleted successfully',
    };

    res.status(200).json(response);
  } catch (error) {
    handleError(error as Error, req, res, next);
  }
};

/**
 * Generate a presigned URL for uploading a character reference image
 * Supports optional index parameter for multiple reference images (0-4)
 */
export const generatePresignedReferenceUploadUrl = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        status: 'fail',
        message: 'User not authenticated',
      });
    }

    const { id } = req.params;
    const { contentType, index } = req.body;

    if (!contentType || !contentType.startsWith('image/')) {
      return res.status(400).json({
        status: 'fail',
        message: 'Valid image content type is required',
      });
    }

    // Validate index if provided
    if (index !== undefined) {
      const indexNum = parseInt(index, 10);
      if (isNaN(indexNum) || indexNum < 0 || indexNum >= MAX_REFERENCE_IMAGES) {
        return res.status(400).json({
          status: 'fail',
          message: `Index must be between 0 and ${MAX_REFERENCE_IMAGES - 1}`,
        });
      }
    }

    // Verify character belongs to user
    const character = await Character.findOne({ _id: id, userId: req.user._id });
    if (!character) {
      return res.status(404).json({
        status: 'fail',
        message: 'Character not found',
      });
    }

    const userId = req.user._id.toString();
    const indexNum = index !== undefined ? parseInt(index, 10) : undefined;
    const presignedUrl = await s3Client.generatePresignedCharacterReferenceUploadUrl(userId, id, contentType, indexNum);
    const key = s3Client.getCharacterReferenceKey(userId, id, indexNum);

    const response: ApiResponse<{ uploadUrl: string; key: string; index?: number }> = {
      status: 'success',
      data: { uploadUrl: presignedUrl, key, ...(indexNum !== undefined && { index: indexNum }) },
      message: 'Pre-signed upload URL generated successfully',
    };

    res.status(200).json(response);
  } catch (error) {
    handleError(error as Error, req, res, next);
  }
};

/**
 * Update character's reference image S3 URI after upload
 * Supports both single and multiple reference images
 */
export const updateReferenceImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        status: 'fail',
        message: 'User not authenticated',
      });
    }

    const { id } = req.params;
    const { index } = req.body;

    const character = await Character.findOne({ _id: id, userId: req.user._id });
    if (!character) {
      return res.status(404).json({
        status: 'fail',
        message: 'Character not found',
      });
    }

    const userId = req.user._id.toString();
    const bucket = s3Client.getBucketName();

    if (index !== undefined) {
      // Multi-image upload: update array of reference images
      const indexNum = parseInt(index, 10);
      const key = s3Client.getCharacterReferenceKey(userId, id, indexNum);
      const s3Uri = `s3://${bucket}/${key}`;

      // Initialize array if needed
      if (!character.referenceImagesS3Uris) {
        character.referenceImagesS3Uris = [];
      }

      // Ensure array is large enough
      while (character.referenceImagesS3Uris.length <= indexNum) {
        character.referenceImagesS3Uris.push('');
      }

      character.referenceImagesS3Uris[indexNum] = s3Uri;
      await character.save();

      logger.info('Character reference image added to array', { 
        userId, 
        characterId: id, 
        index: indexNum,
        s3Uri,
        totalReferences: character.referenceImagesS3Uris.filter(uri => uri).length,
      });
    } else {
      // Single image upload: legacy behavior
      const key = s3Client.getCharacterReferenceKey(userId, id);
      const s3Uri = `s3://${bucket}/${key}`;

      character.referenceImageS3Uri = s3Uri;
      await character.save();

      logger.info('Character reference image updated', { userId, characterId: id, s3Uri });
    }

    const response: ApiResponse<{ character: ICharacter }> = {
      status: 'success',
      data: { character: character.toObject() as unknown as ICharacter },
      message: 'Reference image updated successfully',
    };

    res.status(200).json(response);
  } catch (error) {
    handleError(error as Error, req, res, next);
  }
};

/**
 * Generate an avatar illustration for a character
 */
export const generateCharacterAvatar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        status: 'fail',
        message: 'User not authenticated',
      });
    }

    const { id } = req.params;
    const userId = req.user._id.toString();

    // Verify character belongs to user and has a reference image
    const character = await Character.findOne({ _id: id, userId: req.user._id });
    if (!character) {
      return res.status(404).json({
        status: 'fail',
        message: 'Character not found',
      });
    }

    if (!character.referenceImageS3Uri) {
      return res.status(400).json({
        status: 'fail',
        message: 'Character reference image not uploaded. Please upload a reference photo first.',
      });
    }

    const provider = getConfiguredProvider();
    const illustrationService = getIllustrationService();

    logger.info('Generating character avatar', { userId, characterId: id, provider });

    // Check if the service is the orchestrator (which has generateCharacterAvatar)
    if (!(illustrationService instanceof IllustrationOrchestratorService)) {
      return res.status(500).json({
        status: 'fail',
        message: 'Character avatar generation is not supported by the current illustration service',
      });
    }

    // Build options based on provider
    const options: OpenAISubjectIllustrationOptions | SDXLSubjectIllustrationOptions = provider === 'openai'
      ? { provider: 'openai' }
      : { provider: 'sdxl' };

    const avatarUrl = await illustrationService.generateCharacterAvatar(userId, id, options);

    // Refetch the character to get updated avatarS3Uri
    const updatedCharacter = await Character.findById(id);

    logger.info('Character avatar generated successfully', { userId, characterId: id, avatarUrl });

    const response: ApiResponse<{ url: string; character: ICharacter }> = {
      status: 'success',
      data: { 
        url: avatarUrl,
        character: (updatedCharacter?.toObject() || character.toObject()) as unknown as ICharacter,
      },
      message: 'Character avatar generated successfully',
    };

    res.status(200).json(response);
  } catch (error) {
    handleError(error as Error, req, res, next);
  }
};

/**
 * Generate a multi-angle avatar for a character from multiple reference images
 * Creates a 3-angle array and extracts the front-facing image as avatar
 */
export const generateMultiAngleAvatar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        status: 'fail',
        message: 'User not authenticated',
      });
    }

    const { id } = req.params;
    const userId = req.user._id.toString();

    // Verify character belongs to user and has reference images
    const character = await Character.findOne({ _id: id, userId: req.user._id });
    if (!character) {
      return res.status(404).json({
        status: 'fail',
        message: 'Character not found',
      });
    }

    // Check for reference images (either array or single)
    const hasMultipleReferences = character.referenceImagesS3Uris && character.referenceImagesS3Uris.some(uri => uri);
    const hasSingleReference = !!character.referenceImageS3Uri;

    if (!hasMultipleReferences && !hasSingleReference) {
      return res.status(400).json({
        status: 'fail',
        message: 'No reference images uploaded. Please upload at least one reference photo first.',
      });
    }

    const provider = getConfiguredProvider();
    const illustrationService = getIllustrationService();

    logger.info('Generating multi-angle avatar', { userId, characterId: id, provider });

    // Check if the service is the orchestrator (which has generateMultiAngleAvatar)
    if (!(illustrationService instanceof IllustrationOrchestratorService)) {
      return res.status(500).json({
        status: 'fail',
        message: 'Multi-angle avatar generation is not supported by the current illustration service',
      });
    }

    // Fetch reference images from S3
    const referenceImagesBase64: string[] = [];
    const bucket = s3Client.getBucketName();

    if (hasMultipleReferences && character.referenceImagesS3Uris) {
      for (let i = 0; i < character.referenceImagesS3Uris.length; i++) {
        const uri = character.referenceImagesS3Uris[i];
        if (uri && uri.startsWith('s3://')) {
          try {
            const key = s3Client.getCharacterReferenceKey(userId, id, i);
            const imageBase64 = await s3Client.getObjectAsBase64(bucket, key);
            referenceImagesBase64.push(imageBase64);
          } catch (error) {
            logger.warn('Failed to fetch reference image from array', { 
              userId, 
              characterId: id, 
              index: i,
              error: (error as Error).message 
            });
          }
        }
      }
    } else if (hasSingleReference) {
      // Fall back to single reference image
      try {
        const key = s3Client.getCharacterReferenceKey(userId, id);
        const imageBase64 = await s3Client.getObjectAsBase64(bucket, key);
        referenceImagesBase64.push(imageBase64);
      } catch (error) {
        logger.error('Failed to fetch single reference image', {
          userId,
          characterId: id,
          error: (error as Error).message,
        });
        return res.status(500).json({
          status: 'fail',
          message: 'Failed to fetch reference image from storage',
        });
      }
    }

    if (referenceImagesBase64.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Could not load any reference images from storage',
      });
    }

    logger.info('Loaded reference images for multi-angle generation', {
      userId,
      characterId: id,
      imageCount: referenceImagesBase64.length,
    });

    // Build options based on provider
    const options: OpenAISubjectIllustrationOptions | SDXLSubjectIllustrationOptions = provider === 'openai'
      ? { provider: 'openai' }
      : { provider: 'sdxl' };

    const result = await illustrationService.generateMultiAngleAvatar(userId, id, referenceImagesBase64, options);

    // Refetch the character to get updated URIs
    const updatedCharacter = await Character.findById(id);

    logger.info('Multi-angle avatar generated successfully', { 
      userId, 
      characterId: id, 
      multiAngleUrl: result.multiAngleUrl,
      avatarUrl: result.avatarUrl,
    });

    const response: ApiResponse<{ multiAngleUrl: string; avatarUrl: string; character: ICharacter }> = {
      status: 'success',
      data: {
        multiAngleUrl: result.multiAngleUrl,
        avatarUrl: result.avatarUrl,
        character: (updatedCharacter?.toObject() || character.toObject()) as unknown as ICharacter,
      },
      message: 'Multi-angle avatar generated successfully',
    };

    res.status(200).json(response);
  } catch (error) {
    handleError(error as Error, req, res, next);
  }
};
