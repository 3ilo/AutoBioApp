import logger from '../../utils/logger';
import { IMemory } from '../../../../shared/types/Memory';
import { IUser } from '../../../../shared/types/User';
import { ContextSummarizationService, SummarizationConfig } from '../contextSummarizers/summarizationService';

/**
 * Stub service for context summarization in dev/stub mode
 * Returns mock summaries without actually calling AWS Bedrock
 */
export class ContextSummarizationStubService implements ContextSummarizationService {
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

  /**
   * Stub implementation of fetchAndSummarizeRecentMemories
   * Returns a mock summary without fetching from database
   */
  async fetchAndSummarizeRecentMemories(
    userId: string,
    user: IUser,
    currentMemoryContent: string,
    currentMemoryTitle: string,
    options: {
      limit?: number;
      summaryLength?: 'sentence' | 'paragraph' | 'detailed';
    } = {}
  ): Promise<string | undefined> {
    // Stub service - return simple mock summary
    logger.debug('Stub service: Returning mock recent memories summary', { userId });
    return `Recent context: The user has been active with various memories.`;
  }
}

// Export singleton instance
export const contextSummarizationStubService = new ContextSummarizationStubService();

