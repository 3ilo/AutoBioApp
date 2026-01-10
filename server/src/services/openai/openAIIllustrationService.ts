import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import FormData from 'form-data';
import { 
  IIllustrationService, 
  BaseMemoryIllustrationOptions,
  BaseSubjectIllustrationOptions,
  OpenAIMemoryIllustrationOptions,
  OpenAISubjectIllustrationOptions
} from '../interfaces/IIllustrationService';
import { promptBuilder, PromptInput } from './promptBuilder';
import { User } from '../../models/User';
import { Memory } from '../../models/Memory';
import logger from '../../utils/logger';
import { getAwsClientConfig } from '../../utils/env';
import { bedrockMemorySummaryService } from '../memorySummaryService';
import { bedrockSummarizationService } from '../summarizationService';

// Environment configuration (used as defaults)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DEFAULT_OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1.5';
const DEFAULT_OPENAI_IMAGE_SIZE = process.env.OPENAI_IMAGE_SIZE || '1024x1024';
const DEFAULT_OPENAI_IMAGE_QUALITY = (process.env.OPENAI_IMAGE_QUALITY || 'low') as 'low' | 'high';
const S3_BUCKET = process.env.S3_BUCKET_NAME || 'auto-bio-illustrations';
const S3_CLIENT_REGION = process.env.S3_CLIENT_REGION || 'us-west-2';
const S3_AVATAR_PREFIX = process.env.S3_AVATAR_PREFIX || 'avatars/';
const S3_SUBJECTS_PREFIX = process.env.S3_SUBJECTS_PREFIX || 'subjects/';
const S3_GENERATED_PREFIX = 'generated/openai/';

interface OpenAIImageResponse {
  created: number;
  data: Array<{
    b64_json?: string;
    url?: string;
    revised_prompt?: string;
  }>;
}

/**
 * OpenAI gpt-image-1.5 implementation of the illustration service.
 * Uses structured prompts and reference images for subject fidelity.
 */
export class OpenAIIllustrationService implements IIllustrationService {
  private s3Client: S3Client;

  constructor() {
    this.s3Client = new S3Client(getAwsClientConfig(S3_CLIENT_REGION));
    
    if (!OPENAI_API_KEY) {
      logger.warn('OPENAI_API_KEY not configured - OpenAI illustration service will fail on requests');
    }
  }

