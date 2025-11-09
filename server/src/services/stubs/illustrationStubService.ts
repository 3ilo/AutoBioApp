import logger from '../../utils/logger';
import { s3Client } from '../../utils/s3Client';
import { v4 as uuidv4 } from 'uuid';

/**
 * Stub service for illustration generation in dev mode
 * Returns mock S3 URIs without actually calling the illustration service
 */
export class IllustrationStubService {
  /**
   * Generate a stub memory illustration
   * Returns a mock S3 URI that can be used for testing
   */
  async generateMemoryIllustration(
    userId: string,
    prompt: string,
    options: {
      numInferenceSteps?: number;
      ipAdapterScale?: number;
      negativePrompt?: string;
      stylePrompt?: string;
    } = {}
  ): Promise<string> {
    logger.info(`[STUB] Generating memory illustration for user: ${userId}`);
    logger.info(`[STUB] Prompt: ${prompt.substring(0, 100)}...`);
    
    const s3Uri = "s3://auto-bio-illustrations/stubs/StubbedMode.png";
    
    logger.info(`[STUB] Generated mock S3 URI: ${s3Uri}`);
    return s3Uri;
  }

  /**
   * Generate a stub subject illustration
   * Returns a mock S3 URI that can be used for testing
   */
  async generateSubjectIllustration(
    userId: string,
    options: {
      numInferenceSteps?: number;
      ipAdapterScale?: number;
      negativePrompt?: string;
      stylePrompt?: string;
    } = {}
  ): Promise<string> {
    logger.info(`[STUB] Generating subject illustration for user: ${userId}`);
    
    // Generate a mock S3 URI
    const bucket = process.env.AWS_S3_BUCKET || 'autobio-staging';
    const timestamp = Date.now();
    const key = `stub/subjects/${userId}/${timestamp}-${uuidv4()}.jpg`;
    const s3Uri = `s3://${bucket}/${key}`;
    
    logger.info(`[STUB] Generated mock S3 URI: ${s3Uri}`);
    
    // Convert S3 URI to pre-signed URL for viewing (this will still work with S3)
    // In dev mode, this might return a placeholder URL or a real presigned URL
    try {
      const presignedUrl = await s3Client.convertS3UriToPresignedUrl(s3Uri);
      return presignedUrl;
    } catch (error) {
      // If S3 conversion fails, return a placeholder URL
      logger.warn(`[STUB] Could not generate presigned URL, returning placeholder`);
      return `https://via.placeholder.com/512x512?text=Stub+Illustration+${userId}`;
    }
  }

  /**
   * Check if the stub service is "healthy" (always true for stubs)
   */
  async checkHealth(): Promise<boolean> {
    logger.info('[STUB] Health check - stub service is always available');
    return true;
  }
}

// Export singleton instance
export const illustrationStubService = new IllustrationStubService();

