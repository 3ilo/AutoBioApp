import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { IUser } from '../../../../shared/types/User';
import { IMemory } from '../../../../shared/types/Memory';
import logger from '../../utils/logger';
import { getAwsClientConfig } from '../../utils/env';
import Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { IPromptBuilder, MemoryPromptInput } from '../interfaces/IPromptBuilder';
import { calculateBedrockCost, formatCost } from '../../utils/costCalculator';

/**
 * Input data for building an illustration prompt
 */
export interface PromptInput {
  /** The memory to illustrate */
  memory: {
    title: string;
    content: string;
    date: Date;
    tags?: string[];
  };
  /** The user/subject of the illustration */
  user: IUser;
  /** Additional context from recent memories (optional) */
  memorySummary?: string;
}

/**
 * Structured prompt with all fields for OpenAI gpt-image-1.5
 */
export interface StructuredPrompt {
  subject: string;
  identityConstraints: string;
  styleConstraints: string;
  scene: string;
  composition: string;
}


/**
 * Builds structured prompts for OpenAI gpt-image-1.5 image generation.
 * Uses LLM to intelligently generate SCENE and COMPOSITION based on memory content.
 * Uses template files for prompt structure, supporting different versions.
 */
export class OpenAIPromptBuilder implements IPromptBuilder {
  private bedrockClient: BedrockRuntimeClient;
  private readonly MODEL_ID = process.env.BEDROCK_SUMMARY_MODEL_ID || 'amazon.nova-micro-v1:0';
  private readonly BEDROCK_REGION = process.env.BEDROCK_CLIENT_REGION || 'us-west-2';
  private readonly TEMPLATES_DIR = path.join(__dirname, 'templates');
  private templateCache: Map<string, HandlebarsTemplateDelegate> = new Map();
  private readonly DEFAULT_VERSION = 'v1';

  constructor() {
    this.bedrockClient = new BedrockRuntimeClient(getAwsClientConfig(this.BEDROCK_REGION));
  }

  /**
   * Load a template from file, with caching
   * Supports per-template versioning (e.g., subject-v1.txt, format-v2.txt)
   * @param templateName - Base name of the template (e.g., 'subject', 'format')
   * @param version - Optional version override (defaults to 'v1')
   */
  private loadTemplate(templateName: string, version?: string): HandlebarsTemplateDelegate {
    const templateVersion = version || this.DEFAULT_VERSION;
    const cacheKey = `${templateName}-${templateVersion}`;
    
    if (this.templateCache.has(cacheKey)) {
      return this.templateCache.get(cacheKey)!;
    }

    // Try versioned template first (e.g., subject-v1.txt)
    let templatePath = path.join(this.TEMPLATES_DIR, `${templateName}-${templateVersion}.txt`);
    
    // Fallback to default version if versioned template doesn't exist
    if (!fs.existsSync(templatePath)) {
      templatePath = path.join(this.TEMPLATES_DIR, `${templateName}-${this.DEFAULT_VERSION}.txt`);
    }
    
    try {
      const templateContent = fs.readFileSync(templatePath, 'utf-8');
      const template = Handlebars.compile(templateContent);
      this.templateCache.set(cacheKey, template);
      return template;
    } catch (error) {
      logger.error('Failed to load template', { templateName, version: templateVersion, error: (error as Error).message });
      throw new Error(`Template not found: ${templatePath}`);
    }
  }

  /**
   * Get template version from environment variable or config
   * Format: TEMPLATE_NAME_VERSION (e.g., SUBJECT_VERSION=v2, FORMAT_VERSION=v1)
   */
  private getTemplateVersion(templateName: string): string | undefined {
    const envKey = `${templateName.toUpperCase().replace(/-/g, '_')}_VERSION`;
    return process.env[envKey];
  }

  /**
   * Build the complete structured prompt for image generation
   * Each template can have its own version (per-template versioning)
   * @param input - Prompt input data
   */
  async buildStructuredPrompt(input: PromptInput): Promise<StructuredPrompt> {
    const { user, memory, memorySummary } = input;

    // Build static fields from user data using templates (each with its own version)
    const subject = this.buildSubjectField(user, memorySummary);
    const identityConstraints = this.buildIdentityConstraintsField(user);
    const styleConstraints = this.buildStyleConstraintsField(user);

    // Generate dynamic fields using LLM with templates (each with its own version)
    const [scene, composition] = await Promise.all([
      this.generateSceneField(memory, user),
      this.generateCompositionField(memory, user),
    ]);

    return {
      subject,
      identityConstraints,
      styleConstraints,
      scene,
      composition,
    };
  }

  /**
   * Format the structured prompt as a single string for the API
   * @param structuredPrompt - The structured prompt data
   */
  formatPromptForAPI(structuredPrompt: StructuredPrompt): string {
    const version = this.getTemplateVersion('format');
    const template = this.loadTemplate('format', version);
    return template(structuredPrompt).trim();
  }

  /**
   * Build the SUBJECT field describing who the subject is
   * Recent memory summary is included here for context about the subject's recent activities
   */
  private buildSubjectField(user: IUser, recentMemoriesContext?: string): string {
    const version = this.getTemplateVersion('subject');
    const template = this.loadTemplate('subject', version);
    return template({
      firstName: user.firstName,
      lastName: user.lastName,
      gender: user.gender,
      age: user.age,
      recentMemoriesContext: recentMemoriesContext,
    }).trim();
  }

