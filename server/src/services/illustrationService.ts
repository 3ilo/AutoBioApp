import axios, { AxiosResponse } from 'axios';
import { s3Client } from '../utils/s3Client';
import logger from '../utils/logger';
import { 
  IIllustrationService, 
  BaseMemoryIllustrationOptions,
  BaseSubjectIllustrationOptions,
  SDXLMemoryIllustrationOptions,
  SDXLSubjectIllustrationOptions
} from './interfaces/IIllustrationService';

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
  lora_id?: string;
}

interface GenerateSubjectIllustrationRequest {
  user_id: string;
  num_inference_steps?: number;
  ip_adapter_scale?: number;
  negative_prompt?: string;
  style_prompt?: string;
  lora_id?: string;
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

interface TrainLoRARequest {
  user_id: string;
  training_images_s3_path: string;
  lora_name?: string;
  learning_rate?: number;
  num_train_epochs?: number;
  lora_rank?: number;
  lora_alpha?: number;
}

interface TrainLoRAResponse {
  job_id: string;
  status: string;
  lora_id?: string;
  lora_s3_uri?: string;
}

interface TrainingStatusResponse {
  job_id: string;
  status: string;
  lora_id?: string;
  lora_s3_uri?: string;
  error_message?: string;
}

export class IllustrationService implements IIllustrationService {
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
    method: 'POST' = 'POST',
    timeout: number = 120000 // Default 2 minutes for image generation
  ): Promise<T> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      logger.debug('Making request to illustration service', { method, endpoint, timeout });

      const response: AxiosResponse<T> = await axios({
        method,
        url,
        data,
        headers: this.getHeaders(),
        timeout,
      });

      logger.debug('Illustration service response received', { status: response.status, endpoint });
      return response.data;
    } catch (error: any) {
      logger.error('Illustration service request failed', { 
        endpoint, 
        method,
        statusCode: error.response?.status,
        error: error.message 
      });

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
   * Returns S3 URI for database storage
   */
  async generateMemoryIllustration(
    userId: string,
    prompt: string,
    options: BaseMemoryIllustrationOptions = {}
  ): Promise<string> {
    const sdxlOptions = options as SDXLMemoryIllustrationOptions;
    const request: GenerateMemoryIllustrationRequest = {
      user_id: userId,
      prompt,
      num_inference_steps: sdxlOptions.numInferenceSteps || 50,
      ip_adapter_scale: sdxlOptions.ipAdapterScale || 0.33,
      negative_prompt: sdxlOptions.negativePrompt || 'error, glitch, mistake',
      style_prompt: sdxlOptions.stylePrompt || 'highest quality, monochrome, professional sketch, personal, nostalgic, clean',
    };

    if (sdxlOptions.loraId) {
      request.lora_id = sdxlOptions.loraId;
    }

    logger.debug('Generating memory illustration', { userId, promptLength: prompt.length, loraId: sdxlOptions.loraId });
    const response = await this.makeRequest<IllustrationResponse>(
      '/v1/images/memory',
      request
    );

    if (!response.data || !response.data[0] || !response.data[0].s3_uri) {
      throw new Error('Invalid response from illustration service: missing S3 URI');
    }

    const s3Uri = response.data[0].s3_uri;
    logger.info('Memory illustration generated', { userId, s3Uri, loraId: sdxlOptions.loraId });
    return s3Uri;
  }

  /**
   * Generate a subject illustration using the user's uploaded photo
   */
  async generateSubjectIllustration(
    userId: string,
    options: BaseSubjectIllustrationOptions = {}
  ): Promise<string> {
    const sdxlOptions = options as SDXLSubjectIllustrationOptions;
    const request: GenerateSubjectIllustrationRequest = {
      user_id: userId,
      num_inference_steps: sdxlOptions.numInferenceSteps || 50,
      ip_adapter_scale: sdxlOptions.ipAdapterScale || 0.33,
      negative_prompt: sdxlOptions.negativePrompt || 'error, glitch, mistake',
      style_prompt: sdxlOptions.stylePrompt || 'highest quality, professional sketch, monochrome',
    };

    if (sdxlOptions.loraId) {
      request.lora_id = sdxlOptions.loraId;
    }

    logger.debug('Generating subject illustration', { userId, loraId: sdxlOptions.loraId });
    const response = await this.makeRequest<IllustrationResponse>(
      '/v1/images/subject',
      request
    );

    if (!response.data || !response.data[0] || !response.data[0].s3_uri) {
      throw new Error('Invalid response from illustration service: missing S3 URI');
    }

    const s3Uri = response.data[0].s3_uri;
    logger.info('Subject illustration generated', { userId, s3Uri, loraId: sdxlOptions.loraId });
    
    // Convert S3 URI to pre-signed URL for viewing
    const presignedUrl = await s3Client.convertS3UriToPresignedUrl(s3Uri);
    return presignedUrl;
  }

  /**
   * Start a LoRA training job asynchronously
   * Returns immediately with job_id
   */
  async trainLoRA(
    userId: string,
    trainingImagesS3Path: string,
    options: {
      loraName?: string;
      learningRate?: number;
      numTrainEpochs?: number;
      loraRank?: number;
      loraAlpha?: number;
    } = {}
  ): Promise<TrainLoRAResponse> {
    const request: TrainLoRARequest = {
      user_id: userId,
      training_images_s3_path: trainingImagesS3Path,
      lora_name: options.loraName,
      learning_rate: options.learningRate,
      num_train_epochs: options.numTrainEpochs,
      lora_rank: options.loraRank,
      lora_alpha: options.loraAlpha,
    };

    logger.info('Starting LoRA training job', { userId, trainingImagesS3Path });
    const response = await this.makeRequest<TrainLoRAResponse>(
      '/v1/images/train-lora',
      request,
      'POST',
      30000 // 30 seconds timeout (should return immediately)
    );

    logger.info('LoRA training job started', { userId, jobId: response.job_id, status: response.status });
    return response;
  }

  /**
   * Get the status of a training job
   */
  async getTrainingStatus(jobId: string): Promise<TrainingStatusResponse> {
    try {
      const url = `${this.baseUrl}/v1/images/train-lora/${jobId}`;
      logger.debug('Getting training status', { jobId });

      const response: AxiosResponse<TrainingStatusResponse> = await axios({
        method: 'GET',
        url,
        headers: this.getHeaders(),
        timeout: 10000, // 10 seconds timeout
      });

      logger.debug('Training status received', { jobId, status: response.data.status });
      return response.data;
    } catch (error: any) {
      logger.error('Failed to get training status', {
        jobId,
        statusCode: error.response?.status,
        error: error.message,
      });

      const serviceError: IllustrationServiceError = new Error(
        `Failed to get training status: ${error.message}`
      );
      serviceError.statusCode = error.response?.status || 500;
      serviceError.service = 'illustration-service';

      throw serviceError;
    }
  }

  /**
   * Check if the illustration service is healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/`, {
        timeout: 2000,
      });
      return response.status === 200;
    } catch (error) {
      logger.warn('Illustration service health check failed', { error: (error as Error).message });
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
