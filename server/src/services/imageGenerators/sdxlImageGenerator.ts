import axios from 'axios';
import { 
  IImageGenerator, 
  ImageGenerationInput, 
  ImageGenerationOutput,
  BaseImageGenerationOptions,
  SDXLImageGenerationOptions
} from '../interfaces/IImageGenerator';
import { s3Client } from '../../utils/s3Client';
import logger from '../../utils/logger';

const ILLUSTRATION_SERVICE_URL = process.env.ILLUSTRATION_SERVICE_URL || 'http://localhost:8000';
const ILLUSTRATION_SERVICE_AUTH_TOKEN = process.env.ILLUSTRATION_SERVICE_AUTH_TOKEN;

interface GenerateMemoryIllustrationRequest {
  user_id: string;
  prompt: string;
  num_inference_steps?: number;
  ip_adapter_scale?: number;
  negative_prompt?: string;
  style_prompt?: string;
  lora_id?: string;
}

interface IllustrationResponse {
  data: Array<{
    s3_uri: string;
    base64?: string;
  }>;
}

/**
 * SDXL image generator implementation.
 * Handles ONLY the SDXL API call for image generation.
 */
export class SDXLImageGenerator implements IImageGenerator {
  private baseUrl: string;
  private authToken?: string;

  constructor() {
    this.baseUrl = ILLUSTRATION_SERVICE_URL;
    this.authToken = ILLUSTRATION_SERVICE_AUTH_TOKEN;
  }

  async generateImage(
    input: ImageGenerationInput,
    options: BaseImageGenerationOptions = {}
  ): Promise<ImageGenerationOutput> {
    const sdxlOptions = options as SDXLImageGenerationOptions;
    
    if (!input.userId) {
      throw new Error('userId is required for SDXL image generation');
    }

    const request: GenerateMemoryIllustrationRequest = {
      user_id: input.userId,
      prompt: input.prompt,
      num_inference_steps: sdxlOptions.numInferenceSteps || 50,
      ip_adapter_scale: sdxlOptions.ipAdapterScale || 0.33,
      negative_prompt: sdxlOptions.negativePrompt || 'error, glitch, mistake',
      style_prompt: sdxlOptions.stylePrompt || 'highest quality, monochrome, professional sketch, personal, nostalgic, clean',
    };

    if (sdxlOptions.loraId) {
      request.lora_id = sdxlOptions.loraId;
    }

    logger.debug('Generating image with SDXL', { 
      userId: input.userId, 
      promptLength: input.prompt.length,
      loraId: sdxlOptions.loraId 
    });

    try {
      const response = await this.makeRequest<IllustrationResponse>(
        '/v1/images/memory',
        request
      );

      if (!response.data || !response.data[0]) {
        throw new Error('Invalid response from SDXL service: missing image data');
      }

      const imageData = response.data[0];
      
      if (imageData.base64) {
        return {
          imageBase64: imageData.base64,
        };
      }

      if (imageData.s3_uri) {
        const s3Uri = imageData.s3_uri;
        logger.debug('SDXL returned S3 URI, fetching image', { s3Uri });
        
        const s3UriPattern = /^s3:\/\/([^\/]+)\/(.+)$/;
        const match = s3Uri.match(s3UriPattern);
        
        if (!match) {
          throw new Error(`Invalid S3 URI format from SDXL service: ${s3Uri}`);
        }
        
        const [, bucket, key] = match;
        const imageBase64 = await s3Client.getObjectAsBase64(bucket, key);
        
        return {
          imageBase64,
        };
      }

      throw new Error('SDXL service must return either base64 or s3_uri');
    } catch (error) {
      logger.error('Failed to generate image with SDXL', {
        userId: input.userId,
        error: axios.isAxiosError(error) 
          ? error.response?.data || error.message 
          : (error as Error).message,
      });
      throw error;
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    data: any,
    method: 'POST' = 'POST',
    timeout: number = 120000
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    try {
      const response = await axios.request<T>({
        method,
        url,
        data,
        headers,
        timeout,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error || error.message;
        logger.error('SDXL service request failed', {
          url,
          status: error.response?.status,
          error: errorMessage,
        });
        throw new Error(`SDXL service error: ${errorMessage}`);
      }
      throw error;
    }
  }

  async checkHealth(): Promise<boolean> {
    if (!ILLUSTRATION_SERVICE_URL) {
      return false;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/health`, { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      logger.warn('SDXL health check failed', { error: (error as Error).message });
      return false;
    }
  }
}

export const sdxlImageGenerator = new SDXLImageGenerator();

