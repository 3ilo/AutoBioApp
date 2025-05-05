import { Request, Response } from 'express';
import { ApiResponse } from '../../../shared/types/ApiResponse';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const STAGING_BUCKET = process.env.AWS_STAGING_BUCKET || 'autobio-staging';

interface GenerateImageRequest {
  title: string;
  content: string;
  date: Date;
}

interface RegenerateImageRequest extends GenerateImageRequest {
  previousUrl: string;
}

// Helper function to craft the prompt
function craftPrompt(data: GenerateImageRequest): string {
  const date = new Date(data.date);
  const formattedDate = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `Create a whimsical, storybook-style illustration for a memory titled "${data.title}" from ${formattedDate}. 
The memory content is: "${data.content}"

Style requirements:
- Whimsical and playful illustration style
- Soft, warm color palette
- Gentle, flowing lines
- Storybook aesthetic with subtle textures
- Include decorative elements like stars, flowers, or patterns
- Maintain a dreamy, nostalgic atmosphere
- Use watercolor-like effects for depth
- Include subtle details that reflect the memory's content
- Keep the composition balanced and harmonious
- Ensure the style is consistent with children's book illustrations

The image should feel like a cherished page from a personal storybook, capturing the essence of the memory while maintaining a magical, dreamy quality.`;
}

// Helper function to generate a fake image URL (for development)
async function generateFakeImageUrl(): Promise<string> {
  // In production, this would be replaced with actual Bedrock API call
  const imageKey = `staging/${uuidv4()}.jpg`;
  
  // For development, return a placeholder image URL
  return "https://milochase.com/assets/pfp-45e008ee.png"
  // return `https://${STAGING_BUCKET}.s3.amazonaws.com/${imageKey}`;
}

// Helper function to upload image to S3
async function uploadToS3(imageBuffer: Buffer, key: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: STAGING_BUCKET,
    Key: key,
    Body: imageBuffer,
    ContentType: 'image/jpeg',
  });

  await s3Client.send(command);
  return `https://${STAGING_BUCKET}.s3.amazonaws.com/${key}`;
}

export async function generateImage(req: Request, res: Response) {
  try {
    const { title, content, date } = req.body as GenerateImageRequest;
    
    // Craft the prompt
    const prompt = craftPrompt({ title, content, date });
    
    // TODO: Replace with actual Bedrock API call
    // For now, generate a fake image URL
    const imageUrl = await generateFakeImageUrl();

    const response: ApiResponse<{ url: string }> = {
      status: 'success',
      data: { url: imageUrl },
      message: 'Image generated successfully',
    };

    res.json(response);
  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).json({
      status: 'fail',
      message: 'Failed to generate image',
    });
  }
}

export async function regenerateImage(req: Request, res: Response) {
  try {
    const { title, content, date, previousUrl } = req.body as RegenerateImageRequest;
    
    // Craft the prompt with a variation request
    const basePrompt = craftPrompt({ title, content, date });
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