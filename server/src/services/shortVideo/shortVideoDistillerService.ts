import Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import logger from '../../utils/logger';
import { getAwsClientConfig } from '../../utils/env';
import { calculateBedrockCost, formatCost } from '../../utils/costCalculator';

const TEMPLATES_DIR = path.join(__dirname, '..', 'promptBuilders', 'templates');
const TEMPLATE_VERSION = 'v1';
const MAX_ELEMENTS = 5;

export interface DistillerFixedElements {
  setting: string;
  subjectInScene: string;
  props?: string[];
  mood?: string;
}

export type DistillerElementType = 'subject' | 'character' | 'prop' | 'setting';

export interface DistillerElement {
  type: DistillerElementType;
  description: string;
  /** When true, this subject is the memory author (user); use their reference image. When false or omitted, generate from description. */
  isUser?: boolean;
}

export interface DistillerFrame {
  action: string;
}

export interface DistillerOutput {
  fixedElements: DistillerFixedElements;
  frames: DistillerFrame[];
  elements: DistillerElement[];
}

export interface DistillerResult {
  spec: DistillerOutput;
  systemPrompt: string;
  userPrompt: string;
  rawResponse: string;
}

export interface ShortVideoDistillerService {
  distill(moment: string, totalFrames: number): Promise<DistillerResult>;
}

function loadTemplate(name: string): string {
  const templatePath = path.join(TEMPLATES_DIR, `short-video-distiller-${name}-${TEMPLATE_VERSION}.txt`);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Distiller template not found: ${templatePath}`);
  }
  return fs.readFileSync(templatePath, 'utf-8');
}

function createFallbackOutput(totalFrames: number): DistillerOutput {
  const frames: DistillerFrame[] = Array.from({ length: totalFrames }, () => ({ action: 'slight movement' }));
  return {
    fixedElements: {
      setting: 'simple interior, soft light',
      subjectInScene: 'person in frame',
      mood: 'calm',
    },
    frames,
    elements: [
      { type: 'subject', description: 'the person', isUser: true },
      { type: 'prop', description: 'simple background element' },
    ],
  };
}

function parseAndValidate(raw: string, totalFrames: number): DistillerOutput | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return null;

    const fixedElements = parsed.fixedElements as Record<string, unknown> | undefined;
    if (!fixedElements || typeof fixedElements.setting !== 'string' || typeof fixedElements.subjectInScene !== 'string') {
      return null;
    }

    const frames = parsed.frames as unknown[] | undefined;
    if (!Array.isArray(frames) || frames.length !== totalFrames) return null;
    const validFrames: DistillerFrame[] = [];
    for (const f of frames) {
      if (f && typeof f === 'object' && 'action' in f && typeof (f as DistillerFrame).action === 'string') {
        validFrames.push({ action: (f as DistillerFrame).action });
      } else {
        return null;
      }
    }

    const elements = parsed.elements as unknown[] | undefined;
    if (!Array.isArray(elements) || elements.length < 1 || elements.length > MAX_ELEMENTS) return null;
    const subjectCount = elements.filter((e: unknown) => e && typeof e === 'object' && (e as DistillerElement).type === 'subject').length;
    if (subjectCount !== 1) return null;
    const userSubjectCount = elements.filter(
      (e: unknown) => e && typeof e === 'object' && (e as Record<string, unknown>).isUser === true
    ).length;
    if (userSubjectCount > 1) return null;
    const validElements: DistillerElement[] = [];
    for (const e of elements) {
      const el = e as Record<string, unknown>;
      if (el?.type === 'subject' || el?.type === 'character' || el?.type === 'prop' || el?.type === 'setting') {
        if (typeof el.description === 'string') {
          const elem: DistillerElement = {
            type: el.type as DistillerElementType,
            description: el.description,
          };
          if (el.type === 'subject') elem.isUser = el.isUser === true;
          validElements.push(elem);
        } else return null;
      } else return null;
    }

    return {
      fixedElements: {
        setting: String(fixedElements.setting),
        subjectInScene: String(fixedElements.subjectInScene),
        props: Array.isArray(fixedElements.props) ? (fixedElements.props as string[]).slice(0, 5) : undefined,
        mood: typeof fixedElements.mood === 'string' ? fixedElements.mood : undefined,
      },
      frames: validFrames,
      elements: validElements,
    };
  } catch {
    return null;
  }
}

export class BedrockShortVideoDistillerService implements ShortVideoDistillerService {
  private readonly bedrockClient: BedrockRuntimeClient;
  private readonly modelId = process.env.BEDROCK_SUMMARY_MODEL_ID || 'amazon.nova-micro-v1:0';
  private readonly region = process.env.BEDROCK_CLIENT_REGION || 'us-west-2';
  private readonly systemTemplate = Handlebars.compile(loadTemplate('system'));
  private readonly userTemplate = Handlebars.compile(loadTemplate('user'));

  constructor() {
    this.bedrockClient = new BedrockRuntimeClient(getAwsClientConfig(this.region));
  }

  async distill(moment: string, totalFrames: number): Promise<DistillerResult> {
    const systemPrompt = this.systemTemplate({ totalFrames }).trim();
    const userPrompt = this.userTemplate({ moment, totalFrames }).trim();

    logger.debug('Distiller: prompts', {
      totalFrames,
      systemPrompt,
      userPrompt,
    });

    const command = new ConverseCommand({
      modelId: this.modelId,
      messages: [{ role: 'user', content: [{ text: userPrompt }] }],
      system: [{ text: systemPrompt }],
      inferenceConfig: { maxTokens: 1500, temperature: 0.5 },
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
      logger.info('Bedrock API call - Short Video Distiller', {
        service: 'BedrockShortVideoDistillerService',
        modelId: this.modelId,
        totalFrames,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cost: cost?.totalCost != null ? formatCost(cost.totalCost) : undefined,
      });
    }

    let raw =
      response.output.message?.content?.flatMap((c) => (c.text ? [c.text] : [])).join(' ')?.trim() || '';
    // Strip markdown code fence if present
    const codeMatch = raw.match(/^```(?:json)?\s*([\s\S]*?)```/);
    if (codeMatch) raw = codeMatch[1].trim();

    logger.debug('Distiller: raw response', {
      totalFrames,
      raw,
    });

    const spec = parseAndValidate(raw, totalFrames);
    if (spec) {
      logger.debug('Distiller: parsed output', { totalFrames, elementsCount: spec.elements.length });
      return { spec, systemPrompt, userPrompt, rawResponse: raw };
    }

    logger.warn('Distiller: invalid JSON or validation failed, using fallback', { totalFrames });
    const fallbackSpec = createFallbackOutput(totalFrames);
    return { spec: fallbackSpec, systemPrompt, userPrompt, rawResponse: raw };
  }
}

export class ShortVideoDistillerStubService implements ShortVideoDistillerService {
  async distill(_moment: string, totalFrames: number): Promise<DistillerResult> {
    const spec = createFallbackOutput(totalFrames);
    return { spec, systemPrompt: '(stub)', userPrompt: '(stub)', rawResponse: '{}' };
  }
}

export const bedrockShortVideoDistillerService = new BedrockShortVideoDistillerService();
export const shortVideoDistillerStubService = new ShortVideoDistillerStubService();