  /**
   * Generate a memory illustration using OpenAI gpt-image-1.5
   */
  async generateMemoryIllustration(
    userId: string,
    prompt: string,
    options: BaseMemoryIllustrationOptions = {}
  ): Promise<string> {
    const openAIOptions = options as OpenAIMemoryIllustrationOptions;
    const model = openAIOptions.model || DEFAULT_OPENAI_IMAGE_MODEL;
    const size = openAIOptions.size || DEFAULT_OPENAI_IMAGE_SIZE;
    const quality = openAIOptions.quality || DEFAULT_OPENAI_IMAGE_QUALITY;
    
    logger.info('Generating memory illustration with OpenAI', { userId, model, size, quality });

    try {
      // Fetch user data for prompt building
      const user = await User.findById(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Fetch reference image from S3 (user's avatar)
      const referenceImageBase64 = await this.fetchReferenceImage(userId);
      
      // Use memory metadata from options if available, otherwise fall back to prompt
      // OpenAI path should receive raw memory data, not pre-enhanced prompts
      const memoryTitle = openAIOptions.memoryTitle || 'Memory Illustration';
      const rawMemoryContent = openAIOptions.memoryContent || prompt; // Fallback to prompt if not provided
      const memoryDate = openAIOptions.memoryDate 
        ? (typeof openAIOptions.memoryDate === 'string' 
            ? new Date(openAIOptions.memoryDate) 
            : openAIOptions.memoryDate)
        : new Date();
      
      // Distill the current memory down to a single scene description
      // This summary will be used as the memory content in the prompt builder
      let distilledMemoryContent: string;
      try {
        // Create a memory-like object for summarization
        const currentMemory = {
          _id: 'current',
          title: memoryTitle,
          content: rawMemoryContent,
          date: memoryDate,
          author: userId,
          tags: [],
          isPublic: false,
        } as any;
        
        // Generate a detailed summary that distills the memory to a single scene
        const memorySummary = await bedrockMemorySummaryService.generateMemorySummary(
          currentMemory,
          user.toObject() as any,
          { summaryLength: 'brief', includeUserContext: true }
        );

        logger.info('Memory summary', { memorySummary });
        
        distilledMemoryContent = memorySummary;
        logger.info('Memory distilled to scene', { 
          userId, 
          originalLength: rawMemoryContent.length,
          distilledLength: distilledMemoryContent.length 
        });
      } catch (error) {
        logger.warn('Failed to distill memory, using raw content', {
          userId,
          error: (error as Error).message
        });
        // Fallback to raw content if summarization fails
        distilledMemoryContent = rawMemoryContent;
      }
      
      // Fetch recent memories for context (OpenAI handles its own prompt composition)
      let recentMemoriesSummary: string | undefined;
      try {
        const recentMemories = await Memory.find({ author: userId })
          .sort({ date: -1 })
          .limit(5)
          .lean();

        // Generate missing summaries on-demand
        const memoriesWithSummaries = await Promise.all(
          recentMemories.map(async (memory) => {
            if (!memory.summary) {
              logger.info('Generating memory summary', { memoryId: memory._id });
              try {
                const summary = await bedrockMemorySummaryService.generateMemorySummary(
                  memory,
                  user.toObject() as any,
                  { summaryLength: 'brief', includeUserContext: true }
                );
                
                // Update memory with generated summary
                await Memory.findByIdAndUpdate(memory._id, { summary });
                return { ...memory, summary };
              } catch (error) {
                logger.error('Failed to generate memory summary', { 
                  memoryId: memory._id, 
                  error: (error as Error).message 
                });
                return { 
                  ...memory, 
                  summary: `Memory about ${memory.title} from ${new Date(memory.date).toLocaleDateString()}` 
                };
              }
            }
            return memory;
          })
        );

        // Generate summary of recent memories for context
        if (memoriesWithSummaries.length > 0) {
          recentMemoriesSummary = await bedrockSummarizationService.summarizeMemories(
            memoriesWithSummaries,
            user.toObject() as any,
            { maxMemories: 5, summaryLength: 'paragraph' },
            distilledMemoryContent,
            memoryTitle
          );
        }
      } catch (error) {
        logger.warn('Failed to fetch recent memories for OpenAI prompt context', {
          userId,
          error: (error as Error).message
        });
        // Continue without recent memories summary
      }

      logger.info('Recent memories summary', { recentMemoriesSummary });
      
      // Build structured prompt with distilled memory content
      // The memory content is now a single scene description, not raw memory text
      const promptInput: PromptInput = {
        memory: {
          title: memoryTitle,
          content: distilledMemoryContent, // Use distilled scene description
          date: memoryDate,
        },
        user: user.toObject() as any,
        memorySummary: recentMemoriesSummary, // Context from recent memories
      };

      // Build structured prompt
      const structuredPrompt = await promptBuilder.buildStructuredPrompt(promptInput);
      const formattedPrompt = promptBuilder.formatPromptForAPI(structuredPrompt);

      logger.info('Formatted prompt', { formattedPrompt });

      logger.debug('Built structured prompt for OpenAI', { 
        userId, 
        promptLength: formattedPrompt.length 
      });

      // Generate image using OpenAI API
      const imageBase64 = await this.callOpenAIImageAPI(
        formattedPrompt, 
        referenceImageBase64,
        model,
        size,
        quality
      );

      // Upload to S3
      const s3Uri = await this.uploadImageToS3(userId, imageBase64, 'memory');

      logger.info('Memory illustration generated successfully with OpenAI', { userId, s3Uri });
      return s3Uri;

    } catch (error) {
      logger.error('Failed to generate memory illustration with OpenAI', {
        userId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Generate a subject illustration (avatar) using OpenAI gpt-image-1.5
   */
  async generateSubjectIllustration(
    userId: string,
    options: BaseSubjectIllustrationOptions = {}
  ): Promise<string> {
    const openAIOptions = options as OpenAISubjectIllustrationOptions;
    const model = openAIOptions.model || DEFAULT_OPENAI_IMAGE_MODEL;
    const size = openAIOptions.size || DEFAULT_OPENAI_IMAGE_SIZE;
    const quality = openAIOptions.quality || DEFAULT_OPENAI_IMAGE_QUALITY;
    
    logger.info('Generating subject illustration with OpenAI', { userId, model, size, quality });

    try {
      // Fetch user data
      const user = await User.findById(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Fetch reference image (user's uploaded photo from subjects/ prefix)
      const referenceImageBase64 = await this.fetchSubjectImage(userId);

      // Build a subject-focused prompt
      const subjectPrompt = this.buildSubjectPrompt(user.toObject());

      // Generate image using OpenAI API
      const imageBase64 = await this.callOpenAIImageAPI(
        subjectPrompt, 
        referenceImageBase64,
        model,
        size,
        quality
      );

      // Upload to S3
      const s3Uri = await this.uploadImageToS3(userId, imageBase64, 'subject');

      // Convert to presigned URL for immediate viewing
      const presignedUrl = await this.generatePresignedUrl(s3Uri);

      logger.info('Subject illustration generated successfully with OpenAI', { userId, s3Uri });
      return presignedUrl;

    } catch (error) {
      logger.error('Failed to generate subject illustration with OpenAI', {
        userId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Check if the OpenAI service is properly configured
   */
  async checkHealth(): Promise<boolean> {
    if (!OPENAI_API_KEY) {
      logger.warn('OpenAI API key not configured');
      return false;
    }

    try {
        // TODO: Implement a health check
      return true;
    } catch (error) {
      logger.warn('OpenAI health check failed', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Call OpenAI Images Edits API with gpt-image-1.5
   * Uses multipart/form-data to send image and prompt
   */
  private async callOpenAIImageAPI(
    prompt: string, 
    referenceImageBase64: string | undefined,
    model: string,
    size: string,
    quality: 'low' | 'high'
  ): Promise<string> {
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    if (!referenceImageBase64) {
      throw new Error('Reference image is required for /images/edits endpoint');
    }

    try {
      // Convert base64 image to Buffer
      const imageBuffer = Buffer.from(referenceImageBase64, 'base64');

      // Create FormData for multipart/form-data request
      const formData = new FormData();
      
      // Add the image file (required for /images/edits)
      formData.append('image', imageBuffer, {
        filename: 'reference.png',
        contentType: 'image/png',
      });

      // Add the prompt (required)
      formData.append('prompt', prompt);
      formData.append('model', model);

      // Add optional parameters
      formData.append('n', '1');
      formData.append('size', size);

      logger.debug('Calling OpenAI Images Edits API', { 
        model: model, 
        size: size,
        quality: quality,
        hasReferenceImage: !!referenceImageBase64,
        promptLength: prompt.length
      });

      const response = await axios.post<OpenAIImageResponse>(
        'https://api.openai.com/v1/images/edits',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            ...formData.getHeaders(), // This sets Content-Type with boundary
          },
          timeout: 120000, // 2 minutes timeout for image generation
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }
      );

      if (!response.data.data || !response.data.data[0]) {
        throw new Error('Invalid response from OpenAI: no image data');
      }

      const imageData = response.data.data[0];
      
      if (imageData.b64_json) {
        return imageData.b64_json;
      }

      // If URL is returned instead, fetch and convert to base64
      if (imageData.url) {
        const imageResponse = await axios.get(imageData.url, { responseType: 'arraybuffer' });
        return Buffer.from(imageResponse.data).toString('base64');
      }

      throw new Error('No image data in OpenAI response');

    } catch (error: any) {
      if (error.response) {
        logger.error('OpenAI API error', {
          status: error.response.status,
          data: error.response.data,
        });
        throw new Error(`OpenAI API error: ${error.response.data?.error?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Fetch the user's avatar reference image from S3
   */
  private async fetchReferenceImage(userId: string): Promise<string | undefined> {
    const key = `${S3_AVATAR_PREFIX}${userId}.png`;
    return this.fetchImageFromS3(key);
  }

  /**
   * Fetch the user's subject photo from S3
   */
  private async fetchSubjectImage(userId: string): Promise<string | undefined> {
    const key = `${S3_SUBJECTS_PREFIX}${userId}.png`;
    return this.fetchImageFromS3(key);
  }

  /**
   * Fetch an image from S3 and return as base64
   */
  private async fetchImageFromS3(key: string): Promise<string | undefined> {
    try {
      const command = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        logger.warn('No image body from S3', { key });
        return undefined;
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      
      return buffer.toString('base64');
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        logger.debug('Reference image not found in S3', { key });
        return undefined;
      }
      logger.warn('Failed to fetch reference image from S3', { key, error: error.message });
      return undefined;
    }
  }

  /**
   * Upload generated image to S3
   */
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

    await this.s3Client.send(command);
    
    return `s3://${S3_BUCKET}/${key}`;
  }

  /**
   * Generate a presigned URL for an S3 URI
   */
  private async generatePresignedUrl(s3Uri: string): Promise<string> {
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    
    // Parse S3 URI
    const match = s3Uri.match(/^s3:\/\/([^\/]+)\/(.+)$/);
    if (!match) {
      throw new Error(`Invalid S3 URI: ${s3Uri}`);
    }
    
    const [, bucket, key] = match;

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
  }

  /**
   * Build a prompt specifically for subject/portrait illustrations
   */
  private buildSubjectPrompt(user: any): string {
    const name = `${user.firstName} ${user.lastName}`.trim();
    
    return `
[SUBJECT]
Create a professional illustrated portrait of ${name}. Use the provided reference image to accurately capture ${user.firstName}'s facial features, expression, and likeness.

[IDENTITY CONSTRAINTS]
- Maintain exact facial features from reference image
- ${user.gender ? `Gender: ${user.gender}` : ''}
- ${user.age ? `Age: approximately ${user.age} years old` : ''}
- ${user.culturalBackground ? `Ethnicity/background: ${user.culturalBackground}` : ''}

[STYLE CONSTRAINTS]
- Style: Professional sketch-art style illustration with clean linework
- Color palette: Monochrome
- Quality: Minimal line work that includes the main form and expression without fully rendering textures or fine detail.
- Background: White
- Mood: Warm, neutral, professional

[COMPOSITION]
- Framing: Head and shoulders portrait, centered
- Perspective: Eye level, slight three-quarter view for dimension
- Expression: Natural, warm, friendly
- Lighting: Soft, even lighting from front-left
`.trim();
  }
}

// Export singleton instance
export const openAIIllustrationService = new OpenAIIllustrationService();

