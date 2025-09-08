import axios, { AxiosResponse } from 'axios';
import { s3Client } from '../utils/s3Client';
import logger from '../utils/logger';

// Environment variables
const ILLUSTRATION_SERVICE_URL = process.env.ILLUSTRATION_SERVICE_URL || 'http://localhost:8000';
const ILLUSTRATION_SERVICE_AUTH_TOKEN = process.env.ILLUSTRATION_SERVICE_AUTH_TOKEN;

// Types
interface GenerateMemoryIllustrationRequest {
  user_id: string;
  prompt: string;
  num_inference_steps?: number;
  ip_adapter_scale?: number;
  negative_prompt?: string;
  style_prompt?: string;
}

interface GenerateSubjectIllustrationRequest {
  user_id: string;
  num_inference_steps?: number;
  ip_adapter_scale?: number;
  negative_prompt?: string;
  style_prompt?: string;
}

interface IllustrationResponse {
  data: Array<{
    s3_uri: string;
  }>;
}

interface IllustrationServiceError extends Error {
  statusCode?: number;
  service?: string;
}

export class IllustrationService {
  private baseUrl: string;
  private authToken?: string;

  constructor() {
    this.baseUrl = ILLUSTRATION_SERVICE_URL;
    this.authToken = ILLUSTRATION_SERVICE_AUTH_TOKEN;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  private async makeRequest<T>(
    endpoint: string,
    data: any,
    method: 'POST' = 'POST'
  ): Promise<T> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      logger.info(`Making request to illustration service: ${method} ${url}`);

      const response: AxiosResponse<T> = await axios({
        method,
        url,
        data,
        headers: this.getHeaders(),
        timeout: 120000, // 2 minutes timeout for image generation
      });

      logger.info(`Illustration service response: ${response.status}`);
      return response.data;
    } catch (error: any) {
      logger.error('Illustration service request failed:', error);

      const serviceError: IllustrationServiceError = new Error(
        `Illustration service request failed: ${error.message}`
      );
      serviceError.statusCode = error.response?.status || 500;
      serviceError.service = 'illustration-service';

      throw serviceError;
    }
  }

  /**
   * Generate a memory illustration using the user's avatar as IP-Adapter input
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
    const request: GenerateMemoryIllustrationRequest = {
      user_id: userId,
      prompt,
      num_inference_steps: options.numInferenceSteps || 50,
      ip_adapter_scale: options.ipAdapterScale || 0.33,
      negative_prompt: options.negativePrompt || 'error, glitch, mistake',
      style_prompt: options.stylePrompt || 'highest quality, monochrome, professional sketch, personal, nostalgic, clean',
    };

    logger.info(`Generating memory illustration for user: ${userId}`);
    const response = await this.makeRequest<IllustrationResponse>(
      '/v1/images/memory',
      request
    );

    if (!response.data || !response.data[0] || !response.data[0].s3_uri) {
      throw new Error('Invalid response from illustration service: missing S3 URI');
    }

    const s3Uri = response.data[0].s3_uri;
    logger.info(`Memory illustration generated: ${s3Uri}`);
    
    // Convert S3 URI to pre-signed URL for viewing
    const presignedUrl = await s3Client.convertS3UriToPresignedUrl(s3Uri);
    logger.info(`Generated pre-signed URL for memory illustration`);
    return presignedUrl;
  }

  /**
   * Generate a subject illustration using the user's uploaded photo
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
    const request: GenerateSubjectIllustrationRequest = {
      user_id: userId,
      num_inference_steps: options.numInferenceSteps || 50,
      ip_adapter_scale: options.ipAdapterScale || 0.33,
      negative_prompt: options.negativePrompt || 'error, glitch, mistake',
      style_prompt: options.stylePrompt || 'highest quality, professional sketch, monochrome',
    };

    logger.info(`Generating subject illustration for user: ${userId}`);
    const response = await this.makeRequest<IllustrationResponse>(
      '/v1/images/subject',
      request
    );

    if (!response.data || !response.data[0] || !response.data[0].s3_uri) {
      throw new Error('Invalid response from illustration service: missing S3 URI');
    }

    const s3Uri = response.data[0].s3_uri;
    logger.info(`Subject illustration generated: ${s3Uri}`);
    
    // Convert S3 URI to pre-signed URL for viewing
    const presignedUrl = await s3Client.convertS3UriToPresignedUrl(s3Uri);
    logger.info(`Generated pre-signed URL for subject illustration`);
    return presignedUrl;
  }

  /**
   * Check if the illustration service is healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/health/`, {
        timeout: 2000,
      });
      return response.status === 200;
    } catch (error) {
      logger.error('Illustration service health check failed:', error);
      return false;
    }
  }

  /**
   * Convert S3 URI to public URL
   * The illustration service returns S3 URIs like s3://bucket/key
   * We need to convert them to public URLs for the frontend
   */
  convertS3UriToPublicUrl(s3Uri: string): string {
    if (!s3Uri.startsWith('s3://')) {
      return s3Uri; // Already a public URL
    }

    // Extract bucket and key from S3 URI
    const s3Path = s3Uri.replace('s3://', '');
    const [bucket, ...keyParts] = s3Path.split('/');
    const key = keyParts.join('/');

    // Convert to public S3 URL
    return `https://${bucket}.s3.amazonaws.com/${key}`;
  }
}

// Export singleton instance
export const illustrationService = new IllustrationService();
