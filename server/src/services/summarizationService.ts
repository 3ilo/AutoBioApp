import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { IMemory } from '../../../shared/types/Memory';
import { IUser } from '../../../shared/types/User';
import logger from '../utils/logger';
import { getAwsClientConfig } from '../utils/env';

// Configuration interface for summarization
export interface SummarizationConfig {
  maxMemories: number;
  summaryLength: 'sentence' | 'paragraph' | 'detailed';
}

// Interface for summarization service
export interface SummarizationService {
  summarizeMemories(
    memories: IMemory[],
    user: IUser,
    config: SummarizationConfig,
    currentMemoryPrompt: string,
    currentMemoryTitle: string
  ): Promise<string>;
}

// Bedrock implementation of summarization service
export class BedrockSummarizationService implements SummarizationService {
  private bedrockClient: BedrockRuntimeClient;
  private cache: Map<string, { summary: string; timestamp: number }>;
  private readonly CACHE_TTL = 3600000; // 1 hour in milliseconds
  private readonly SUMMARY_MODEL_ID = process.env.BEDROCK_SUMMARY_MODEL_ID || 'us.amazon.nova-micro-v1:0';
  private readonly BEDROCK_REGION = process.env.BEDROCK_CLIENT_REGION || 'us-west-2';

  constructor() {
    // Use centralized AWS client configuration
    // Automatically handles credentials for local vs serverless (dev/prod)
    this.bedrockClient = new BedrockRuntimeClient(getAwsClientConfig(this.BEDROCK_REGION));
    this.cache = new Map();
  }

