import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { 
  IImageGenerator, 
  ImageGenerationInput, 
  ImageGenerationOutput,
  BaseImageGenerationOptions
} from '../interfaces/IImageGenerator';
import { s3Client } from '../../utils/s3Client';
import logger from '../../utils/logger';

/**
 * Stub image generator for development/testing.
 * Returns a random image from the S3 stubs/ path.
 */
export class StubImageGenerator implements IImageGenerator {
  async generateImage(
    input: ImageGenerationInput,
    options: BaseImageGenerationOptions = {}
  ): Promise<ImageGenerationOutput> {
    logger.debug('Stub image generator: Generating mock image', { 
      userId: input.userId,
      promptLength: input.prompt.length 
    });

    const bucket = s3Client.getBucketName();
    const stubsPrefix = s3Client.getStubsPrefix();

    try {
      // List objects in the stubs/ prefix
      const listCommand = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: stubsPrefix,
      });

      const listResponse = await s3Client.getClient().send(listCommand);
      
      if (!listResponse.Contents || listResponse.Contents.length === 0) {
        logger.warn('No stub images found in S3, falling back to minimal PNG');
        // Fallback to minimal transparent PNG if no stubs found
        const stubImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        return {
          imageBase64: stubImageBase64,
          revisedPrompt: `[STUB] ${input.prompt}`,
        };
      }

      // Filter for image files
      const imageExtensions = ['.png', '.jpg', '.jpeg', '.PNG', '.JPG', '.JPEG'];
      const imageKeys = listResponse.Contents
        .map(obj => obj.Key)
        .filter((key): key is string => {
          if (!key) return false;
          return imageExtensions.some(ext => key.toLowerCase().endsWith(ext));
        });

      if (imageKeys.length === 0) {
        logger.warn('No image files found in stubs/, falling back to minimal PNG');
        const stubImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        return {
          imageBase64: stubImageBase64,
          revisedPrompt: `[STUB] ${input.prompt}`,
        };
      }

      // Pick a random image
      const randomIndex = Math.floor(Math.random() * imageKeys.length);
      const randomKey = imageKeys[randomIndex];

      logger.debug('Stub image generator: Selected random image', { key: randomKey });

      // Fetch the image from S3
      const imageBase64 = await s3Client.getObjectAsBase64(bucket, randomKey);

      return {
        imageBase64,
        revisedPrompt: `[STUB] ${input.prompt}`,
      };
    } catch (error) {
      logger.error('Stub image generator: Failed to fetch stub image from S3', {
        error: (error as Error).message,
      });
      
      // Fallback to minimal transparent PNG on error
      const stubImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      return {
        imageBase64: stubImageBase64,
        revisedPrompt: `[STUB] ${input.prompt}`,
      };
    }
  }

  async checkHealth(): Promise<boolean> {
    return true;
  }
}

export const stubImageGenerator = new StubImageGenerator();

