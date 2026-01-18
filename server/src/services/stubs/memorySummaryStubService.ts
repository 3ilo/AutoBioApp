import logger from '../../utils/logger';
import { IMemory } from '../../../../shared/types/Memory';
import { IUser } from '../../../../shared/types/User';
import { MemorySummaryService, MemorySummaryConfig } from '../memorySummarizers/memorySummaryService';

/**
 * Stub service for individual memory summaries in dev/stub mode
 * Returns mock summaries without actually calling AWS Bedrock
 */
export class MemorySummaryStubService implements MemorySummaryService {
  async generateMemorySummary(
    memory: IMemory,
    user: IUser,
    config: MemorySummaryConfig
  ): Promise<string> {
    // Stub service - return simple mock summary
    const dateStr = new Date(memory.date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    
    const mockSummary = config.summaryLength === 'detailed'
      ? `This is a detailed summary of the memory "${memory.title}" from ${dateStr}. The memory contains information about ${memory.content.substring(0, 50)}...`
      : `Memory about ${memory.title} from ${dateStr}`;
    
    return mockSummary;
  }
}

// Export singleton instance
export const memorySummaryStubService = new MemorySummaryStubService();