  async summarizeMemories(
    memories: IMemory[],
    user: IUser,
    config: SummarizationConfig,
    currentMemoryPrompt: string,
    currentMemoryTitle: string
  ): Promise<string> {
    try {
      // Return empty string if no memories
      if (!memories || memories.length === 0) {
        return '';
      }

      // Limit memories to maxMemories
      const limitedMemories = memories.slice(0, config.maxMemories);

      // Check cache first
      const cacheKey = this.getCacheKey(limitedMemories, user, config, currentMemoryPrompt, currentMemoryTitle);
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        logger.debug('Using cached memory summary', { userId: user._id });
        return cached.summary;
      }

      // Generate summary using pre-generated memory summaries
      const summary = await this.generateSummaryFromSummaries(limitedMemories, user, config, currentMemoryPrompt, currentMemoryTitle);

      // Cache the result
      this.cache.set(cacheKey, {
        summary,
        timestamp: Date.now(),
      });

      return summary;
    } catch (error) {
      logger.error('Failed to summarize memories', { 
        userId: user._id, 
        memoryCount: memories.length,
        error: (error as Error).message 
      });
      throw error;
    }
  }

  private async generateSummaryFromSummaries(
    memories: IMemory[],
    user: IUser,
    config: SummarizationConfig,
    currentMemoryPrompt: string,
    currentMemoryTitle: string
  ): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(user, config);
    const userMessage = this.buildUserMessage(memories, currentMemoryPrompt, currentMemoryTitle);

    const command = new ConverseCommand({
      modelId: this.SUMMARY_MODEL_ID,
      messages: [
        {
          role: 'user',
          content: [
            {
              text: userMessage,
            },
          ],
        },
      ],
      system: [
        {
          text: systemPrompt,
        },
      ],
      inferenceConfig: {
        maxTokens: this.getMaxTokens(config.summaryLength),
        temperature: 0.7,
      },
    });

    const response = await this.bedrockClient.send(command);
    
    if (!response.output) {
      throw new Error('No response body from Bedrock');
    }

    const summary = response?.output?.message?.content?.flatMap((content) =>
      content.text ? [content.text] : []
    )
    .join(" ") || 'no recent memories available';
    
    logger.debug('Generated memory summaries aggregation', { 
      summaryLength: summary.length,
      memoryCount: memories.length 
    });
    return summary;
  }

  private buildSystemPrompt(
    user: IUser,
    config: SummarizationConfig
  ): string {
    const userContext = this.getUserContextString(user);
    const lengthInstruction = this.getLengthInstruction(config.summaryLength);

    return `You are an AI assistant helping to distill a specific memory into a simplified description for image generation context.

User Context:
${userContext}

Your task is to distill the current memory into a ${lengthInstruction} description following this structure: I {VERBED} (optional preposition) the {OBJECT} at {PLACE} (optional with {OTHERS}).

Guidelines:
- Focus on ONE scene/element if the memory is complex with multiple scenes
- Any/each part of the sentence structure can be optionally removed if not relevant
- describe the {PLACE} part succinctly based mainly on the details in the memory and the location part of the user context.
- choose the optional OTHERS part based mainly on the details in the memory and supplemented with the recent memory context
- Add limited useful adjectives and qualifiers to any part if it seems important.
- Use the current memory prompt as the primary source
- Use recent memories and user context only for context and support when needed
- Write in first person
- Keep it simple and focused for image generation

The output should be a clean, simple description that captures the essence of the current memory.`;
  }

  private buildUserMessage(memories: IMemory[], currentMemoryPrompt: string, currentMemoryTitle: string): string {
    const memorySummaries = memories
      .map((memory, index) => {
        const summary = memory.summary || `Memory about ${memory.title} from ${new Date(memory.date).toLocaleDateString()}`;
        return `${index + 1}. ${memory.title}: ${summary}`;
      })
      .join('\n');

    return `Current Memory to Distill:
Title: ${currentMemoryTitle}
Content: ${currentMemoryPrompt}

Recent Memory Context (for reference only):
${memorySummaries}

Please distill the current memory into a simple description following the I {VERBED} (optional preposition) the {OBJECT} at {PLACE} (optional with {OTHERS}) structure. Focus primarily on the current memory content and use recent memories only for additional context if needed.`;
  }

  private getUserContextString(user: IUser): string {
    const contextParts: string[] = [];

    if (user.location) contextParts.push(`Location: ${user.location}`);
    if (user.occupation) contextParts.push(`Occupation: ${user.occupation}`);
    if (user.gender) contextParts.push(`Gender: ${user.gender}`);
    if (user.age) contextParts.push(`Age: ${user.age}`);
    if (user.interests && user.interests.length > 0) {
      contextParts.push(`Interests: ${user.interests.join(', ')}`);
    }
    if (user.culturalBackground) contextParts.push(`Cultural Background: ${user.culturalBackground}`);
    if (user.bio) contextParts.push(`Bio: ${user.bio}`);

    return contextParts.length > 0 ? contextParts.join('\n') : 'No additional context available';
  }

  private getLengthInstruction(summaryLength: string): string {
    switch (summaryLength) {
      case 'sentence':
        return 'brief one-sentence';
      case 'detailed':
        return 'detailed multi-paragraph';
      default:
        return 'concise one-paragraph';
    }
  }

  private getMaxTokens(summaryLength: string): number {
    switch (summaryLength) {
      case 'sentence':
        return 100;
      case 'detailed':
        return 500;
      default:
        return 200;
    }
  }

  private getCacheKey(
    memories: IMemory[],
    user: IUser,
    config: SummarizationConfig,
    currentMemoryPrompt: string,
    currentMemoryTitle: string
  ): string {
    const memoryIds = memories.map(m => m._id).sort().join(',');
    const userId = user._id;
    const configHash = `${config.maxMemories}-${config.summaryLength}`;
    const currentMemoryHash = `${currentMemoryTitle}:${currentMemoryPrompt}`.replace(/\s+/g, '_').substring(0, 50);
    
    return `summary:${userId}:${memoryIds}:${configHash}:${currentMemoryHash}`;
  }
}

// Export singleton instance
export const bedrockSummarizationService = new BedrockSummarizationService();
