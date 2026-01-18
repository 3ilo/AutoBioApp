import axios from 'axios';
import FormData from 'form-data';
import { 
  IImageGenerator, 
  ImageGenerationInput, 
  ImageGenerationOutput,
  BaseImageGenerationOptions,
  OpenAIImageGenerationOptions
} from '../interfaces/IImageGenerator';
import logger from '../../utils/logger';
import { estimateOpenAIImageCost, formatCost } from '../../utils/costCalculator';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DEFAULT_OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1.5';
const DEFAULT_OPENAI_IMAGE_SIZE = process.env.OPENAI_IMAGE_SIZE || '1024x1024';
const DEFAULT_OPENAI_IMAGE_QUALITY = (process.env.OPENAI_IMAGE_QUALITY || 'low') as 'low' | 'high';

interface OpenAIImageResponse {
  created: number;
  data: Array<{
    b64_json?: string;
    url?: string;
    revised_prompt?: string;
  }>;
}

/**
 * OpenAI image generator implementation.
 * Handles ONLY the OpenAI API call for image generation.
 */
export class OpenAIImageGenerator implements IImageGenerator {
  constructor() {
    if (!OPENAI_API_KEY) {
      logger.warn('OPENAI_API_KEY not configured - OpenAI image generator will fail on requests');
    }
  }

  async generateImage(
    input: ImageGenerationInput,
    options: BaseImageGenerationOptions = {}
  ): Promise<ImageGenerationOutput> {
    const openAIOptions = options as OpenAIImageGenerationOptions;
    const model = openAIOptions.model || DEFAULT_OPENAI_IMAGE_MODEL;
    const size = openAIOptions.size || DEFAULT_OPENAI_IMAGE_SIZE;
    const quality = openAIOptions.quality || DEFAULT_OPENAI_IMAGE_QUALITY;

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    if (!input.referenceImageBase64) {
      throw new Error('Reference image is required for OpenAI image generation');
    }

    logger.debug('Generating image with OpenAI', { 
      userId: input.userId, 
      model, 
      size, 
      quality,
      promptLength: input.prompt.length 
    });

    try {
      const imageBuffer = Buffer.from(input.referenceImageBase64, 'base64');
      const formData = new FormData();
      formData.append('model', model);
      formData.append('image', imageBuffer, {
        filename: 'reference.png',
        contentType: 'image/png',
      });
      formData.append('prompt', input.prompt);
      formData.append('n', '1');
      formData.append('size', size);
      formData.append('quality', quality);

      logger.debug('OpenAI API request params', { model, quality, size });

      const response = await axios.post<OpenAIImageResponse>(
        'https://api.openai.com/v1/images/edits',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            ...formData.getHeaders(),
          },
          timeout: 120000,
        }
      );

      // Log OpenAI API call with cost estimate (note: OpenAI Images API doesn't return token usage in response)
      // Token usage is tracked internally by OpenAI and billed separately
      // We estimate cost based on per-image pricing
      const estimatedCost = estimateOpenAIImageCost(quality, size);
      
      logger.info('OpenAI API call - Image Generation', {
        service: 'OpenAIImageGenerator',
        endpoint: '/v1/images/edits',
        model,
        size,
        quality,
        userId: input.userId,
        promptLength: input.prompt.length,
        cost: {
          estimatedCost: formatCost(estimatedCost),
          note: 'Estimated cost based on per-image pricing. Actual token usage tracked internally by OpenAI.',
        },
      });

      if (!response.data?.data?.[0]?.b64_json) {
        throw new Error('Invalid response from OpenAI API: missing image data');
      }

      const imageBase64 = response.data.data[0].b64_json;
      const revisedPrompt = response.data.data[0].revised_prompt;

      logger.info('Image generated successfully with OpenAI', { 
        userId: input.userId,
        hasRevisedPrompt: !!revisedPrompt 
      });

      return {
        imageBase64,
        revisedPrompt,
      };
    } catch (error) {
      logger.error('Failed to generate image with OpenAI', {
        userId: input.userId,
        error: axios.isAxiosError(error) 
          ? error.response?.data || error.message 
          : (error as Error).message,
      });
      throw error;
    }
  }

  async checkHealth(): Promise<boolean> {
    return !!OPENAI_API_KEY;
  }
}

export const openAIImageGenerator = new OpenAIImageGenerator();

