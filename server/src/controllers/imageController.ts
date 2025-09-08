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

interface RegenerateImageRequest extends GenerateImageRequest {
  previousUrl: string;
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
      logger.info('Using illustration service for image generation');
      const s3Uri = await illustrationService.generateMemoryIllustration(userId, prompt);
      imageUrl = illustrationService.convertS3UriToPublicUrl(s3Uri);
      logger.info(`Generated image via illustration service: ${imageUrl}`);
    } catch (error) {
      logger.error('Illustration service failed:', error);
      
      // Only fall back to Bedrock if explicitly enabled
      if (USE_BEDROCK_FALLBACK) {
        logger.warn('Falling back to deprecated Bedrock service');
        try {
          const imageBuffer = await generateImageBedrock(prompt);
          const imageKey = `staging/${uuidv4()}.jpg`;
          imageUrl = await uploadToS3(imageBuffer, imageKey);
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
      data: { url: imageUrl },
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

export async function regenerateImage(req: Request, res: Response) {
  try {
    const { title, content, date, previousUrl, userId } = req.body as RegenerateImageRequest;
    
    if (!userId) {
      return res.status(400).json({
        status: 'fail',
        message: 'User ID is required for illustration regeneration',
      });
    }
    
    // Use enhanced prompt if userId is provided, otherwise use basic prompt
    let basePrompt: string;
    if (userId) {
      basePrompt = await craftEnhancedPrompt({ title, content, date }, userId);
    } else {
      basePrompt = craftBasicPrompt({ title, content, date });
    }
    
    const prompt = `${basePrompt}\n\nPlease create a different variation of this illustration while maintaining the same style and quality.`;
    
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
      logger.info('Using illustration service for image regeneration');
      const s3Uri = await illustrationService.generateMemoryIllustration(userId, prompt);
      imageUrl = illustrationService.convertS3UriToPublicUrl(s3Uri);
      logger.info(`Regenerated image via illustration service: ${imageUrl}`);
    } catch (error) {
      logger.error('Illustration service failed:', error);
      
      // Only fall back to Bedrock if explicitly enabled
      if (USE_BEDROCK_FALLBACK) {
        logger.warn('Falling back to deprecated Bedrock service');
        try {
          const imageBuffer = await generateImageBedrock(prompt);
          const imageKey = `staging/${uuidv4()}.jpg`;
          imageUrl = await uploadToS3(imageBuffer, imageKey);
        } catch (bedrockError) {
          logger.error('Bedrock fallback also failed:', bedrockError);
          return res.status(500).json({
            status: 'fail',
            message: 'Image regeneration failed',
          });
        }
      } else {
        return res.status(500).json({
          status: 'fail',
          message: 'Image regeneration failed',
        });
      }
    }

    const response: ApiResponse<{ url: string }> = {
      status: 'success',
      data: { url: imageUrl },
      message: 'Image regenerated successfully',
    };

    res.json(response);
  } catch (error) {
    logger.error('Error regenerating image:', error);
    res.status(500).json({
      status: 'fail',
      message: 'Failed to regenerate image',
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
      const s3Uri = await illustrationService.generateSubjectIllustration(userId);
      imageUrl = illustrationService.convertS3UriToPublicUrl(s3Uri);
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