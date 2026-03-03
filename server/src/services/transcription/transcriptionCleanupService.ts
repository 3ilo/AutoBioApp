import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import logger from '../../utils/logger';
import { getAwsClientConfig } from '../../utils/env';
import { calculateBedrockCost, formatCost } from '../../utils/costCalculator';

const CLEANED_START = '<<<CLEANED>>>';
const CLEANED_END = '<<<END>>>';
const TITLE_START = '<<<TITLE>>>';
const TITLE_END = '<<<END>>>';

export interface CleanupResult {
  cleaned: string;
  title?: string;
}

function extractCleanedTextAndTitle(response: string, fallbackCleaned: string): CleanupResult {
  const cleanedMatch = response.match(
    new RegExp(`${CLEANED_START}\\s*([\\s\\S]*?)\\s*${CLEANED_END}`, 'i')
  );
  const cleaned = cleanedMatch && cleanedMatch[1] ? cleanedMatch[1].trim() : fallbackCleaned;

  const titleMatch = response.match(
    new RegExp(`${TITLE_START}\\s*([\\s\\S]*?)\\s*${TITLE_END}`, 'i')
  );
  const title = titleMatch && titleMatch[1] ? titleMatch[1].trim() : undefined;

  return { cleaned, title: title || undefined };
}

const SYSTEM_PROMPT = `You are a transcription editor. Clean up the raw speech-to-text transcript and extract a short title for the memory.

DO:
- Fix punctuation and capitalization
- Remove filler words (um, uh, like, you know, etc.)
- Correct obvious transcription errors (e.g., homophones)
- Fix run-on sentences where appropriate
- Extract a brief title (3-8 words) that captures the essence of the memory

DO NOT:
- Change the user's vocabulary, style, or tone
- Paraphrase or reword
- Add or remove substantive content
- Change the narrative voice or personality

RESPONSE FORMAT: Wrap your output in these exact delimiters. No other text before or after.
${CLEANED_START}
[cleaned transcript here]
${CLEANED_END}
${TITLE_START}
[short title here]
${TITLE_END}`;

export interface TranscriptionCleanupService {
  cleanup(rawTranscript: string): Promise<CleanupResult>;
}

export class BedrockTranscriptionCleanupService implements TranscriptionCleanupService {
  private bedrockClient: BedrockRuntimeClient;
  private readonly MODEL_ID = process.env.BEDROCK_SUMMARY_MODEL_ID || 'amazon.nova-micro-v1:0';
  private readonly BEDROCK_REGION = process.env.BEDROCK_CLIENT_REGION || 'us-west-2';

  constructor() {
    this.bedrockClient = new BedrockRuntimeClient(getAwsClientConfig(this.BEDROCK_REGION));
  }

  async cleanup(rawTranscript: string): Promise<CleanupResult> {
    if (!rawTranscript || !rawTranscript.trim()) {
      return { cleaned: rawTranscript };
    }

    try {
      const command = new ConverseCommand({
        modelId: this.MODEL_ID,
        messages: [
          {
            role: 'user',
            content: [
              {
                text: `Clean this transcript and extract a title. Wrap your response in ${CLEANED_START}...${CLEANED_END} and ${TITLE_START}...${TITLE_END}:\n\n${rawTranscript}`,
              },
            ],
          },
        ],
        system: [
          {
            text: SYSTEM_PROMPT,
          },
        ],
        inferenceConfig: {
          maxTokens: 2048,
          temperature: 0.3,
        },
      });

      const response = await this.bedrockClient.send(command);

      if (!response.output) {
        throw new Error('No response body from Bedrock');
      }

      const usage = response.usage;
      if (usage) {
        const cost = calculateBedrockCost({
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.totalTokens,
          cacheReadInputTokens: usage.cacheReadInputTokens,
          cacheWriteInputTokens: usage.cacheWriteInputTokens,
        });

        logger.info('Bedrock API call - Transcription Cleanup', {
          service: 'BedrockTranscriptionCleanupService',
          modelId: this.MODEL_ID,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cost: {
            inputCost: formatCost(cost.inputCost),
            outputCost: formatCost(cost.outputCost),
            totalCost: formatCost(cost.totalCost),
          },
        });
      }

      const rawResponse =
        response?.output?.message?.content
          ?.flatMap((c) => (c.text ? [c.text] : []))
          .join(' ')
          .trim() || '';

      const result = extractCleanedTextAndTitle(rawResponse, rawTranscript);

      logger.debug('Transcription cleanup complete', {
        inputLength: rawTranscript.length,
        outputLength: result.cleaned.length,
        hasTitle: !!result.title,
      });
      return result;
    } catch (error) {
      logger.error('Transcription cleanup failed', {
        error: (error as Error).message,
      });
      return { cleaned: rawTranscript };
    }
  }
}

export const transcriptionCleanupService = new BedrockTranscriptionCleanupService();
