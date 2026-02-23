import Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { IUser } from '../../../../shared/types/User';
import logger from '../../utils/logger';

/**
 * Input for building short-video frame prompts.
 * No recent-memory context (per plan).
 */
export interface ShortVideoPromptInput {
  /** The user/subject of the video */
  user: IUser;
  /** Distilled scene/moment from memory (one LLM summarization call, no recent memories) */
  distilledScene: string;
  /** Memory title for context (optional) */
  memoryTitle?: string;
  /** Memory date for context (optional) */
  memoryDate?: Date;
}

/** Fixed elements from the distiller; used for per-frame prompt from spec. */
export interface FrameSpecFixedElements {
  setting: string;
  subjectInScene: string;
  props?: string[];
  mood?: string;
}

/** Input for building a single frame prompt from distiller spec (fixed elements + action). */
export interface FrameSpecInput {
  user: IUser;
  fixedElements: FrameSpecFixedElements;
  action: string;
  frameIndex: number;
  totalFrames: number;
}

/**
 * Builds prompts for short-video frame generation.
 * Style: minimalist editorial, flat backgrounds, soft muted palette, gentle motion,
 * flat illustration with depth hints, friendly but intelligent. Color, playful, whimsical.
 */
export class ShortVideoPromptBuilder {
  private readonly TEMPLATES_DIR = path.join(__dirname, 'templates');
  private templateCache: Map<string, Handlebars.TemplateDelegate> = new Map();

  private loadTemplate(templateName: string, version = 'v1'): Handlebars.TemplateDelegate {
    const cacheKey = `${templateName}-${version}`;
    if (this.templateCache.has(cacheKey)) {
      return this.templateCache.get(cacheKey)!;
    }
    const templatePath = path.join(this.TEMPLATES_DIR, `${templateName}-${version}.txt`);
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Short video template not found: ${templatePath}`);
    }
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(templateContent);
    this.templateCache.set(cacheKey, template);
    return template;
  }

  private buildSubjectField(user: IUser): string {
    return `The subject is ${user.firstName} ${user.lastName}. Use the provided reference image to accurately preserve their identity and facial features.`;
  }

  private buildIdentityConstraintsField(user: IUser): string {
    let ageDescription = '';
    if (user.age != null) {
      if (user.age < 18) ageDescription = `Young person, approximately ${user.age} years old`;
      else if (user.age < 30) ageDescription = `Young adult, approximately ${user.age} years old`;
      else if (user.age < 50) ageDescription = `Adult, approximately ${user.age} years old`;
      else ageDescription = `Mature adult, approximately ${user.age} years old`;
    }
    const parts: string[] = [`Name: ${user.firstName} ${user.lastName}`];
    if (ageDescription) parts.push(`Age appearance: ${ageDescription}`);
    if (user.gender) parts.push(`Gender presentation: ${user.gender}`);
    if (user.culturalBackground) parts.push(`Cultural/ethnic appearance: ${user.culturalBackground}`);
    if (user.occupation) parts.push(`Professional context: ${user.occupation}`);
    if (parts.length === 1) parts.push('Maintain consistent facial features and body type from reference image.');
    return parts.join('\n');
  }

  private buildStyleConstraintsField(): string {
    const template = this.loadTemplate('short-video-style');
    return template({}).trim();
  }

  /**
   * Build the prompt for the first frame of the short video.
   * Uses distilled scene (from one LLM memory summarization, no recent context).
   */
  buildFirstFramePrompt(input: ShortVideoPromptInput): string {
    const subject = this.buildSubjectField(input.user);
    const identityConstraints = this.buildIdentityConstraintsField(input.user);
    const styleConstraints = this.buildStyleConstraintsField();
    const template = this.loadTemplate('short-video-first-frame');
    const prompt = template({
      subject,
      identityConstraints,
      styleConstraints,
      scene: input.distilledScene,
    }).trim();
    logger.debug('ShortVideoPromptBuilder: built first-frame prompt', { length: prompt.length });
    return prompt;
  }

  /**
   * Build the prompt for continuation frames (next moment in loop, subtle motion).
   */
  buildContinuationPrompt(input: ShortVideoPromptInput): string {
    const subject = this.buildSubjectField(input.user);
    const identityConstraints = this.buildIdentityConstraintsField(input.user);
    const styleConstraints = this.buildStyleConstraintsField();
    const template = this.loadTemplate('short-video-continuation');
    const prompt = template({
      subject,
      identityConstraints,
      styleConstraints,
    }).trim();
    logger.debug('ShortVideoPromptBuilder: built continuation prompt', { length: prompt.length });
    return prompt;
  }

  /**
   * Build the prompt for one frame from distiller spec (fixed elements + action for this frame).
   */
  buildFramePromptFromSpec(input: FrameSpecInput): string {
    const subject = this.buildSubjectField(input.user);
    const identityConstraints = this.buildIdentityConstraintsField(input.user);
    const styleConstraints = this.buildStyleConstraintsField();
    const template = this.loadTemplate('short-video-frame-from-spec');
    const propsStr = input.fixedElements.props?.length
      ? input.fixedElements.props.join(', ')
      : undefined;
    const prompt = template({
      subject,
      identityConstraints,
      styleConstraints,
      setting: input.fixedElements.setting,
      subjectInScene: input.fixedElements.subjectInScene,
      mood: input.fixedElements.mood,
      props: propsStr,
      action: input.action,
      frameIndex: input.frameIndex,
      totalFrames: input.totalFrames,
    }).trim();
    logger.debug('ShortVideoPromptBuilder: built frame-from-spec prompt', {
      frameIndex: input.frameIndex,
      length: prompt.length,
    });
    return prompt;
  }

  /**
   * Build the prompt for generating a single element image (prop/setting); used before frame loop.
   */
  buildElementImagePrompt(elementDescription: string): string {
    const template = this.loadTemplate('short-video-element-image');
    const prompt = template({ elementDescription }).trim();
    logger.debug('ShortVideoPromptBuilder: element image prompt', {
      elementDescription,
      length: prompt.length,
    });
    return prompt;
  }
}

export const shortVideoPromptBuilder = new ShortVideoPromptBuilder();
