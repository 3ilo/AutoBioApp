import { v4 as uuidv4 } from 'uuid';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { 
  IIllustrationService, 
  OpenAIMemoryIllustrationOptions,
  OpenAISubjectIllustrationOptions,
  SDXLMemoryIllustrationOptions,
  SDXLSubjectIllustrationOptions
} from './interfaces/IIllustrationService';
import { 
  IImageGenerator,
  ImageGenerationInput,
  OpenAIImageGenerationOptions,
  SDXLImageGenerationOptions
} from './interfaces/IImageGenerator';
import { IPromptBuilder, MemoryPromptInput, MultiSubjectGridPromptInput, MultiSubjectData } from './interfaces/IPromptBuilder';
import { User } from '../models/User';
import { Character, ICharacterDocument } from '../models/Character';
import { ICharacter } from '../../../shared/types/Character';
import { MemorySummaryService } from './memorySummarizers/memorySummaryService';
import { ContextSummarizationService } from './contextSummarizers/summarizationService';
import { s3Client } from '../utils/s3Client';
import logger from '../utils/logger';
import { stitchImages, buildGridLayoutDescription, extractCenterPanel } from '../utils/imageStitcher';

const DISABLE_RECENT_MEMORIES = process.env.DISABLE_RECENT_MEMORIES === 'true';

/**
 * Illustration Orchestrator Service
 * 
 * Orchestrates the full illustration generation pipeline:
 * 1. Memory summarization (distills memory to scene description)
 * 2. Recent memories aggregation (for subject context)
 * 3. Prompt building (structured prompts for OpenAI, enhanced prompts for SDXL)
 * 4. Image generation (via image generator services)
 * 5. S3 upload and URI return
 */
export class IllustrationOrchestratorService implements IIllustrationService {
  private imageGenerator: IImageGenerator;
  private memorySummaryService: MemorySummaryService;
  private contextSummarizationService: ContextSummarizationService;
  private promptBuilder: IPromptBuilder;

  constructor(
    imageGenerator: IImageGenerator,
    memorySummaryService: MemorySummaryService,
    contextSummarizationService: ContextSummarizationService,
    promptBuilder: IPromptBuilder
  ) {
    this.imageGenerator = imageGenerator;
    this.memorySummaryService = memorySummaryService;
    this.contextSummarizationService = contextSummarizationService;
    this.promptBuilder = promptBuilder;
  }

