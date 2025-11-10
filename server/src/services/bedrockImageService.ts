/**
 * @deprecated This service is deprecated in favor of the custom illustration-gen service.
 * Use IllustrationService instead for better quality and user-specific illustrations.
 * 
 * This file contains the legacy Bedrock image generation implementation.
 * It will be removed in a future version.
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { getAwsClientConfig } from '../utils/env';

// Environment variables
const STAGING_BUCKET = process.env.AWS_STAGING_BUCKET || 'autobio-staging';
const IMAGE_MODEL_ID = process.env.BEDROCK_IMAGE_MODEL_ID || 'stability.stable-diffusion-xl-v1';
const BEDROCK_CLIENT_REGION = process.env.BEDROCK_CLIENT_REGION || 'us-west-2';
const S3_CLIENT_REGION = process.env.S3_CLIENT_REGION || 'us-west-2';

// Initialize AWS clients using centralized configuration
// Automatically handles credentials for local vs serverless (dev/prod)
const s3Client = new S3Client(getAwsClientConfig(S3_CLIENT_REGION || 'us-west-2'));
const bedrockClient = new BedrockRuntimeClient(getAwsClientConfig(BEDROCK_CLIENT_REGION || 'us-west-2'));

/**
 * @deprecated Use IllustrationService.generateMemoryIllustration() instead
 */
export async function generateImageBedrock(prompt: string): Promise<Buffer> {
  logger.warn('generateImageBedrock is deprecated. Use IllustrationService instead.');
  
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

    return Buffer.from(responseBody.images[0], 'base64');
  } catch (error) {
    logger.error('Error generating image with Bedrock:', error);
    throw error;
  }
}

/**
 * @deprecated Use IllustrationService which handles S3 uploads automatically
 */
export async function uploadToS3(imageBuffer: Buffer, key: string): Promise<string> {
  logger.warn('uploadToS3 is deprecated. Use IllustrationService which handles S3 uploads automatically.');
  
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

/**
 * @deprecated Use IllustrationService.generateMemoryIllustration() instead
 */
export async function generateFakeImageUrl(): Promise<string> {
  logger.warn('generateFakeImageUrl is deprecated. Use IllustrationService instead.');
  
  // In production, this would be replaced with actual Bedrock API call
  const imageKey = "IMG_0451.jpeg";
  
  return `https://${STAGING_BUCKET}.s3.amazonaws.com/${imageKey}`;
}
