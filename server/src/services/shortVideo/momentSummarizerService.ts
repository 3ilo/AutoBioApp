import Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { IMemory } from '../../../../shared/types/Memory';
import { IUser } from '../../../../shared/types/User';
import logger from '../../utils/logger';
import { getAwsClientConfig } from '../../utils/env';
import { calculateBedrockCost, formatCost } from '../../utils/costCalculator';

const TEMPLATES_DIR = path.join(__dirname, '..', 'promptBuilders', 'templates');
const TEMPLATE_VERSION = 'v1';

export interface MomentSummarizerResult {
  moment: string;
  systemPrompt: string;
  userPrompt: string;
}

export interface MomentSummarizerService {
  extractMoment(memory: IMemory, user: IUser): Promise<MomentSummarizerResult>;
}

function loadTemplate(name: string): string {
  const templatePath = path.join(TEMPLATES_DIR, `short-video-moment-summarizer-${name}-${TEMPLATE_VERSION}.txt`);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Moment summarizer template not found: ${templatePath}`);
  }
  return fs.readFileSync(templatePath, 'utf-8');
}

function getUserContextString(user: IUser): string {
  const parts: string[] = [];
  if (user.location) parts.push(`Location: ${user.location}`);
  if (user.occupation) parts.push(`Occupation: ${user.occupation}`);
  if (user.age) parts.push(`Age: ${user.age}`);
  if (user.interests?.length) parts.push(`Interests: ${user.interests.join(', ')}`);
  if (user.culturalBackground) parts.push(`Cultural background: ${user.culturalBackground}`);
  return parts.join('\n');
}

export class BedrockMomentSummarizerService implements MomentSummarizerService {
  private readonly bedrockClient: BedrockRuntimeClient;
  private readonly modelId = process.env.BEDROCK_SUMMARY_MODEL_ID || 'amazon.nova-micro-v1:0';
  private readonly region = process.env.BEDROCK_CLIENT_REGION || 'us-west-2';
  private readonly systemTemplate = Handlebars.compile(loadTemplate('system'));
  private readonly userTemplate = Handlebars.compile(loadTemplate('user'));

  constructor() {
    this.bedrockClient = new BedrockRuntimeClient(getAwsClientConfig(this.region));
  }

  async extractMoment(memory: IMemory, user: IUser): Promise<MomentSummarizerResult> {
    const systemPrompt = this.systemTemplate({}).trim();
    const memoryDate = new Date(memory.date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const userPrompt = this.userTemplate({
      memoryTitle: memory.title,
      memoryDate,
      memoryContent: memory.content,
      userContext: getUserContextString(user),
    }).trim();

    logger.debug('MomentSummarizer: prompts', {
      memoryId: memory._id,
      systemPrompt,
      userPrompt,
    });

    const command = new ConverseCommand({
      modelId: this.modelId,
      messages: [{ role: 'user', content: [{ text: userPrompt }] }],
      system: [{ text: systemPrompt }],
      inferenceConfig: { maxTokens: 300, temperature: 0.6 },
    });

    const response = await this.bedrockClient.send(command);
    if (!response.output) throw new Error('No response body from Bedrock');

    const usage = response.usage;
    if (usage) {
      const cost = calculateBedrockCost({
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        cacheReadInputTokens: usage.cacheReadInputTokens,
        cacheWriteInputTokens: usage.cacheWriteInputTokens,
      });
      logger.info('Bedrock API call - Moment Summarizer', {
        service: 'BedrockMomentSummarizerService',
        modelId: this.modelId,
        memoryId: memory._id,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cost: cost?.totalCost != null ? formatCost(cost.totalCost) : undefined,
      });
    }

    const text =
      response.output.message?.content?.flatMap((c) => (c.text ? [c.text] : [])).join(' ')?.trim() || '';
    const moment = text || `A memorable moment from "${memory.title}".`;
    logger.debug('Moment summarizer: extracted moment', {
      memoryId: memory._id,
      length: moment.length,
      text: moment,
    });
    return { moment, systemPrompt, userPrompt };
  }
}

export class MomentSummarizerStubService implements MomentSummarizerService {
  async extractMoment(memory: IMemory, _user: IUser): Promise<MomentSummarizerResult> {
    const dateStr = new Date(memory.date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const moment = `A memorable moment from the memory "${memory.title}" on ${dateStr}.`;
    return {
      moment,
      systemPrompt: '(stub)',
      userPrompt: `(stub) ${memory.title}`,
    };
  }
}

export const bedrockMomentSummarizerService = new BedrockMomentSummarizerService();
export const momentSummarizerStubService = new MomentSummarizerStubService();
