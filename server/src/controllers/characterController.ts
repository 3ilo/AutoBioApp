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
      data: { character: character.toObject() },
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
      data: { characters: characters.map(c => c.toObject()) },
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
      data: { character: character.toObject() },
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
      data: { character: character.toObject() },
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
    const { contentType } = req.body;

    if (!contentType || !contentType.startsWith('image/')) {
      return res.status(400).json({
        status: 'fail',
        message: 'Valid image content type is required',
      });
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
    const presignedUrl = await s3Client.generatePresignedCharacterReferenceUploadUrl(userId, id, contentType);
    const key = s3Client.getCharacterReferenceKey(userId, id);

    const response: ApiResponse<{ uploadUrl: string; key: string }> = {
      status: 'success',
      data: { uploadUrl: presignedUrl, key },
      message: 'Pre-signed upload URL generated successfully',
    };

    res.status(200).json(response);
  } catch (error) {
    handleError(error as Error, req, res, next);
  }
};

/**
 * Update character's reference image S3 URI after upload
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

    const character = await Character.findOne({ _id: id, userId: req.user._id });
    if (!character) {
      return res.status(404).json({
        status: 'fail',
        message: 'Character not found',
      });
    }

    const userId = req.user._id.toString();
    const key = s3Client.getCharacterReferenceKey(userId, id);
    const s3Uri = `s3://${s3Client.getBucketName()}/${key}`;

    character.referenceImageS3Uri = s3Uri;
    await character.save();

    logger.info('Character reference image updated', { userId, characterId: id, s3Uri });

    const response: ApiResponse<{ character: ICharacter }> = {
      status: 'success',
      data: { character: character.toObject() },
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
        character: updatedCharacter?.toObject() || character.toObject(),
      },
      message: 'Character avatar generated successfully',
    };

    res.status(200).json(response);
  } catch (error) {
    handleError(error as Error, req, res, next);
  }
};
