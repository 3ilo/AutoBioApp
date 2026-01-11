import { IIllustrationService } from './interfaces/IIllustrationService';
import { IllustrationService, illustrationService } from './illustrationService';
import { OpenAIIllustrationService, openAIIllustrationService } from './openai/openAIIllustrationService';
import { IllustrationStubService, illustrationStubService } from './stubs/illustrationStubService';
import logger from '../utils/logger';

/**
 * Supported illustration providers
 */
export type IllustrationProvider = 'sdxl' | 'openai' | 'stub';

/**
 * Get the configured illustration provider from environment
 */
export function getConfiguredProvider(): IllustrationProvider {
  // Check individual stub flag first, then master USE_STUB flag
  const useStubIllustration = process.env.USE_STUB_ILLUSTRATION === 'true';
  const useStub = process.env.USE_STUB === 'true';
  
  if (useStubIllustration || useStub) {
    return 'stub';
  }

  const provider = process.env.ILLUSTRATION_PROVIDER?.toLowerCase();
  
  if (provider === 'openai') {
    return 'openai';
  }
  
  // Default to SDXL for backward compatibility
  return 'sdxl';
}

/**
 * Factory function to get the appropriate illustration service based on configuration.
 * 
 * Priority:
 * 1. USE_STUB_ILLUSTRATION=true or USE_STUB=true -> StubService (for development/testing)
 * 2. ILLUSTRATION_PROVIDER=openai -> OpenAIIllustrationService
 * 3. Default -> IllustrationService (SDXL)
 * 
 * @returns The configured illustration service implementation
 */
export function getIllustrationService(): IIllustrationService {
  const provider = getConfiguredProvider();
  
  logger.debug('Getting illustration service', { provider });
  
  switch (provider) {
    case 'stub':
      logger.info('Using stub illustration service');
      return illustrationStubService;
    
    case 'openai':
      logger.info('Using OpenAI illustration service', { 
        model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1.5' 
      });
      return openAIIllustrationService;
    
    case 'sdxl':
    default:
      logger.info('Using SDXL illustration service', {
        serviceUrl: process.env.ILLUSTRATION_SERVICE_URL || 'http://localhost:8000'
      });
      return illustrationService;
  }
}

/**
 * Check if a specific provider is available/healthy
 */
export async function isProviderHealthy(provider?: IllustrationProvider): Promise<boolean> {
  const targetProvider = provider || getConfiguredProvider();
  
  switch (targetProvider) {
    case 'stub':
      return illustrationStubService.checkHealth();
    
    case 'openai':
      return openAIIllustrationService.checkHealth();
    
    case 'sdxl':
    default:
      return illustrationService.checkHealth();
  }
}

/**
 * Get information about all available providers and their status
 */
export async function getProviderStatus(): Promise<{
  configured: IllustrationProvider;
  providers: Record<IllustrationProvider, { available: boolean; healthy: boolean, enabled: boolean }>;
}> {
  const configured = getConfiguredProvider();
  
  const [stubHealthy, openaiHealthy, sdxlHealthy] = await Promise.all([
    illustrationStubService.checkHealth().catch(() => false),
    openAIIllustrationService.checkHealth().catch(() => false),
    illustrationService.checkHealth().catch(() => false),
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

