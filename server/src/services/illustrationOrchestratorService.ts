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
import { IPromptBuilder, MemoryPromptInput } from './interfaces/IPromptBuilder';
import { User } from '../models/User';
import { MemorySummaryService } from './memorySummarizers/memorySummaryService';
import { ContextSummarizationService } from './contextSummarizers/summarizationService';
import { s3Client } from '../utils/s3Client';
import logger from '../utils/logger';

const S3_BUCKET = process.env.S3_BUCKET_NAME || 'auto-bio-illustrations';
const S3_AVATAR_PREFIX = process.env.S3_AVATAR_PREFIX || 'avatars/';
const S3_SUBJECTS_PREFIX = process.env.S3_SUBJECTS_PREFIX || 'subjects/';
const S3_GENERATED_PREFIX = 'generated/';
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
      let referenceImageBase64: string | undefined;

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

      // Only fetch reference image for OpenAI (which requires it)
      if (isOpenAI) {
        referenceImageBase64 = await this.fetchReferenceImage(userId);
      }

      const imageInput: ImageGenerationInput = {
        prompt: finalPrompt,
        referenceImageBase64: referenceImageBase64,
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
      const key = `${S3_AVATAR_PREFIX}${userId}.png`;
      return await s3Client.getObjectAsBase64(S3_BUCKET, key);
    } catch (error) {
      logger.warn('Failed to fetch reference image', { userId, error: (error as Error).message });
      return undefined;
    }
  }

  private async fetchSubjectImage(userId: string): Promise<string | undefined> {
    try {
      const key = `${S3_SUBJECTS_PREFIX}${userId}.png`;
      return await s3Client.getObjectAsBase64(S3_BUCKET, key);
    } catch (error) {
      logger.warn('Failed to fetch subject image', { userId, error: (error as Error).message });
      return undefined;
    }
  }

  private async uploadImageToS3(userId: string, imageBase64: string, type: 'memory' | 'subject'): Promise<string> {
    const timestamp = Date.now();
    const uniqueId = uuidv4();
    const key = `${S3_GENERATED_PREFIX}${type}/${userId}/${timestamp}-${uniqueId}.png`;

    const imageBuffer = Buffer.from(imageBase64, 'base64');

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: imageBuffer,
      ContentType: 'image/png',
    });

    await s3Client.getClient().send(command);
    
    return `s3://${S3_BUCKET}/${key}`;
  }
}

