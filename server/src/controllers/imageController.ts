import { Request, Response } from 'express';
import { ApiResponse } from '../../../shared/types/ApiResponse';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { bedrockContextSummarizationService } from '../services/contextSummarizers/summarizationService';
import { bedrockMemorySummaryService } from '../services/memorySummarizers/memorySummaryService';
import { loraService } from '../services/loraService';
import { contextSummarizationStubService } from '../services/stubs/summarizationStubService';
import { memorySummaryStubService } from '../services/stubs/memorySummaryStubService';
import { getIllustrationService, getConfiguredProvider } from '../services/illustrationServiceFactory';
import { OpenAIMemoryIllustrationOptions, SDXLMemoryIllustrationOptions } from '../services/interfaces/IIllustrationService';
import { s3Client } from '../utils/s3Client';
import '../utils/auth'; // Import to ensure Request type extension is loaded

// Granular stub flags for each service
// Allows independent control over which services are stubbed
const USE_STUB_SUMMARIZATION = process.env.USE_STUB_SUMMARIZATION === 'true';
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
const contextSummarizationService = (USE_STUB || USE_STUB_SUMMARIZATION)
  ? contextSummarizationStubService 
  : bedrockContextSummarizationService;
const memorySummaryService = (USE_STUB || USE_STUB_MEMORY_SUMMARY)
  ? memorySummaryStubService
  : bedrockMemorySummaryService;

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

      // Provider-specific prompt handling with discriminated union types
      if (provider === 'sdxl') {
        const sdxlOptions: SDXLMemoryIllustrationOptions = {
          provider: 'sdxl',
          memoryTitle: title,
          memoryContent: content,
          memoryDate: date,
          stylePrompt: requestOptions?.stylePrompt,
          negativePrompt: requestOptions?.negativePrompt,
          ipAdapterScale: requestOptions?.ipAdapterScale ?? 0.4,
          numInferenceSteps: requestOptions?.numInferenceSteps,
          ...(loraId && { loraId }),
        };
        
        imageURI = await illustrationService.generateMemoryIllustration(
          userId,
          content, // Pass raw content, orchestrator will build prompt
          sdxlOptions
        );
      } else if (provider === 'openai') {
        const openAIOptions: OpenAIMemoryIllustrationOptions = {
          provider: 'openai',
          memoryTitle: title,
          memoryContent: content, // Raw, unenhanced content
          memoryDate: date,
          model: requestOptions?.model,
          size: requestOptions?.size,
          quality: requestOptions?.quality,
          stylePrompt: requestOptions?.stylePrompt,
          negativePrompt: requestOptions?.negativePrompt,
        };
        
        imageURI = await illustrationService.generateMemoryIllustration(
          userId,
          content, // Pass raw content, orchestrator will build prompt
          openAIOptions
        );
      } else {
        // Stub: use basic options
        imageURI = await illustrationService.generateMemoryIllustration(
          userId,
          content,
          undefined
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
      
      return res.status(500).json({
        status: 'fail',
        message: 'Image generation failed',
      });
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
        provider, 
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