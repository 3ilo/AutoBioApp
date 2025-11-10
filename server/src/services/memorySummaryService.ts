import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { IMemory } from '../../../shared/types/Memory';
import { IUser } from '../../../shared/types/User';
import logger from '../utils/logger';
import { getAwsClientConfig } from '../utils/env';

// Configuration for individual memory summaries
export interface MemorySummaryConfig {
  summaryLength: 'brief' | 'detailed';
  includeUserContext: boolean;
}

// Interface for memory summary service
export interface MemorySummaryService {
  generateMemorySummary(
    memory: IMemory,
    user: IUser,
    config: MemorySummaryConfig
  ): Promise<string>;
}

// Bedrock implementation for individual memory summaries
export class BedrockMemorySummaryService implements MemorySummaryService {
  private bedrockClient: BedrockRuntimeClient;
  private readonly SUMMARY_MODEL_ID = process.env.BEDROCK_SUMMARY_MODEL_ID || 'amazon.nova-micro-v1:0';
  private readonly BEDROCK_REGION = process.env.BEDROCK_CLIENT_REGION || 'us-west-2';

  constructor() {
    // Use centralized AWS client configuration
    // Automatically handles credentials for local vs serverless (dev/prod)
    this.bedrockClient = new BedrockRuntimeClient(getAwsClientConfig(this.BEDROCK_REGION));
  }

  async generateMemorySummary(
    memory: IMemory,
    user: IUser,
    config: MemorySummaryConfig
  ): Promise<string> {
    try {
      const systemPrompt = this.buildSystemPrompt(user, config);
      const userMessage = this.buildUserMessage(memory);
      const maxTokens = this.getMaxTokens(config.summaryLength);

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
          maxTokens: maxTokens,
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
      .join(" ") || '';
      logger.info('Generated memory summary:', summary);
      return summary;
    } catch (error) {
      logger.error('Error generating memory summary:', error);
      // Return a simple fallback summary
      return `Memory about ${memory.title} from ${new Date(memory.date).toLocaleDateString()}`;
    }
  }

  private buildSystemPrompt(
    user: IUser,
    config: MemorySummaryConfig
  ): string {
    const userContext = config.includeUserContext ? this.getUserContextString(user) : '';
    const lengthInstruction = this.getLengthInstruction(config.summaryLength);

    return `You are an AI assistant creating ${lengthInstruction} summaries of personal memories for context aggregation.

${userContext ? `User Context:
${userContext}

` : ''}Your task is to create ${lengthInstruction} summaries that capture the key themes, emotions, and context of memories. The summaries should be written in third person and focus on elements that would be relevant for understanding the user's experiences and preferences.

Focus on:
- The main activity or event
- Emotional context and significance
- Any notable details or themes
- How it relates to the user's interests or lifestyle`;
  }

  private buildUserMessage(memory: IMemory): string {
    return `Please create a summary of this memory:

Title: ${memory.title}
Content: ${memory.content}
Date: ${new Date(memory.date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })}`;
  }

  private getUserContextString(user: IUser): string {
    const contextParts: string[] = [];

    if (user.location) contextParts.push(`Location: ${user.location}`);
    if (user.occupation) contextParts.push(`Occupation: ${user.occupation}`);
    if (user.age) contextParts.push(`Age: ${user.age}`);
    if (user.interests && user.interests.length > 0) {
      contextParts.push(`Interests: ${user.interests.join(', ')}`);
    }
    if (user.culturalBackground) contextParts.push(`Cultural Background: ${user.culturalBackground}`);

    return contextParts.length > 0 ? contextParts.join('\n') : 'No additional context available';
  }

  private getLengthInstruction(summaryLength: string): string {
    switch (summaryLength) {
      case 'detailed':
        return 'detailed 5-6 sentence';
      default:
        return 'brief 2-3 sentence';
    }
  }

  private getMaxTokens(summaryLength: string): number {
    switch (summaryLength) {
      case 'detailed':
        return 150;
      default:
        return 100;
    }
  }
}
