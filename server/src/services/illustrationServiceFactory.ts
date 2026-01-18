import { IIllustrationService } from './interfaces/IIllustrationService';
import { IllustrationOrchestratorService } from './illustrationOrchestratorService';
import { openAIImageGenerator } from './imageGenerators/openAIImageGenerator';
import { sdxlImageGenerator } from './imageGenerators/sdxlImageGenerator';
import { stubImageGenerator } from './imageGenerators/stubImageGenerator';
import { bedrockMemorySummaryService } from './memorySummarizers/memorySummaryService';
import { memorySummaryStubService } from './stubs/memorySummaryStubService';
import { bedrockContextSummarizationService } from './contextSummarizers/summarizationService';
import { contextSummarizationStubService } from './stubs/summarizationStubService';
import { openAIPromptBuilder } from './promptBuilders/openaiPromptBuilder';
import { sdxlPromptBuilder } from './promptBuilders/sdxlPromptBuilder';
import { stubPromptBuilder } from './promptBuilders/stubPromptBuilder';
import logger from '../utils/logger';

export type IllustrationProvider = 'sdxl' | 'openai' | 'stub';

/**
 * Get the configured illustration provider from environment
 */
export function getConfiguredProvider(): IllustrationProvider {
  const useStubIllustration = process.env.USE_STUB_ILLUSTRATION === 'true';
  const useStub = process.env.USE_STUB === 'true';
  
  if (useStub) {
    return 'stub';
  }

  const provider = process.env.ILLUSTRATION_PROVIDER?.toLowerCase();
  
  if (provider === 'openai') {
    return 'openai';
  }
  
  return 'sdxl';
}

// Cache for orchestrator instance
let orchestratorInstance: IIllustrationService | null = null;

/**
 * Factory function to get the illustration orchestrator service.
 * The orchestrator manages context summarizers, prompt builders, and image generators.
 */
export function getIllustrationService(): IIllustrationService {
  if (!orchestratorInstance) {
    orchestratorInstance = createOrchestratorService();
  }
  
  return orchestratorInstance;
}

/**
 * Create orchestrator service with appropriate dependencies
 */
function createOrchestratorService(): IIllustrationService {
  const provider = getConfiguredProvider();
  
  // Select image generator
  const useStubIllustration = process.env.USE_STUB_ILLUSTRATION === 'true';
  const useStub = process.env.USE_STUB === 'true';
  
  let imageGenerator;
  let promptBuilder;
  
  if (useStubIllustration || useStub) {
    imageGenerator = stubImageGenerator;
    logger.info('Orchestrator: Using stub image generator');
  } else if (provider === 'openai') {
    imageGenerator = openAIImageGenerator;
    logger.info('Orchestrator: Using OpenAI image generator with structured prompts', {
      model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1.5'
    });
  } else {
    imageGenerator = sdxlImageGenerator;
    logger.info('Orchestrator: Using SDXL image generator', {
      serviceUrl: process.env.ILLUSTRATION_SERVICE_URL || 'http://localhost:8000'
    });
  }

  // Select summarization services 
  const useStubMemorySummary = useStub || process.env.USE_STUB_MEMORY_SUMMARY === 'true';
  const useStubContextSummarization = useStub || process.env.USE_STUB_SUMMARIZATION === 'true';
  
  const memorySummaryService = useStubMemorySummary 
    ? memorySummaryStubService 
    : bedrockMemorySummaryService;
    
  const contextSummarizationService = useStubContextSummarization
    ? contextSummarizationStubService
    : bedrockContextSummarizationService;

  logger.debug('Orchestrator: Service configuration', {
    imageGenerator: imageGenerator.constructor.name,
    memorySummaryService: memorySummaryService.constructor.name,
    contextSummarizationService: contextSummarizationService.constructor.name
  });

  // Select prompt builder
  const useStubPromptBuilder = useStub || process.env.USE_STUB_PROMPT_BUILDER === 'true';
  if (useStubPromptBuilder) {
    promptBuilder = stubPromptBuilder;
    logger.info('Orchestrator: Using stub prompt builder');
  } else if (provider === 'openai') {
    promptBuilder = openAIPromptBuilder;
    logger.info('Orchestrator: Using OpenAI prompt builder');
  } else {
    promptBuilder = sdxlPromptBuilder;
    logger.info('Orchestrator: Using SDXL prompt builder');
  }

  logger.debug('Orchestrator: Prompt builder configuration', {
    promptBuilder: promptBuilder.constructor.name,
  });

  return new IllustrationOrchestratorService(
    imageGenerator,
    memorySummaryService,
    contextSummarizationService,
    promptBuilder
  );
}

/**
 * Check if a specific provider is available/healthy
 */
export async function isProviderHealthy(provider?: IllustrationProvider): Promise<boolean> {
  const orchestrator = createOrchestratorService();
  return orchestrator.checkHealth();
}

/**
 * Get information about all available providers and their status
 */
export async function getProviderStatus(): Promise<{
  configured: IllustrationProvider;
  providers: Record<IllustrationProvider, { available: boolean; healthy: boolean; enabled: boolean }>;
}> {
  const configured = getConfiguredProvider();
  
  const [stubHealthy, openaiHealthy, sdxlHealthy] = await Promise.all([
    stubImageGenerator.checkHealth().catch(() => false),
    openAIImageGenerator.checkHealth().catch(() => false),
    sdxlImageGenerator.checkHealth().catch(() => false),
  ]);

  return {
    configured,
    providers: {
      stub: { 
        available: true, 
        healthy: stubHealthy,
        enabled: process.env.USE_STUB_ILLUSTRATION === 'true' || process.env.USE_STUB === 'true'
      },
      openai: { 
        available: !!process.env.OPENAI_API_KEY, 
        healthy: openaiHealthy,
        enabled: configured === 'openai'
      },
      sdxl: { 
        available: !!process.env.ILLUSTRATION_SERVICE_URL, 
        healthy: sdxlHealthy,
        enabled: configured === 'sdxl'
      },
    },
  };
}
