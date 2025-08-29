import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { IMemory } from '../../../shared/types/Memory';
import { IUser } from '../../../shared/types/User';
import logger from '../utils/logger';

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
    config: SummarizationConfig
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
    this.bedrockClient = new BedrockRuntimeClient({
      region: this.BEDROCK_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
    this.cache = new Map();
  }

  async summarizeMemories(
    memories: IMemory[],
    user: IUser,
    config: SummarizationConfig
  ): Promise<string> {
    try {
      // Return empty string if no memories
      if (!memories || memories.length === 0) {
        return '';
      }

      // Limit memories to maxMemories
      const limitedMemories = memories.slice(0, config.maxMemories);

      // Check cache first
      const cacheKey = this.getCacheKey(limitedMemories, user, config);
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        logger.info('Using cached memory summary');
        return cached.summary;
      }

      // Generate summary using pre-generated memory summaries
      const summary = await this.generateSummaryFromSummaries(limitedMemories, user, config);

      // Cache the result
      this.cache.set(cacheKey, {
        summary,
        timestamp: Date.now(),
      });

      return summary;
    } catch (error) {
      logger.error('Error in summarizeMemories:', error);
      throw error;
      // return 'no recent memories available';
    }
  }

  private async generateSummaryFromSummaries(
    memories: IMemory[],
    user: IUser,
    config: SummarizationConfig
  ): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(user, config);
    const userMessage = this.buildUserMessage(memories);

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
    
    logger.info(`Generated memory summaries aggregation: ${summary}`);
    return summary;
  }

  private buildSystemPrompt(
    user: IUser,
    config: SummarizationConfig
  ): string {
    const userContext = this.getUserContextString(user);
    const lengthInstruction = this.getLengthInstruction(config.summaryLength);

    return `You are an AI assistant helping to summarize a user's recent memories for image generation context. 

User Context:
${userContext}

Your task is to provide ${lengthInstruction} summaries of memories that capture the user's recent experiences, interests, and activities. Focus on themes, patterns, and emotional context that would be relevant for creating personalized images.

The summary should be written in third person and should help an image generation AI understand the user's lifestyle, interests, and recent experiences.`;
  }

  private buildUserMessage(memories: IMemory[]): string {
    const memorySummaries = memories
      .map((memory, index) => {
        const summary = memory.summary || `Memory about ${memory.title} from ${new Date(memory.date).toLocaleDateString()}`;
        return `${index + 1}. ${memory.title}: ${summary}`;
      })
      .join('\n');

    return `Please provide a summary of these recent memories:

Recent Memory Summaries:
${memorySummaries}

Provide a concise one-paragraph summary that captures the user's recent experiences, interests, and activities.`;
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
    config: SummarizationConfig
  ): string {
    const memoryIds = memories.map(m => m._id).sort().join(',');
    const userId = user._id;
    const configHash = `${config.maxMemories}-${config.summaryLength}`;
    
    return `summary:${userId}:${memoryIds}:${configHash}`;
  }
}