  /**
   * Build the IDENTITY CONSTRAINTS field with physical invariants
   */
  private buildIdentityConstraintsField(user: IUser): string {
    const version = this.getTemplateVersion('identity-constraints');
    const template = this.loadTemplate('identity-constraints', version);
    
    let ageDescription = '';
    if (user.age) {
      if (user.age < 18) {
        ageDescription = `Young person, approximately ${user.age} years old`;
      } else if (user.age < 30) {
        ageDescription = `Young adult, approximately ${user.age} years old`;
      } else if (user.age < 50) {
        ageDescription = `Adult, approximately ${user.age} years old`;
      } else {
        ageDescription = `Mature adult, approximately ${user.age} years old`;
      }
    }

    const hasConstraints = !!(user.age || user.gender || user.culturalBackground || user.occupation);

    return template({
      firstName: user.firstName,
      lastName: user.lastName,
      age: user.age,
      ageDescription: ageDescription,
      gender: user.gender,
      culturalBackground: user.culturalBackground,
      occupation: user.occupation,
      hasConstraints: hasConstraints,
    }).trim();
  }

  /**
   * Build the STYLE CONSTRAINTS field
   */
  private buildStyleConstraintsField(user: IUser): string {
    const version = this.getTemplateVersion('style-constraints');
    const template = this.loadTemplate('style-constraints', version);
    return template({
      preferredStyle: user.preferredStyle,
    }).trim();
  }

  /**
   * Generate the SCENE field using LLM based on memory content
   */
  private async generateSceneField(
    memory: { title: string; content: string; date: Date; tags?: string[] },
    user: IUser
  ): Promise<string> {
    try {
      const systemVersion = this.getTemplateVersion('scene-system');
      const userVersion = this.getTemplateVersion('scene-user');
      const systemTemplate = this.loadTemplate('scene-system', systemVersion);
      const userTemplate = this.loadTemplate('scene-user', userVersion);

      const systemPrompt = systemTemplate({});
      const userMessage = userTemplate({
        title: memory.title,
        content: memory.content,
        formattedDate: this.formatDate(memory.date),
        tags: memory.tags?.join(', '),
        userLocation: user.location,
      });

      const scene = await this.callLLM(systemPrompt, userMessage);
      return scene;
    } catch (error) {
      logger.error('Failed to generate scene field', { error: (error as Error).message });
      // Fallback to basic scene description
      return `A scene depicting "${memory.title}" with the subject as the central figure.`;
    }
  }

  /**
   * Generate the COMPOSITION field using LLM based on memory content
   */
  private async generateCompositionField(
    memory: { title: string; content: string; date: Date; tags?: string[] },
    user: IUser
  ): Promise<string> {
    try {
      const systemVersion = this.getTemplateVersion('composition-system');
      const userVersion = this.getTemplateVersion('composition-user');
      const systemTemplate = this.loadTemplate('composition-system', systemVersion);
      const userTemplate = this.loadTemplate('composition-user', userVersion);

      const systemPrompt = systemTemplate({});
      const userMessage = userTemplate({
        title: memory.title,
        content: memory.content,
      });

      const composition = await this.callLLM(systemPrompt, userMessage);
      return composition;
    } catch (error) {
      logger.error('Failed to generate composition field', { error: (error as Error).message });
      // Fallback to basic composition
      return 'Position the subject using rule of thirds. Medium shot at eye level with subtle depth of field to emphasize the subject while maintaining context.';
    }
  }

  /**
   * Call Bedrock LLM for text generation
   */
  private async callLLM(systemPrompt: string, userMessage: string): Promise<string> {
    const command = new ConverseCommand({
      modelId: this.MODEL_ID,
      messages: [
        {
          role: 'user',
          content: [{ text: userMessage }],
        },
      ],
      system: [{ text: systemPrompt }],
      inferenceConfig: {
        maxTokens: 200,
        temperature: 0.7,
      },
    });

    const response = await this.bedrockClient.send(command);
    
    // Log token usage and cost from Bedrock response
    const usage = response.usage;
    if (usage) {
      const cost = calculateBedrockCost({
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        cacheReadInputTokens: usage.cacheReadInputTokens,
        cacheWriteInputTokens: usage.cacheWriteInputTokens,
      });
      
      logger.info('Bedrock API call - Prompt Building', {
        service: 'OpenAIPromptBuilder',
        modelId: this.MODEL_ID,
        operation: 'callLLM',
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        cacheReadInputTokens: usage.cacheReadInputTokens,
        cacheWriteInputTokens: usage.cacheWriteInputTokens,
        cost: {
          inputCost: formatCost(cost.inputCost),
          outputCost: formatCost(cost.outputCost),
          totalCost: formatCost(cost.totalCost),
          ...(cost.cacheSavings !== undefined && { cacheSavings: formatCost(cost.cacheSavings) }),
        },
      });
    }
    
    const text = response?.output?.message?.content
      ?.flatMap((content) => (content.text ? [content.text] : []))
      .join(' ') || '';

    return text.trim();
  }

  /**
   * Build a memory prompt using structured prompt format
   * Implements IPromptBuilder interface
   */
  async buildMemoryPrompt(input: MemoryPromptInput): Promise<string> {
    const promptInput: PromptInput = {
      memory: input.memory,
      user: input.user,
      memorySummary: input.recentMemoriesContext,
    };

    const structuredPrompt = await this.buildStructuredPrompt(promptInput);
    return this.formatPromptForAPI(structuredPrompt);
  }

  /**
   * Build a complete prompt for subject/portrait illustrations
   * Uses template-based approach with per-template versioning
   * @param user - The user to create a portrait of
   */
  buildSubjectPrompt(user: IUser): string {
    const version = this.getTemplateVersion('subject-prompt');
    const template = this.loadTemplate('subject-prompt', version);
    return template({
      firstName: user.firstName,
      lastName: user.lastName,
      gender: user.gender,
      age: user.age,
      culturalBackground: user.culturalBackground,
    }).trim();
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}

// Export singleton instance
export const openAIPromptBuilder = new OpenAIPromptBuilder();