  async generateMemoryIllustration(
    userId: string,
    prompt: string,
    options?: OpenAIMemoryIllustrationOptions | SDXLMemoryIllustrationOptions
  ): Promise<string> {
    logger.info('Orchestrator: Generating memory illustration', { userId });

    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Determine provider from options discriminator
      const isOpenAI = options?.provider === 'openai';
      const isSDXL = options?.provider === 'sdxl' || !options?.provider; // Default to SDXL if no provider specified

      const memoryTitle = options?.memoryTitle || 'Memory Illustration';
      const rawMemoryContent = options?.memoryContent || prompt;
      const memoryDate = options?.memoryDate 
        ? (typeof options.memoryDate === 'string' 
            ? new Date(options.memoryDate) 
            : options.memoryDate)
        : new Date();

      let distilledMemoryContent: string;
      try {
        const currentMemory = {
          _id: 'current', // TODO: check on this
          title: memoryTitle,
          content: rawMemoryContent,
          date: memoryDate,
          author: userId,
          tags: [],
          isPublic: false,
        } as any; // TODO: check on type

        const memorySummary = await this.memorySummaryService.generateMemorySummary(
          currentMemory,
          user.toObject() as any, // TODO: check on type
          { summaryLength: 'brief', includeUserContext: true }
        );

        distilledMemoryContent = memorySummary;
        logger.info('Orchestrator: Memory distilled', { 
          distilledMemoryContent,
          userId,
          memoryTitle 
        });
      } catch (error) {
        logger.warn('Orchestrator: Failed to distill memory, using raw content', {
          userId,
          error: (error as Error).message
        });
        distilledMemoryContent = rawMemoryContent;
      }

      // Fetch recent memories summary unless disabled via DISABLE_RECENT_MEMORIES env flag
      let recentMemoriesSummary: string | undefined;
      if (!DISABLE_RECENT_MEMORIES) {
        recentMemoriesSummary = await this.contextSummarizationService.fetchAndSummarizeRecentMemories(
          userId,
          user.toObject() as any,
          distilledMemoryContent,
          memoryTitle,
          { limit: 5, summaryLength: 'paragraph' }
        );
        logger.info('Orchestrator: Recent memories summary', { recentMemoriesSummary });
      } else {
        logger.info('Orchestrator: Recent memories summarization disabled via DISABLE_RECENT_MEMORIES flag');
      }

      let finalPrompt: string;
      let referenceImagesBase64: string[] = [];

      const promptInput: MemoryPromptInput = {
        memory: {
          title: memoryTitle,
          content: distilledMemoryContent,
          date: memoryDate,
        },
        user: user.toObject() as any,
        recentMemoriesContext: recentMemoriesSummary,
      };

      // Use injected prompt builder
      // Note: OpenAI builder returns Promise<string>, SDXL/Stub builders return string
      // await works for both (returns value directly if not a promise)
      const promptResult = this.promptBuilder.buildMemoryPrompt(promptInput);
      finalPrompt = await promptResult;
      
      logger.info('Orchestrator: Prompt result', { 
        prompt: finalPrompt,
        promptLength: finalPrompt.length,
        userId,
        memoryTitle 
      });

      // Fetch reference images for OpenAI (which requires it)
      let finalReferenceImage: string | undefined;
      if (isOpenAI) {
        logger.info('Orchestrator: Starting reference image collection for OpenAI', {
          userId,
          memoryTitle,
        });

        // Always include the user's reference image first (for best fidelity)
        const userReferenceImage = await this.fetchReferenceImage(userId);
        if (userReferenceImage) {
          referenceImagesBase64.push(userReferenceImage);
          logger.info('Orchestrator: User reference image fetched successfully', {
            userId,
            userName: `${user.firstName} ${user.lastName}`,
            imageSize: userReferenceImage.length,
          });
        } else {
          logger.warn('Orchestrator: User reference image not found', { userId });
        }

        // Collect people names for grid layout description
        const peopleNames: string[] = [`${user.firstName} ${user.lastName}`];

        // Fetch tagged character reference images
        const taggedCharacterIds = options?.taggedCharacterIds || [];
        let characterData: Array<{ characterId: string; base64: string | undefined; character: any }> = [];
        
        logger.info('Orchestrator: Processing tagged characters', {
          taggedCharacterCount: taggedCharacterIds.length,
          characterIds: taggedCharacterIds,
        });
        
        if (taggedCharacterIds.length > 0) {
          characterData = await this.fetchCharacterReferenceImages(userId, taggedCharacterIds);
          
          logger.info('Orchestrator: Character data fetched', {
            requestedCount: taggedCharacterIds.length,
            fetchedCount: characterData.length,
          });
          
          // Collect character images and names
          for (const { base64, character, characterId } of characterData) {
            if (base64 && character) {
              referenceImagesBase64.push(base64);
              peopleNames.push(`${character.firstName} ${character.lastName}`);
              logger.info('Orchestrator: Character reference image added', {
                characterId,
                characterName: `${character.firstName} ${character.lastName}`,
                relationship: character.relationship,
                age: character.age,
                imageSize: base64.length,
              });
            } else {
              logger.warn('Orchestrator: Character reference image missing', {
                characterId,
                hasImage: !!base64,
                hasCharacter: !!character,
              });
            }
          }
        }

        logger.info('Orchestrator: Reference image collection complete', {
          totalImages: referenceImagesBase64.length,
          people: peopleNames,
          decision: referenceImagesBase64.length > 1 ? 'STITCH_INTO_GRID' : 'USE_SINGLE_IMAGE',
        });

        // If we have multiple reference images, stitch them into a grid
        if (referenceImagesBase64.length > 1) {
          logger.info('Orchestrator: === MULTI-PERSON SCENARIO DETECTED ===', {
            imageCount: referenceImagesBase64.length,
            people: peopleNames,
            action: 'Stitching images into grid',
          });

          const stitchResult = await stitchImages(referenceImagesBase64);
          finalReferenceImage = stitchResult.combinedImageBase64;

          logger.info('Orchestrator: Image stitching completed', {
            gridLayout: `${stitchResult.layout.columns}x${stitchResult.layout.rows}`,
            columns: stitchResult.layout.columns,
            rows: stitchResult.layout.rows,
            individualImageSize: `${stitchResult.layout.imageWidth}x${stitchResult.layout.imageHeight}`,
            combinedImageSize: stitchResult.combinedImageBase64.length,
          });

          // Build grid layout description for the prompt
          const gridDescription = buildGridLayoutDescription(stitchResult.layout, peopleNames);
          
          logger.info('Orchestrator: Grid description generated', {
            gridDescription,
          });
          
          // Append multi-subject prompt with grid layout information
          const multiSubjectPrompt = this.buildMultiSubjectPromptWithGrid(
            user.toObject() as any, // Investigate this
            characterData,
            memoryDate,
            gridDescription
          );
          
          logger.info('Orchestrator: Multi-subject prompt with grid built', {
            promptLength: multiSubjectPrompt.length,
            multiSubjectPrompt,
          });
          
          finalPrompt = `${finalPrompt}\n\n${multiSubjectPrompt}`;

          logger.info('Orchestrator: Final prompt assembled for multi-person', {
            totalPromptLength: finalPrompt.length,
            basePromptLength: finalPrompt.length - multiSubjectPrompt.length - 2,
            multiSubjectPromptLength: multiSubjectPrompt.length,
            layout: stitchResult.layout,
            characterCount: characterData.length,
          });
        } else if (referenceImagesBase64.length === 1) {
          // Single image - use as-is
          finalReferenceImage = referenceImagesBase64[0];
          logger.info('Orchestrator: Single-person scenario, using image as-is', {
            person: peopleNames[0],
            imageSize: finalReferenceImage.length,
          });
        } else {
          logger.warn('Orchestrator: No reference images available', {
            userId,
            proceedingWithoutImage: true,
          });
        }
      }

      const imageInput: ImageGenerationInput = {
        prompt: finalPrompt,
        referenceImageBase64: finalReferenceImage,
        userId: userId,
      };

      const imageOutput = await this.imageGenerator.generateImage(imageInput, options);

      const s3Uri = await this.uploadImageToS3(userId, imageOutput.imageBase64, 'memory');

      logger.info('Orchestrator: Memory illustration generated successfully', { userId, s3Uri });
      return s3Uri;

    } catch (error) {
      logger.error('Orchestrator: Failed to generate memory illustration', {
        userId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async generateSubjectIllustration(
    userId: string,
    options: OpenAISubjectIllustrationOptions | SDXLSubjectIllustrationOptions
  ): Promise<string> {
    logger.info('Orchestrator: Generating subject illustration', { userId });

    const isOpenAI = options?.provider === 'openai';

    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Use injected prompt builder
      const finalPrompt = this.promptBuilder.buildSubjectPrompt(user.toObject() as any);
      
      logger.info('Orchestrator: User subject illustration prompt generated', {
        userId,
        prompt: finalPrompt,
        promptLength: finalPrompt.length,
        userName: `${user.firstName} ${user.lastName}`,
      });
      
      // Only fetch reference image for OpenAI (which requires it)
      let referenceImageBase64: string | undefined;
      if (isOpenAI) {
        referenceImageBase64 = await this.fetchSubjectImage(userId);
      }

      const imageInput: ImageGenerationInput = {
        prompt: finalPrompt,
        referenceImageBase64: referenceImageBase64,
        userId: userId,
      };

      const imageOutput = await this.imageGenerator.generateImage(imageInput, options);
      const s3Uri = await this.uploadImageToS3(userId, imageOutput.imageBase64, 'subject');
      const presignedUrl = await s3Client.convertS3UriToPresignedUrl(s3Uri);

      logger.info('Orchestrator: Subject illustration generated successfully', { userId, s3Uri });
      return presignedUrl;

    } catch (error) {
      logger.error('Orchestrator: Failed to generate subject illustration', {
        userId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Generate a multi-angle avatar for a user from multiple reference images.
   * Generates 3 separate images (left profile, front, right profile), stitches them together,
   * and uses the front-facing image as the avatar.
   * 
   * @param userId - The user's ID
   * @param referenceImagesBase64 - Array of base64-encoded reference images (1-5 images)
   * @param options - Provider-specific generation options
   * @returns Object with presigned URLs for both the multi-angle array and extracted avatar, plus avatar S3 URI
   */
  async generateMultiAngleUserAvatar(
    userId: string,
    referenceImagesBase64: string[],
    options: OpenAISubjectIllustrationOptions | SDXLSubjectIllustrationOptions
  ): Promise<{ multiAngleUrl: string; avatarUrl: string; avatarS3Uri: string }> {
    logger.info('Orchestrator: Generating multi-angle user avatar (3 separate images)', { 
      userId,
      referenceImageCount: referenceImagesBase64.length 
    });

    const isOpenAI = options?.provider === 'openai';

    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      if (referenceImagesBase64.length === 0) {
        throw new Error('At least one reference image is required');
      }

      // Stitch reference images into a grid for input to the model
      let stitchedReferenceBase64: string | undefined;
      if (isOpenAI) {
        if (referenceImagesBase64.length > 1) {
          const stitchResult = await stitchImages(referenceImagesBase64);
          stitchedReferenceBase64 = stitchResult.combinedImageBase64;
          
          logger.info('Orchestrator: Reference images stitched for multi-angle generation', {
            inputImageCount: referenceImagesBase64.length,
            gridLayout: `${stitchResult.layout.columns}x${stitchResult.layout.rows}`,
          });
        } else {
          stitchedReferenceBase64 = referenceImagesBase64[0];
          logger.info('Orchestrator: Single reference image provided, using as-is');
        }

        if (!stitchedReferenceBase64) {
          throw new Error('Failed to prepare reference images for multi-angle generation');
        }
      }

      // Generate 3 separate images for each angle
      const angles: Array<'left' | 'front' | 'right'> = ['left', 'front', 'right'];
      const generatedImages: string[] = [];

      logger.info('============================================================');
      logger.info('MULTI-ANGLE USER GENERATION: Starting 3 separate image generation');
      logger.info('============================================================');

      for (let i = 0; i < angles.length; i++) {
        const angle = angles[i];
        
        logger.info('');
        logger.info(`>>> GENERATING IMAGE ${i + 1} OF 3: ${angle.toUpperCase()} PROFILE <<<`);
        logger.info('-----------------------------------------------------------');

        // Build angle-specific prompt
        const anglePrompt = this.promptBuilder.buildSubjectAnglePrompt(user.toObject() as any, angle);
        
        logger.info(`PROMPT FOR ${angle.toUpperCase()} ANGLE:`);
        logger.info('-----------------------------------------------------------');
        logger.info(anglePrompt);
        logger.info('-----------------------------------------------------------');
        logger.info(`Prompt length: ${anglePrompt.length} characters`);
        logger.info('');

        // Generate image for this angle
        const imageInput: ImageGenerationInput = {
          prompt: anglePrompt,
          referenceImageBase64: stitchedReferenceBase64,
          userId: userId,
        };

        logger.info(`Calling image generator for ${angle} angle...`);
        const imageOutput = await this.imageGenerator.generateImage(imageInput, options);
        generatedImages.push(imageOutput.imageBase64);

        logger.info(`✓ ${angle.toUpperCase()} profile image generated successfully (image ${i + 1}/3)`);
        logger.info(`  Generated image size: ${imageOutput.imageBase64.length} bytes (base64)`);
      }

      logger.info('');
      logger.info('============================================================');
      logger.info(`ALL 3 IMAGES GENERATED SUCCESSFULLY`);
      logger.info(`Total images in array: ${generatedImages.length}`);
      logger.info('============================================================');
      logger.info('');

      // Stitch the 3 generated images together into a horizontal array
      logger.info('>>> STITCHING PHASE <<<');
      logger.info('-----------------------------------------------------------');
      logger.info('Stitching 3 generated images into horizontal array...');
      logger.info(`Input: ${generatedImages.length} images`);
      logger.info(`Target size: 1024px`);

      const stitchResult = await stitchImages(generatedImages, 1024);
      const multiAngleBase64 = stitchResult.combinedImageBase64;
      
      logger.info('✓ 3-angle array stitched successfully!');
      logger.info(`  Grid layout: ${stitchResult.layout.columns}x${stitchResult.layout.rows}`);
      logger.info(`  Individual image size: ${stitchResult.layout.imageWidth}x${stitchResult.layout.imageHeight}px`);
      logger.info(`  Combined image size: ${multiAngleBase64.length} bytes (base64)`);
      logger.info('-----------------------------------------------------------');
      
      // Upload the full 3-angle array to S3
      const multiAngleS3Uri = await this.uploadUserMultiAngleToS3(userId, multiAngleBase64);
      
      logger.info('Orchestrator: 3-angle array uploaded to S3', {
        userId,
        multiAngleS3Uri,
      });
      
      // The center image (front-facing) is already generated separately
      const frontFacingBase64 = generatedImages[1]; // Index 1 is the 'front' angle
      
      logger.info('Orchestrator: Using front-facing image as avatar', {
        userId,
      });
      
      // Upload the front-facing image as avatar
      const avatarS3Uri = await this.uploadUserAvatarToS3(userId, frontFacingBase64);
      
      // Generate presigned URLs for both
      const multiAngleUrl = await s3Client.convertS3UriToPresignedUrl(multiAngleS3Uri);
      const avatarUrl = await s3Client.convertS3UriToPresignedUrl(avatarS3Uri);

      logger.info('Orchestrator: Multi-angle user avatar generation complete', { 
        userId,
        multiAngleS3Uri,
        avatarS3Uri,
      });
      
      return { multiAngleUrl, avatarUrl, avatarS3Uri };

    } catch (error) {
      logger.error('Orchestrator: Failed to generate multi-angle user avatar', {
        userId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Generate an avatar illustration for a character.
   * Uses the character's reference image to create a stylized portrait.
   * 
   * @param userId - The user's ID (owner of the character)
   * @param characterId - The character's ID
   * @param options - Provider-specific generation options
   * @returns Pre-signed URL of the generated avatar
   */
  async generateCharacterAvatar(
    userId: string,
    characterId: string,
    options: OpenAISubjectIllustrationOptions | SDXLSubjectIllustrationOptions
  ): Promise<string> {
    logger.info('Orchestrator: Generating character avatar', { userId, characterId });

    const isOpenAI = options?.provider === 'openai';

    try {
      const character = await Character.findOne({ _id: characterId, userId });
      if (!character) {
        throw new Error(`Character not found: ${characterId}`);
      }

      // Build a subject prompt for the character using the prompt builder
      // Convert character to a user-like object for the prompt builder
      const characterAsUser = {
        firstName: character.firstName,
        lastName: character.lastName,
        age: character.age,
        gender: character.gender,
        culturalBackground: character.culturalBackground,
        // These are optional and may not be present
        bio: character.relationship ? `Relationship: ${character.relationship}` : undefined,
        occupation: undefined,
        interests: [],
        location: undefined,
        preferredStyle: undefined,
        // Required fields for IUser (not used in prompt building)
        email: '',
        role: 'user' as const,
      };
      
      const finalPrompt = this.promptBuilder.buildSubjectPrompt(characterAsUser as any);
      
      logger.info('Orchestrator: Character avatar prompt generated', {
        userId,
        characterId,
        prompt: finalPrompt,
        promptLength: finalPrompt.length,
        characterName: `${character.firstName} ${character.lastName}`,
      });
      
      // Only fetch reference image for OpenAI (which requires it)
      let referenceImageBase64: string | undefined;
      if (isOpenAI) {
        referenceImageBase64 = await this.fetchCharacterReferenceImage(userId, characterId);
        if (!referenceImageBase64) {
          throw new Error('Character reference image not found. Please upload a reference photo first.');
        }
      }

      const imageInput: ImageGenerationInput = {
        prompt: finalPrompt,
        referenceImageBase64: referenceImageBase64,
        userId: userId,
      };

      const imageOutput = await this.imageGenerator.generateImage(imageInput, options);
      const s3Uri = await this.uploadCharacterAvatarToS3(userId, characterId, imageOutput.imageBase64);
      
      // Update the character with the new avatar S3 URI
      character.avatarS3Uri = s3Uri;
      await character.save();
      
      const presignedUrl = await s3Client.convertS3UriToPresignedUrl(s3Uri);

      logger.info('Orchestrator: Character avatar generated successfully', { userId, characterId, s3Uri });
      return presignedUrl;

    } catch (error) {
      logger.error('Orchestrator: Failed to generate character avatar', {
        userId,
        characterId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Generate a multi-angle avatar for a character from multiple reference images.
   * Generates 3 separate images (left profile, front, right profile), stitches them together,
   * and uses the front-facing image as the avatar.
   * 
   * @param userId - The user's ID (owner of the character)
   * @param characterId - The character's ID
   * @param referenceImagesBase64 - Array of base64-encoded reference images (1-5 images)
   * @param options - Provider-specific generation options
   * @returns Object with presigned URLs for both the multi-angle array and extracted avatar
   */
  async generateMultiAngleAvatar(
    userId: string,
    characterId: string,
    referenceImagesBase64: string[],
    options: OpenAISubjectIllustrationOptions | SDXLSubjectIllustrationOptions
  ): Promise<{ multiAngleUrl: string; avatarUrl: string }> {
    logger.info('Orchestrator: Generating multi-angle avatar (3 separate images)', { 
      userId, 
      characterId,
      referenceImageCount: referenceImagesBase64.length 
    });

    const isOpenAI = options?.provider === 'openai';

    try {
      const character = await Character.findOne({ _id: characterId, userId });
      if (!character) {
        throw new Error(`Character not found: ${characterId}`);
      }

      if (referenceImagesBase64.length === 0) {
        throw new Error('At least one reference image is required');
      }

      // Convert character to a user-like object for the prompt builder
      const characterAsUser = {
        firstName: character.firstName,
        lastName: character.lastName,
        age: character.age,
        gender: character.gender,
        culturalBackground: character.culturalBackground,
        bio: character.relationship ? `Relationship: ${character.relationship}` : undefined,
        occupation: undefined,
        interests: [],
        location: undefined,
        preferredStyle: undefined,
        email: '',
        role: 'user' as const,
      };
      
      // Stitch reference images into a grid for input to the model
      let stitchedReferenceBase64: string | undefined;
      if (isOpenAI) {
        if (referenceImagesBase64.length > 1) {
          const stitchResult = await stitchImages(referenceImagesBase64);
          stitchedReferenceBase64 = stitchResult.combinedImageBase64;
          
          logger.info('Orchestrator: Reference images stitched for multi-angle generation', {
            inputImageCount: referenceImagesBase64.length,
            gridLayout: `${stitchResult.layout.columns}x${stitchResult.layout.rows}`,
          });
        } else {
          stitchedReferenceBase64 = referenceImagesBase64[0];
          logger.info('Orchestrator: Single reference image provided, using as-is');
        }

        if (!stitchedReferenceBase64) {
          throw new Error('Failed to prepare reference images for multi-angle generation');
        }
      }

      // Generate 3 separate images for each angle
      const angles: Array<'left' | 'front' | 'right'> = ['left', 'front', 'right'];
      const generatedImages: string[] = [];

      logger.info('============================================================');
      logger.info('MULTI-ANGLE GENERATION: Starting 3 separate image generation');
      logger.info('============================================================');

      for (let i = 0; i < angles.length; i++) {
        const angle = angles[i];
        
        logger.info('');
        logger.info(`>>> GENERATING IMAGE ${i + 1} OF 3: ${angle.toUpperCase()} PROFILE <<<`);
        logger.info('-----------------------------------------------------------');

        // Build angle-specific prompt
        const anglePrompt = this.promptBuilder.buildSubjectAnglePrompt(characterAsUser as any, angle);
        
        logger.info(`PROMPT FOR ${angle.toUpperCase()} ANGLE:`);
        logger.info('-----------------------------------------------------------');
        logger.info(anglePrompt);
        logger.info('-----------------------------------------------------------');
        logger.info(`Prompt length: ${anglePrompt.length} characters`);
        logger.info('');

        // Generate image for this angle
        const imageInput: ImageGenerationInput = {
          prompt: anglePrompt,
          referenceImageBase64: stitchedReferenceBase64,
          userId: userId,
        };

        logger.info(`Calling image generator for ${angle} angle...`);
        const imageOutput = await this.imageGenerator.generateImage(imageInput, options);
        generatedImages.push(imageOutput.imageBase64);

        logger.info(`✓ ${angle.toUpperCase()} profile image generated successfully (image ${i + 1}/3)`);
        logger.info(`  Generated image size: ${imageOutput.imageBase64.length} bytes (base64)`);
      }

      logger.info('');
      logger.info('============================================================');
      logger.info(`ALL 3 IMAGES GENERATED SUCCESSFULLY`);
      logger.info(`Total images in array: ${generatedImages.length}`);
      logger.info('============================================================');
      logger.info('');

      // Stitch the 3 generated images together into a horizontal array
      logger.info('>>> STITCHING PHASE <<<');
      logger.info('-----------------------------------------------------------');
      logger.info('Stitching 3 generated images into horizontal array...');
      logger.info(`Input: ${generatedImages.length} images`);
      logger.info(`Target size: 1024px`);

      const stitchResult = await stitchImages(generatedImages, 1024);
      const multiAngleBase64 = stitchResult.combinedImageBase64;
      
      logger.info('✓ 3-angle array stitched successfully!');
      logger.info(`  Grid layout: ${stitchResult.layout.columns}x${stitchResult.layout.rows}`);
      logger.info(`  Individual image size: ${stitchResult.layout.imageWidth}x${stitchResult.layout.imageHeight}px`);
      logger.info(`  Combined image size: ${multiAngleBase64.length} bytes (base64)`);
      logger.info('-----------------------------------------------------------');
      
      // Upload the full 3-angle array to S3
      const multiAngleS3Uri = await this.uploadCharacterMultiAngleToS3(userId, characterId, multiAngleBase64);
      
      logger.info('Orchestrator: 3-angle array uploaded to S3', {
        userId,
        characterId,
        multiAngleS3Uri,
      });
      
      // The center image (front-facing) is already generated separately
      const frontFacingBase64 = generatedImages[1]; // Index 1 is the 'front' angle
      
      logger.info('Orchestrator: Using front-facing image as avatar', {
        userId,
        characterId,
      });
      
      // Upload the front-facing image as avatar
      const avatarS3Uri = await this.uploadCharacterAvatarToS3(userId, characterId, frontFacingBase64);
      
      // Update the character with both URIs
      character.multiAngleReferenceS3Uri = multiAngleS3Uri;
      character.avatarS3Uri = avatarS3Uri;
      await character.save();
      
      // Generate presigned URLs for both
      const multiAngleUrl = await s3Client.convertS3UriToPresignedUrl(multiAngleS3Uri);
      const avatarUrl = await s3Client.convertS3UriToPresignedUrl(avatarS3Uri);

      logger.info('Orchestrator: Multi-angle avatar generation complete', { 
        userId, 
        characterId, 
        multiAngleS3Uri,
        avatarS3Uri,
      });
      
      return { multiAngleUrl, avatarUrl };

    } catch (error) {
      logger.error('Orchestrator: Failed to generate multi-angle avatar', {
        userId,
        characterId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      return await this.imageGenerator.checkHealth();
    } catch (error) {
      logger.warn('Orchestrator health check failed', { error: (error as Error).message });
      return false;
    }
  }

  private async fetchReferenceImage(userId: string): Promise<string | undefined> {
    try {
      const bucket = s3Client.getBucketName();
      const key = s3Client.getAvatarKey(userId);
      return await s3Client.getObjectAsBase64(bucket, key);
    } catch (error) {
      logger.warn('Failed to fetch reference image', { userId, error: (error as Error).message });
      return undefined;
    }
  }

  private async fetchSubjectImage(userId: string): Promise<string | undefined> {
    try {
      const bucket = s3Client.getBucketName();
      const key = s3Client.getSubjectKey(userId);
      return await s3Client.getObjectAsBase64(bucket, key);
    } catch (error) {
      logger.warn('Failed to fetch subject image', { 
        userId, 
        key: s3Client.getSubjectKey(userId),
        error: (error as Error).message 
      });
      return undefined;
    }
  }

  private async fetchCharacterReferenceImage(userId: string, characterId: string): Promise<string | undefined> {
    const bucket = s3Client.getBucketName();
    
    // First, try to fetch the multi-angle reference if available (preferred for better fidelity)
    try {
      const multiAngleKey = s3Client.getCharacterMultiAngleKey(userId, characterId);
      const multiAngleImage = await s3Client.getObjectAsBase64(bucket, multiAngleKey);
      
      logger.info('Fetched multi-angle reference for character', {
        userId,
        characterId,
        key: multiAngleKey,
      });
      
      return multiAngleImage;
    } catch (multiAngleError) {
      logger.debug('Multi-angle reference not found, falling back to single reference', {
        userId,
        characterId,
      });
    }
    
    // Fall back to single reference image
    try {
      const key = s3Client.getCharacterReferenceKey(userId, characterId);
      return await s3Client.getObjectAsBase64(bucket, key);
    } catch (error) {
      logger.warn('Failed to fetch character reference image', { 
        userId, 
        characterId,
        key: s3Client.getCharacterReferenceKey(userId, characterId),
        error: (error as Error).message 
      });
      return undefined;
    }
  }

  /**
   * Fetch multiple character reference images along with their character data
   */
  private async fetchCharacterReferenceImages(
    userId: string,
    characterIds: string[]
  ): Promise<{ characterId: string; base64: string | undefined; character: ICharacterDocument }[]> {
    const results: { characterId: string; base64: string | undefined; character: ICharacterDocument }[] = [];

    for (const characterId of characterIds) {
      try {
        const character = await Character.findOne({ _id: characterId, userId });
        if (!character) {
          logger.warn('Character not found for reference image fetch', { userId, characterId });
          continue;
        }

        const base64 = await this.fetchCharacterReferenceImage(userId, characterId);
        results.push({ characterId, base64, character });
      } catch (error) {
        logger.warn('Failed to fetch character for reference image', {
          userId,
          characterId,
          error: (error as Error).message,
        });
      }
    }

    return results;
  }

  /**
   * Build a multi-subject prompt describing all people in the scene
   * Includes age-aware de-aging instructions when memory date is in the past
   * (Legacy method - kept for backward compatibility)
   */
  private buildMultiSubjectPrompt(
    user: any,
    characterData: { characterId: string; base64: string | undefined; character: ICharacterDocument }[],
    memoryDate: Date
  ): string {
    const parts: string[] = [];
    
    parts.push('[MULTIPLE SUBJECTS]');
    parts.push('The scene contains multiple people from reference images:');
    
    // User is always reference image 1
    let imagePosition = 1;
    const userAgeAtMemory = this.calculateAgeAtDate(user.age, memoryDate);
    const userDeAgingInstruction = this.getDeAgingInstruction(user.age, userAgeAtMemory);
    
    parts.push(`- Reference image ${imagePosition}: ${user.firstName} ${user.lastName} (the primary subject)${userDeAgingInstruction ? ` - ${userDeAgingInstruction}` : ''}`);
    
    // Add each tagged character
    for (const { character } of characterData) {
      if (character) {
        imagePosition++;
        const charAgeAtMemory = this.calculateAgeAtDate(character.age, memoryDate);
        const charDeAgingInstruction = this.getDeAgingInstruction(character.age, charAgeAtMemory);
        
        parts.push(`- Reference image ${imagePosition}: ${character.firstName} ${character.lastName}${character.relationship ? ` (${character.relationship})` : ''}${charDeAgingInstruction ? ` - ${charDeAgingInstruction}` : ''}`);
      }
    }
    
    parts.push('');
    parts.push('Use each reference image to accurately preserve the identity and facial features of the corresponding person. Ensure all subjects are clearly visible in the scene.');
    
    return parts.join('\n');
  }

  /**
   * Build a multi-subject prompt with grid layout information
   * Includes age-aware de-aging instructions when memory date is in the past
   * Uses the prompt builder with template-based prompt generation
   */
  private buildMultiSubjectPromptWithGrid(
    user: any,
    characterData: { characterId: string; base64: string | undefined; character: ICharacterDocument }[],
    memoryDate: Date,
    gridDescription: string
  ): string {
    logger.info('Orchestrator: Building multi-subject prompt with grid layout', {
      userAge: user.age,
      memoryDate: memoryDate.toISOString(),
      characterCount: characterData.length,
    });

    const subjects: MultiSubjectData[] = [];
    
    // User details with age-aware de-aging
    const userAgeAtMemory = this.calculateAgeAtDate(user.age, memoryDate);
    const userDeAgingInstruction = this.getDeAgingInstruction(user.age, userAgeAtMemory);
    
    logger.info('Orchestrator: User age calculation', {
      userName: `${user.firstName} ${user.lastName}`,
      currentAge: user.age,
      ageAtMemory: userAgeAtMemory,
      ageDifference: user.age - userAgeAtMemory,
      deAgingApplied: !!userDeAgingInstruction,
      deAgingInstruction: userDeAgingInstruction,
    });
    
    // Add user as primary subject
    subjects.push({
      name: `${user.firstName} ${user.lastName}`,
      isPrimary: true,
      deAgingInstruction: userDeAgingInstruction || undefined,
    });
    
    // Add each tagged character with their details
    for (const { character, characterId } of characterData) {
      if (character) {
        const charAgeAtMemory = this.calculateAgeAtDate(character.age, memoryDate);
        const charDeAgingInstruction = this.getDeAgingInstruction(character.age, charAgeAtMemory);
        
        logger.info('Orchestrator: Character age calculation', {
          characterId,
          characterName: `${character.firstName} ${character.lastName}`,
          relationship: character.relationship,
          currentAge: character.age,
          ageAtMemory: charAgeAtMemory,
          ageDifference: character.age - charAgeAtMemory,
          deAgingApplied: !!charDeAgingInstruction,
          deAgingInstruction: charDeAgingInstruction,
        });
        
        subjects.push({
          name: `${character.firstName} ${character.lastName}`,
          relationship: character.relationship,
          deAgingInstruction: charDeAgingInstruction || undefined,
        });
      }
    }
    
    // Build prompt using the prompt builder with template
    const promptInput: MultiSubjectGridPromptInput = {
      gridDescription,
      subjects,
    };
    
    const finalPrompt = this.promptBuilder.buildMultiSubjectGridPrompt(promptInput);
    
    logger.info('Orchestrator: Multi-subject prompt assembly complete', {
      promptLength: finalPrompt.length,
      subjectsIncluded: subjects.length,
    });
    
    return finalPrompt;
  }

  /**
   * Calculate age at a specific date based on current age
   */
  private calculateAgeAtDate(currentAge: number, memoryDate: Date): number {
    const now = new Date();
    const yearsAgo = (now.getTime() - memoryDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return Math.max(0, Math.round(currentAge - yearsAgo));
  }

  /**
   * Generate de-aging instruction if the memory is from the past
   */
  private getDeAgingInstruction(currentAge: number, ageAtMemory: number): string | null {
    const ageDifference = currentAge - ageAtMemory;
    
    // Only provide de-aging instruction if more than 5 years difference
    if (ageDifference > 5) {
      return `depict as approximately ${ageAtMemory} years old (${ageDifference} years younger than current)`;
    }
    
    return null;
  }

  private async uploadImageToS3(userId: string, imageBase64: string, type: 'memory' | 'subject'): Promise<string> {
    const timestamp = Date.now();
    const uniqueId = uuidv4();
    const bucket = s3Client.getBucketName();
    const generatedPrefix = s3Client.getGeneratedPrefix();
    const key = `${generatedPrefix}${type}/${userId}/${timestamp}-${uniqueId}.png`;

    const imageBuffer = Buffer.from(imageBase64, 'base64');

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: imageBuffer,
      ContentType: 'image/png',
    });

    await s3Client.getClient().send(command);
    
    return `s3://${bucket}/${key}`;
  }

  private async uploadCharacterAvatarToS3(userId: string, characterId: string, imageBase64: string): Promise<string> {
    const bucket = s3Client.getBucketName();
    const key = s3Client.getCharacterAvatarKey(userId, characterId);

    const imageBuffer = Buffer.from(imageBase64, 'base64');

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: imageBuffer,
      ContentType: 'image/png',
    });

    await s3Client.getClient().send(command);
    
    return `s3://${bucket}/${key}`;
  }

  private async uploadCharacterMultiAngleToS3(userId: string, characterId: string, imageBase64: string): Promise<string> {
    const bucket = s3Client.getBucketName();
    const key = s3Client.getCharacterMultiAngleKey(userId, characterId);

    const imageBuffer = Buffer.from(imageBase64, 'base64');

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: imageBuffer,
      ContentType: 'image/png',
    });

    await s3Client.getClient().send(command);
    
    logger.info('Uploaded character multi-angle reference to S3', {
      userId,
      characterId,
      key,
      s3Uri: `s3://${bucket}/${key}`,
    });
    
    return `s3://${bucket}/${key}`;
  }

  private async uploadUserMultiAngleToS3(userId: string, imageBase64: string): Promise<string> {
    const bucket = s3Client.getBucketName();
    const key = s3Client.getUserMultiAngleKey(userId);

    const imageBuffer = Buffer.from(imageBase64, 'base64');

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: imageBuffer,
      ContentType: 'image/png',
    });

    await s3Client.getClient().send(command);
    
    logger.info('Uploaded user multi-angle reference to S3', {
      userId,
      key,
      s3Uri: `s3://${bucket}/${key}`,
    });
    
    return `s3://${bucket}/${key}`;
  }

  private async uploadUserAvatarToS3(userId: string, imageBase64: string): Promise<string> {
    const bucket = s3Client.getBucketName();
    const key = s3Client.getAvatarKey(userId);

    const imageBuffer = Buffer.from(imageBase64, 'base64');

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: imageBuffer,
      ContentType: 'image/png',
    });

    await s3Client.getClient().send(command);
    
    logger.info('Uploaded user avatar to S3', {
      userId,
      key,
      s3Uri: `s3://${bucket}/${key}`,
    });
    
    return `s3://${bucket}/${key}`;
  }
}

