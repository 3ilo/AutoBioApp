import logger from '../../utils/logger';
import { IUser } from '../../../../shared/types/User';
import { MemoryData, PromptEnhancementService } from '../promptEnhancementService';

/**
 * Stub service for prompt enhancement in dev/stub mode
 * Returns mock enhanced prompts without complex processing
 */
export class PromptEnhancementStubService implements PromptEnhancementService {
  async createEnhancedPrompt(
    currentMemory: MemoryData,
    user: IUser,
    memorySummary: string
  ): Promise<string> {
    // Stub service - return simple mock enhanced prompt
    const dateStr = new Date(currentMemory.date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    
    const mockPrompt = `Create an illustration for "${currentMemory.title}" from ${dateStr}. ${currentMemory.content.substring(0, 200)}...`;
    return mockPrompt;
  }
}

// Export singleton instance
export const promptEnhancementStubService = new PromptEnhancementStubService();

