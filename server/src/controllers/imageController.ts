import { Request, Response } from 'express';
import { ApiResponse } from '../../../shared/types/ApiResponse';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { BedrockSummarizationService } from '../services/summarizationService';
import { PromptEnhancementService } from '../services/promptEnhancementService';
import { BedrockMemorySummaryService } from '../services/memorySummaryService';
import { User } from '../models/User';
import { Memory } from '../models/Memory';
import { log } from 'console';

// Environment variables
const STAGING_BUCKET = process.env.AWS_STAGING_BUCKET || 'autobio-staging';
const IMAGE_MODEL_ID = process.env.BEDROCK_IMAGE_MODEL_ID || 'stability.stable-diffusion-xl-v1';
const BEDROCK_CLIENT_REGION = process.env.BEDROCK_CLIENT_REGION || 'us-west-2';
const S3_CLIENT_REGION = process.env.S3_CLIENT_REGION || 'us-west-2';
const AWS_REGION = process.env.AWS_REGION || 'us-west-2';

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


// Initialize AWS clients
const s3Client = new S3Client({
  region: S3_CLIENT_REGION || 'us-west-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const bedrockClient = new BedrockRuntimeClient({
  region: BEDROCK_CLIENT_REGION || 'us-west-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

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

// Helper function to generate a fake image URL (for development)
async function generateFakeImageUrl(): Promise<string> {
  // In production, this would be replaced with actual Bedrock API call
  const imageKey = "IMG_0451.jpeg" // `staging/${uuidv4()}.jpg`;
  
  // For development, return a placeholder image URL
  // return "https://milochase.com/assets/pfp-45e008ee.png"
  return `https://${STAGING_BUCKET}.s3.amazonaws.com/${imageKey}`;
}

// Helper function to generate image using Bedrock
async function generateImageBedrock(prompt: string): Promise<Buffer> {
  try {
    if (!prompt) {
      throw new Error('Prompt is required');
    }

    // Prepare the request payload for the image model
    const payload = {
      prompt: prompt,
      mode: "text-to-image",
      aspect_ratio: "1:1",
      output_format: "jpeg",
      seed: Math.floor(Math.random() * 1000000),
    };

    // Invoke the Bedrock model
    const command = new InvokeModelCommand({
      modelId: IMAGE_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    });

    const response = await bedrockClient.send(command);
    
    if (!response.body) {
      throw new Error('No response body from Bedrock');
    }

    // Convert the response to a Buffer
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    if (!responseBody.images?.[0]) {
      logger.error('Invalid response format from Bedrock:', Object.keys(responseBody));
      throw new Error('Invalid response format from Bedrock');
    }

    logger.info('Response Body:', Object.keys(responseBody));

    return Buffer.from(responseBody.images[0], 'base64'); //Images not Artifacts?
  } catch (error) {
    logger.error('Error generating image with Bedrock:', error);
    throw error;
  }
}

// Helper function to upload image to S3
async function uploadToS3(imageBuffer: Buffer, key: string): Promise<string> {
  try {
    if (!imageBuffer || !key) {
      throw new Error('Image buffer and key are required');
    }

    const command = new PutObjectCommand({
      Bucket: STAGING_BUCKET,
      Key: key,
      Body: imageBuffer,
      ContentType: 'image/jpeg',
    });

    await s3Client.send(command);
    return `https://${STAGING_BUCKET}.s3.amazonaws.com/${key}`;
  } catch (error) {
    logger.error('Error uploading to S3:', error);
    throw error;
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
    
    // Use enhanced prompt if userId is provided, otherwise use basic prompt
    let prompt: string;
    if (userId) {
      logger.info(`Crafting enhanced prompt for user ID: ${userId}`);
      prompt = await craftEnhancedPrompt({ title, content, date }, userId);
    } else {
      logger.info(`Crafting basic prompt`);
      prompt = craftBasicPrompt({ title, content, date });
    }
    
    // Generate image using Bedrock
    const imageBuffer = await generateImageBedrock(prompt);
    
    // Upload to S3
    const imageKey = `staging/${uuidv4()}.jpg`;
    const imageUrl = await uploadToS3(imageBuffer, imageKey);

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
    
    // Use enhanced prompt if userId is provided, otherwise use basic prompt
    let basePrompt: string;
    if (userId) {
      basePrompt = await craftEnhancedPrompt({ title, content, date }, userId);
    } else {
      basePrompt = craftBasicPrompt({ title, content, date });
    }
    
    const prompt = `${basePrompt}\n\nPlease create a different variation of this illustration while maintaining the same style and quality.`;
    
    // TODO: Replace with actual Bedrock API call
    // For now, generate a fake image URL
    const imageUrl = await generateFakeImageUrl();

    const response: ApiResponse<{ url: string }> = {
      status: 'success',
      data: { url: imageUrl },
      message: 'Image regenerated successfully',
    };

    res.json(response);
  } catch (error) {
    console.error('Error regenerating image:', error);
    res.status(500).json({
      status: 'fail',
      message: 'Failed to regenerate image',
    });
  }
} 