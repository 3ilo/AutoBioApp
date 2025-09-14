import { Request, Response } from 'express';
import { ApiResponse } from '../../../shared/types/ApiResponse';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { BedrockSummarizationService } from '../services/summarizationService';
import { PromptEnhancementService } from '../services/promptEnhancementService';
import { BedrockMemorySummaryService } from '../services/memorySummaryService';
import { illustrationService } from '../services/illustrationService';
import { generateImageBedrock, uploadToS3, generateFakeImageUrl } from '../services/bedrockImageService';
import { User } from '../models/User';
import { Memory } from '../models/Memory';
import { s3Client } from '../utils/s3Client';
import '../utils/auth'; // Import to ensure Request type extension is loaded

// Environment variables
const STAGING_BUCKET = process.env.AWS_STAGING_BUCKET || 'autobio-staging';
const ILLUSTRATION_SERVICE_URL = process.env.ILLUSTRATION_SERVICE_URL || 'http://localhost:8000';
const USE_ILLUSTRATION_SERVICE = process.env.USE_ILLUSTRATION_SERVICE === 'true'; // Only true if explicitly enabled
const USE_BEDROCK_FALLBACK = process.env.USE_BEDROCK_FALLBACK === 'true'; // Only true if explicitly enabled

// Types
interface GenerateImageRequest {
  title: string;
  content: string;
  date: Date;
  userId?: string; // Optional for backward compatibility
}

// Initialize services
const summarizationService = new BedrockSummarizationService();
const promptEnhancementService = new PromptEnhancementService();
const memorySummaryService = new BedrockMemorySummaryService();

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
  logger.info(`Crafting enhanced prompt for user ID: ${userId}`);
  try {
    // Get user data
    const user = await User.findById(userId);
    if (!user) {
      logger.warn(`User not found for ID: ${userId}, using basic prompt`);
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
            logger.error(`Error generating summary for memory ${memory._id}:`, error);
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
      { maxMemories: 5, summaryLength: 'paragraph' }
    );

    // Create enhanced prompt
    const enhancedPrompt = await promptEnhancementService.createEnhancedPrompt(
      { title: data.title, content: data.content, date: data.date },
      user.toObject() as any,
      memorySummary
    );

    return enhancedPrompt;
  } catch (error) {
    logger.error('Error creating enhanced prompt:', error);
    // Fallback to basic prompt
    return craftBasicPrompt(data);
  }
}

// Helper function to check if illustration service is available
async function isIllustrationServiceAvailable(): Promise<boolean> {
  try {
    return await illustrationService.checkHealth();
  } catch (error) {
    logger.warn('Illustration service health check failed:', error);
    return false;
  }
}

export async function generateImage(req: Request, res: Response) {
  try {
    const { title, content, date, userId } = req.body as GenerateImageRequest;
    
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
    
    // Use enhanced prompt if userId is provided, otherwise use basic prompt
    let prompt: string;
    if (userId) {
      logger.info(`Crafting enhanced prompt for user ID: ${userId}`);
      prompt = await craftEnhancedPrompt({ title, content, date }, userId);
    } else {
      logger.info(`Crafting basic prompt`);
      prompt = craftBasicPrompt({ title, content, date });
    }
    
    let imageURI: string;

    // Check if illustration service is enabled
    if (!USE_ILLUSTRATION_SERVICE) {
      logger.error('Illustration service is disabled. Set USE_ILLUSTRATION_SERVICE=true to enable.');
      return res.status(500).json({
        status: 'fail',
        message: 'Image generation service is not available',
      });
    }

    // Check if illustration service is available
    if (!(await isIllustrationServiceAvailable())) {
      logger.error('Illustration service is not available');
      return res.status(500).json({
        status: 'fail',
        message: 'Image generation service is not available',
      });
    }

    // Use illustration service
    try {
      logger.info('Using illustration service for image generation');
      imageURI = await illustrationService.generateMemoryIllustration(userId, prompt, {ipAdapterScale: 0.5});
      logger.info(`Generated image via illustration service (S3 URI): ${imageURI}`);
    } catch (error) {
      logger.error('Illustration service failed:', error);
      
      // Only fall back to Bedrock if explicitly enabled
      if (USE_BEDROCK_FALLBACK) {
        logger.warn('Falling back to deprecated Bedrock service');
        try {
          const imageBuffer = await generateImageBedrock(prompt);
          const imageKey = `staging/${uuidv4()}.jpg`;
          imageURI = await uploadToS3(imageBuffer, imageKey);
        } catch (bedrockError) {
          logger.error('Bedrock fallback also failed:', bedrockError);
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
    logger.error('Error in generateImage:', error);
    res.status(500).json({
      status: 'fail',
      message: 'Failed to generate image',
    });
  }
}

export async function generateSubjectIllustration(req: Request, res: Response) {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        status: 'fail',
        message: 'User ID is required for subject illustration generation',
      });
    }
    
    let imageUrl: string;

    // Check if illustration service is enabled
    if (!USE_ILLUSTRATION_SERVICE) {
      logger.error('Illustration service is disabled. Set USE_ILLUSTRATION_SERVICE=true to enable.');
      return res.status(500).json({
        status: 'fail',
        message: 'Image generation service is not available',
      });
    }

    // Check if illustration service is available
    if (!(await isIllustrationServiceAvailable())) {
      logger.error('Illustration service is not available');
      return res.status(500).json({
        status: 'fail',
        message: 'Image generation service is not available',
      });
    }

    // Use illustration service
    try {
      logger.info('Using illustration service for subject illustration generation');
      imageUrl = await illustrationService.generateSubjectIllustration(userId);
      logger.info(`Generated subject illustration via illustration service: ${imageUrl}`);
    } catch (error) {
      logger.error('Illustration service failed for subject illustration:', error);
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
    logger.error('Error generating subject illustration:', error);
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
    
    logger.info(`Generated presigned upload URL for user ${userId}`);

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
    logger.error('Error generating presigned upload URL:', error);
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
    
    logger.info(`Generated presigned avatar upload URL for user ${userId}`);

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
    logger.error('Error generating presigned avatar upload URL:', error);
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
    
    logger.info(`Generated presigned view URL for user ${req.user._id}`);

    const response: ApiResponse<{ presignedUrl: string }> = {
      status: 'success',
      data: { 
        presignedUrl: presignedUrl
      },
      message: 'Pre-signed view URL generated successfully',
    };

    res.json(response);
  } catch (error) {
    logger.error('Error generating presigned view URL:', error);
    res.status(500).json({
      status: 'fail',
      message: 'Failed to generate presigned view URL',
    });
  }
} 