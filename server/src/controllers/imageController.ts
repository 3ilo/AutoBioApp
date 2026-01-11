import { Request, Response } from 'express';
import { ApiResponse } from '../../../shared/types/ApiResponse';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { bedrockSummarizationService } from '../services/summarizationService';
import { contextBasedPromptEnhancementService } from '../services/promptEnhancementService';
import { bedrockMemorySummaryService } from '../services/memorySummaryService';
import { loraService } from '../services/loraService';
import { summarizationStubService } from '../services/stubs/summarizationStubService';
import { memorySummaryStubService } from '../services/stubs/memorySummaryStubService';
import { promptEnhancementStubService } from '../services/stubs/promptEnhancementStubService';
import { generateImageBedrock, uploadToS3 } from '../services/bedrockImageService';
import { getIllustrationService, getConfiguredProvider } from '../services/illustrationServiceFactory';
import { User } from '../models/User';
import { Memory } from '../models/Memory';
import { s3Client } from '../utils/s3Client';
import '../utils/auth'; // Import to ensure Request type extension is loaded

// Environment variables
const USE_BEDROCK_FALLBACK = process.env.USE_BEDROCK_FALLBACK === 'true'; // Only true if explicitly enabled

// Granular stub flags for each service
// Allows independent control over which services are stubbed
const USE_STUB_SUMMARIZATION = process.env.USE_STUB_SUMMARIZATION === 'true';
const USE_STUB_PROMPT_ENHANCEMENT = process.env.USE_STUB_PROMPT_ENHANCEMENT === 'true';
const USE_STUB_MEMORY_SUMMARY = process.env.USE_STUB_MEMORY_SUMMARY === 'true';
// Legacy: USE_STUB still works as a master switch for backward compatibility
const USE_STUB = process.env.USE_STUB === 'true';

// Types
interface GenerateImageRequest {
  title: string;
  content: string;
  date: Date;
  userId?: string; // Optional for backward compatibility
  // Provider-specific options (will be passed through based on configured provider)
  options?: {
    // SDXL options
    numInferenceSteps?: number;
    ipAdapterScale?: number;
    negativePrompt?: string;
    stylePrompt?: string;
    loraId?: string;
    // OpenAI options
    model?: string;
    size?: string;
    quality?: 'low' | 'high';
  };
}

// Initialize services (use stubs if individual flags or master USE_STUB is enabled)
const summarizationService = (USE_STUB || USE_STUB_SUMMARIZATION)
  ? summarizationStubService 
  : bedrockSummarizationService;
const promptEnhancementService = (USE_STUB || USE_STUB_PROMPT_ENHANCEMENT)
  ? promptEnhancementStubService
  : contextBasedPromptEnhancementService;
const memorySummaryService = (USE_STUB || USE_STUB_MEMORY_SUMMARY)
  ? memorySummaryStubService
  : bedrockMemorySummaryService;

// Helper function to craft the basic prompt (fallback)
function craftBasicPrompt(data: GenerateImageRequest): string {
  const date = new Date(data.date);
  const formattedDate = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `Create a whimsical illustration for a memory titled "${data.title}" from ${formattedDate}. 
The memory content is: "${data.content}"

Style requirements:
- Whimsical illustration style
- Soft, warm color palette
- Storybook aesthetic with subtle textures
- Use watercolor-like effects for depth
- Include subtle details that reflect the memory's content
- Keep the composition balanced and harmonious

The image should feel like a cherished page from a personal autobiography, capturing the essence of the memory while maintaining simple but stylish quality.`;
}

