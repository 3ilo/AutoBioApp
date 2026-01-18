/**
 * Options for image generation (common across providers)
 */
export interface BaseImageGenerationOptions {
  /** Negative prompt to avoid unwanted elements */
  negativePrompt?: string;
  /** Style prompt for consistent aesthetics */
  stylePrompt?: string;
}

/**
 * OpenAI-specific image generation options
 */
export interface OpenAIImageGenerationOptions extends BaseImageGenerationOptions {
  /** OpenAI model to use (default: gpt-image-1.5) */
  model?: string;
  /** Image size (default: 1024x1024) */
  size?: string;
  /** Image quality: 'low' | 'high' (default: 'low') */
  quality?: 'low' | 'high';
}

/**
 * SDXL-specific image generation options
 */
export interface SDXLImageGenerationOptions extends BaseImageGenerationOptions {
  /** Number of inference steps */
  numInferenceSteps?: number;
  /** IP adapter scale for subject consistency */
  ipAdapterScale?: number;
  /** LoRA ID for custom fine-tuned styles */
  loraId?: string;
}

/**
 * Input for image generation
 */
export interface ImageGenerationInput {
  /** The prompt describing what to generate */
  prompt: string;
  /** Reference image in base64 format (for subject consistency) */
  referenceImageBase64?: string;
  /** User ID for context (optional, may be used for logging or caching) */
  userId?: string;
}

/**
 * Output from image generation
 */
export interface ImageGenerationOutput {
  /** Generated image in base64 format */
  imageBase64: string;
  /** Optional revised prompt (if the generator modified the prompt) */
  revisedPrompt?: string;
}

/**
 * Abstract interface for image generation services.
 * These services are responsible ONLY for generating images from prompts.
 * They do NOT handle:
 * - Memory summarization
 * - Prompt building
 * - S3 uploads
 * - User context
 * 
 * Implementations:
 * - OpenAIImageGenerator: OpenAI gpt-image-1.5
 * - SDXLImageGenerator: Self-hosted SDXL with IP-Adapter
 * - StubImageGenerator: Dev/test stub
 */
export interface IImageGenerator {
  /**
   * Generate an image from a prompt and optional reference image.
   * 
   * @param input - Image generation input (prompt, reference image, etc.)
   * @param options - Provider-specific generation options
   * @returns Generated image data
   */
  generateImage(
    input: ImageGenerationInput,
    options?: BaseImageGenerationOptions
  ): Promise<ImageGenerationOutput>;

  /**
   * Check if the image generator is healthy and ready to accept requests.
   * 
   * @returns true if the service is healthy, false otherwise
   */
  checkHealth(): Promise<boolean>;
}

