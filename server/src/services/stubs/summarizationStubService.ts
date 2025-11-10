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
    logger.info(`[STUB] Generating memory summary for user: ${user._id}`);
    logger.info(`[STUB] Processing ${memories.length} memories`);
    logger.info(`[STUB] Current memory: ${currentMemoryTitle}`);
    
    // Return a simple mock summary based on the current memory
    const mockSummary = `I experienced ${currentMemoryTitle.toLowerCase()} with ${memories.length > 0 ? 'recent context' : 'no prior context'}.`;
    
    logger.info(`[STUB] Generated mock summary: ${mockSummary.substring(0, 100)}...`);
    return mockSummary;
  }
}

// Export singleton instance
export const summarizationStubService = new SummarizationStubService();