// Helper function to craft enhanced prompt with user context
async function craftEnhancedPrompt(data: GenerateImageRequest, userId: string): Promise<string> {
  try {
    // Get user data
    const user = await User.findById(userId);
    if (!user) {
      logger.warn('User not found for prompt enhancement, using basic prompt', { userId });
      return craftBasicPrompt(data);
    }

    // Get recent memories
    const recentMemories = await Memory.find({ author: userId })
      .sort({ date: -1 })
      .limit(5)
      .lean();

    // Generate missing summaries on-demand
    const memoriesWithSummaries = await Promise.all(
      recentMemories.map(async (memory) => {
        if (!memory.summary) {
          try {
            const summary = await memorySummaryService.generateMemorySummary(
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
            // Use fallback summary
            return { 
              ...memory, 
              summary: `Memory about ${memory.title} from ${new Date(memory.date).toLocaleDateString()}` 
            };
          }
        }
        return memory;
      })
    );

    // Generate memory summary using pre-generated summaries
    const memorySummary = await summarizationService.summarizeMemories(
      memoriesWithSummaries,
      user.toObject() as any,
      { maxMemories: 5, summaryLength: 'paragraph' },
      data.content,
      data.title
    );

    // Create enhanced prompt
    const enhancedPrompt = await promptEnhancementService.createEnhancedPrompt(
      { title: data.title, content: data.content, date: data.date },
      user.toObject() as any,
      memorySummary
    );

    return enhancedPrompt;
  } catch (error) {
    logger.error('Failed to create enhanced prompt, using basic prompt', { 
      userId, 
      error: (error as Error).message 
    });
    // Fallback to basic prompt
    return craftBasicPrompt(data);
  }
}

// Helper function to check if illustration service is available
async function isIllustrationServiceAvailable(): Promise<boolean> {
  try {
    const service = getIllustrationService();
    return await service.checkHealth();
  } catch (error) {
    logger.warn('Illustration service health check failed', { error: (error as Error).message });
    return false;
  }
}

export async function generateImage(req: Request, res: Response) {
  try {
    const { title, content, date, userId, options: requestOptions } = req.body as GenerateImageRequest;
    
    if (!title || !content || !date) {
      return res.status(400).json({
        status: 'fail',
        message: 'Title, content, and date are required',
      });
    }

    if (!userId) {
      return res.status(400).json({
        status: 'fail',
        message: 'User ID is required for illustration generation',
      });
    }
    
    const provider = getConfiguredProvider();
    const illustrationService = getIllustrationService();

    logger.info('Generating memory illustration', { userId, provider, title, options: requestOptions });

    // Check if illustration service is available (skip for stub)
    if (provider !== 'stub' && !(await isIllustrationServiceAvailable())) {
      logger.error('Illustration service unavailable', { userId, provider });
      return res.status(500).json({
        status: 'fail',
        message: 'Image generation service is not available',
      });
    }

    let imageURI: string;

    try {
      // Get most recent LoRA for user (only applicable for SDXL provider)
      const mostRecentLoRA = provider === 'sdxl' ? await loraService.getMostRecentLoRA(userId) : null;
      const loraId = requestOptions?.loraId || mostRecentLoRA?.lora_id;

      // Build options object, merging request options with defaults
      const options: any = {
        ...requestOptions,
      };

      // Provider-specific prompt handling
      if (provider === 'sdxl') {
        // SDXL: Craft enhanced prompt with memory summarization and context
        const prompt = await craftEnhancedPrompt({ title, content, date }, userId);
        const styleEnhancedPrompt = prompt;
        
        options.stylePrompt = requestOptions?.stylePrompt || styleEnhancedPrompt;
        options.ipAdapterScale = requestOptions?.ipAdapterScale ?? 0.4;
        if (loraId) {
          options.loraId = loraId;
        }
        
        imageURI = await illustrationService.generateMemoryIllustration(
          userId,
          styleEnhancedPrompt,
          options
        );
      } else if (provider === 'openai') {
        // OpenAI: Pass raw memory data and let OpenAI handle all prompt composition
        // OpenAI service will fetch recent memories and build structured prompts internally
        options.memoryTitle = title;
        options.memoryContent = content; // Raw, unenhanced content
        options.memoryDate = date;
        
        // For OpenAI, we pass a placeholder prompt since it will be rebuilt
        // The actual prompt building happens inside OpenAI service
        imageURI = await illustrationService.generateMemoryIllustration(
          userId,
          content, // Pass raw content as placeholder
          options
        );
      } else {
        // Stub or other providers: use basic prompt

        imageURI = await illustrationService.generateMemoryIllustration(
          userId,
          content,
          options
        );
      }
      
      logger.info('Memory illustration generated successfully', { 
        userId, 
        provider, 
        s3Uri: imageURI, 
        loraId 
      });
    } catch (error) {
      logger.error('Illustration service failed', { 
        userId, 
        provider,
        error: (error as Error).message 
      });
      
      // Only fall back to Bedrock if explicitly enabled and not using stub
      if (USE_BEDROCK_FALLBACK && provider !== 'stub') {
        logger.warn('Falling back to deprecated Bedrock service', { userId });
        try {
          // Craft prompt for Bedrock fallback
          const fallbackPrompt = await craftEnhancedPrompt({ title, content, date }, userId);
          const imageBuffer = await generateImageBedrock(fallbackPrompt);
          const imageKey = `staging/${uuidv4()}.jpg`;
          imageURI = await uploadToS3(imageBuffer, imageKey);
          logger.info('Bedrock fallback succeeded', { userId, s3Uri: imageURI });
        } catch (bedrockError) {
          logger.error('Bedrock fallback failed', { 
            userId, 
            error: (bedrockError as Error).message 
          });
          return res.status(500).json({
            status: 'fail',
            message: 'Image generation failed',
          });
        }
      } else {
        return res.status(500).json({
          status: 'fail',
          message: 'Image generation failed',
        });
      }
    }

    const response: ApiResponse<{ url: string }> = {
      status: 'success',
      data: { url: imageURI },
      message: 'Image generated successfully',
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to generate memory illustration', { 
      userId: req.body.userId, 
      error: (error as Error).message 
    });
    res.status(500).json({
      status: 'fail',
      message: 'Failed to generate image',
    });
  }
}

