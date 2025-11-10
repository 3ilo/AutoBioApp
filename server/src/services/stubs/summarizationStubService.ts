import logger from '../../utils/logger';
import { IMemory } from '../../../../shared/types/Memory';
import { IUser } from '../../../../shared/types/User';
import { SummarizationService, SummarizationConfig } from '../summarizationService';

/**
 * Stub service for memory summarization in dev/stub mode
 * Returns mock summaries without actually calling AWS Bedrock
 */
export class SummarizationStubService implements SummarizationService {
  async summarizeMemories(
    memories: IMemory[],
    user: IUser,
    config: SummarizationConfig,
    currentMemoryPrompt: string,
    currentMemoryTitle: string
  ): Promise<string> {
    // Stub service - return simple mock summary
    const mockSummary = `I experienced ${currentMemoryTitle.toLowerCase()} with ${memories.length > 0 ? 'recent context' : 'no prior context'}.`;
    return mockSummary;
  }
}

// Export singleton instance
export const summarizationStubService = new SummarizationStubService();

