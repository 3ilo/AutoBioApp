/**
 * Base options for generating memory illustrations (common across providers)
 */
export interface BaseMemoryIllustrationOptions {
  /** Negative prompt to avoid unwanted elements */
  negativePrompt?: string;
  /** Style prompt for consistent aesthetics */
  stylePrompt?: string;
}

/**
 * Base options for generating subject illustrations (common across providers)
 */
export interface BaseSubjectIllustrationOptions {
  /** Negative prompt to avoid unwanted elements */
  negativePrompt?: string;
  /** Style prompt for consistent aesthetics */
  stylePrompt?: string;
}

/**
 * SDXL-specific options for memory illustrations
 */
export interface SDXLMemoryIllustrationOptions extends BaseMemoryIllustrationOptions {
  /** Number of inference steps */
  numInferenceSteps?: number;
  /** IP adapter scale for subject consistency */
  ipAdapterScale?: number;
  /** LoRA ID for custom fine-tuned styles */
  loraId?: string;
}

/**
 * SDXL-specific options for subject illustrations
 */
export interface SDXLSubjectIllustrationOptions extends BaseSubjectIllustrationOptions {
  /** Number of inference steps */
  numInferenceSteps?: number;
  /** IP adapter scale for subject consistency */
  ipAdapterScale?: number;
  /** LoRA ID for custom fine-tuned styles */
  loraId?: string;
}

/**
 * OpenAI-specific options for memory illustrations
 */
export interface OpenAIMemoryIllustrationOptions extends BaseMemoryIllustrationOptions {
  /** OpenAI model to use (default: gpt-image-1.5) */
  model?: string;
  /** Image size (default: 1024x1024) */
  size?: string;
  /** Image quality: 'low' | 'high' (default: 'low') */
  quality?: 'low' | 'high';
  /** Memory title for context-aware prompt building */
  memoryTitle?: string;
  /** Memory content (raw, unenhanced) for context-aware prompt building */
  memoryContent?: string;
  /** Memory date for context-aware prompt building */
  memoryDate?: Date | string;
}

/**
 * OpenAI-specific options for subject illustrations
 */
export interface OpenAISubjectIllustrationOptions extends BaseSubjectIllustrationOptions {
  /** OpenAI model to use (default: gpt-image-1.5) */
  model?: string;
  /** Image size (default: 1024x1024) */
  size?: string;
  /** Image quality: 'low' | 'high' (default: 'low') */
  quality?: 'low' | 'high';
}

/**
 * Type alias for backward compatibility - use provider-specific types instead
 * @deprecated Use SDXLMemoryIllustrationOptions or OpenAIMemoryIllustrationOptions
 */
export type MemoryIllustrationOptions = SDXLMemoryIllustrationOptions | OpenAIMemoryIllustrationOptions;

/**
 * Type alias for backward compatibility - use provider-specific types instead
 * @deprecated Use SDXLSubjectIllustrationOptions or OpenAISubjectIllustrationOptions
 */
export type SubjectIllustrationOptions = SDXLSubjectIllustrationOptions | OpenAISubjectIllustrationOptions;

/**
 * Abstract interface for illustration generation services.
 * Implementations include:
 * - SDXLIllustrationService: Self-hosted SDXL with IP-Adapter
 * - OpenAIIllustrationService: OpenAI gpt-image-1.5
 * - IllustrationStubService: Dev/test stub
 * 
 * Note: Concrete implementations should extend this interface with provider-specific option types.
 */
export interface IIllustrationService {
  /**
   * Generate a memory illustration based on the memory content and user context.
   * Uses the user's canonical reference image to maintain subject fidelity.
   * 
   * @param userId - The user's ID for fetching reference image and context
   * @param prompt - The enhanced prompt describing the memory scene
   * @param options - Provider-specific generation options (implementations extend base options)
   * @returns S3 URI of the generated illustration
   */
  generateMemoryIllustration(
    userId: string,
    prompt: string,
    options?: BaseMemoryIllustrationOptions
  ): Promise<string>;

  /**
   * Generate a subject illustration (avatar/portrait) for the user.
   * Creates a stylized illustration of the user based on their reference photo.
   * 
   * @param userId - The user's ID for fetching the source photo
   * @param options - Provider-specific generation options (implementations extend base options)
   * @returns Pre-signed URL or S3 URI of the generated illustration
   */
  generateSubjectIllustration(
    userId: string,
    options?: BaseSubjectIllustrationOptions
  ): Promise<string>;

  /**
   * Check if the illustration service is healthy and ready to accept requests.
   * 
   * @returns true if the service is healthy, false otherwise
   */
  checkHealth(): Promise<boolean>;
}