export async function generateSubjectIllustration(req: Request, res: Response) {
  try {
    const { userId, options: requestOptions } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        status: 'fail',
        message: 'User ID is required for subject illustration generation',
      });
    }
    
    const provider = getConfiguredProvider();
    const illustrationService = getIllustrationService();

    logger.info('Generating subject illustration', { userId, provider, options: requestOptions });

    // Check if illustration service is available (skip for stub)
    if (provider !== 'stub' && !(await isIllustrationServiceAvailable())) {
      logger.error('Illustration service unavailable for subject illustration', { userId, provider });
      return res.status(500).json({
        status: 'fail',
        message: 'Image generation service is not available',
      });
    }

    let imageUrl: string;

    try {
      // Get most recent LoRA for user (only applicable for SDXL provider)
      const mostRecentLoRA = provider === 'sdxl' ? await loraService.getMostRecentLoRA(userId) : null;
      const loraId = requestOptions?.loraId || mostRecentLoRA?.lora_id;

      // Build options object, merging request options with defaults
      const options: any = {
        ...requestOptions,
      };

      // Provider-specific defaults
      if (provider === 'sdxl' && loraId) {
        options.loraId = loraId;
      }

      imageUrl = await illustrationService.generateSubjectIllustration(userId, options);
      
      logger.info('Subject illustration generated successfully', { 
        userId, 
        provider, 
        url: imageUrl, 
        loraId 
      });
    } catch (error) {
      logger.error('Subject illustration service failed', { 
        userId, 
        provider,
        error: (error as Error).message 
      });
      return res.status(500).json({
        status: 'fail',
        message: 'Failed to generate subject illustration',
      });
    }

    const response: ApiResponse<{ url: string }> = {
      status: 'success',
      data: { url: imageUrl },
      message: 'Subject illustration generated successfully',
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to generate subject illustration', { 
      userId: req.body.userId, 
      error: (error as Error).message 
    });
    res.status(500).json({
      status: 'fail',
      message: 'Failed to generate subject illustration',
    });
  }
}

export async function generatePresignedUploadUrl(req: Request, res: Response) {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        status: 'fail',
        message: 'User not authenticated',
      });
    }

    const userId = req.user._id;
    const { contentType } = req.body;
    
    if (!contentType || !contentType.startsWith('image/')) {
      return res.status(400).json({
        status: 'fail',
        message: 'Valid image content type is required',
      });
    }

    // Generate pre-signed URL for reference image upload
    const presignedUrl = await s3Client.generatePresignedUploadUrl(userId, contentType);

    const response: ApiResponse<{ uploadUrl: string; key: string }> = {
      status: 'success',
      data: { 
        uploadUrl: presignedUrl,
        key: s3Client.getSubjectKey(userId)
      },
      message: 'Pre-signed upload URL generated successfully',
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to generate presigned upload URL', { 
      userId: req.user?._id, 
      error: (error as Error).message 
    });
    res.status(500).json({
      status: 'fail',
      message: 'Failed to generate upload URL',
    });
  }
}

export async function generatePresignedAvatarUploadUrl(req: Request, res: Response) {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        status: 'fail',
        message: 'User not authenticated',
      });
    }

    const userId = req.user._id;
    const { contentType } = req.body;
    
    if (!contentType || !contentType.startsWith('image/')) {
      return res.status(400).json({
        status: 'fail',
        message: 'Valid image content type is required',
      });
    }

    // Generate pre-signed URL for avatar upload
    const presignedUrl = await s3Client.generatePresignedAvatarUploadUrl(userId, contentType);

    const response: ApiResponse<{ uploadUrl: string; key: string }> = {
      status: 'success',
      data: { 
        uploadUrl: presignedUrl,
        key: s3Client.getAvatarKey(userId)
      },
      message: 'Pre-signed avatar upload URL generated successfully',
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to generate presigned avatar upload URL', { 
      userId: req.user?._id, 
      error: (error as Error).message 
    });
    res.status(500).json({
      status: 'fail',
      message: 'Failed to generate avatar upload URL',
    });
  }
}

export async function generatePresignedViewUrl(req: Request, res: Response) {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        status: 'fail',
        message: 'User not authenticated',
      });
    }

    const { s3Uri } = req.body;
    
    if (!s3Uri) {
      return res.status(400).json({
        status: 'fail',
        message: 'S3 URI is required',
      });
    }

    const presignedUrl = await s3Client.convertS3UriToPresignedUrl(s3Uri);

    const response: ApiResponse<{ presignedUrl: string }> = {
      status: 'success',
      data: { 
        presignedUrl: presignedUrl
      },
      message: 'Pre-signed view URL generated successfully',
    };

    res.json(response);
  } catch (error) {
    const s3Uri = req.body.s3Uri;
    logger.error('Failed to generate presigned view URL', { 
      userId: req.user?._id, 
      s3Uri, 
      error: (error as Error).message 
    });
    res.status(500).json({
      status: 'fail',
      message: 'Failed to generate presigned view URL',
    });
  }
} 