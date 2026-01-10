import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { IUser } from '../../../../shared/types/User';
import { IMemory } from '../../../../shared/types/Memory';
import logger from '../../utils/logger';
import { getAwsClientConfig } from '../../utils/env';

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

// Default style constraints for AutoBio illustrations
const DEFAULT_STYLE_CONSTRAINTS = `
- Style: Professional hand-drawn illustration with clean linework
- Color palette: Monochrome
- Quality: Minimal line work that includes the main details without fully rendering textures or fine detail.
- Aesthetic: Personal, nostalgic, autobiographical memoir style
`.trim();

/**
 * Builds structured prompts for OpenAI gpt-image-1.5 image generation.
 * Uses LLM to intelligently generate SCENE and COMPOSITION based on memory content.
 */
export class PromptBuilder {
  private bedrockClient: BedrockRuntimeClient;
  private readonly MODEL_ID = process.env.BEDROCK_SUMMARY_MODEL_ID || 'amazon.nova-micro-v1:0';
  private readonly BEDROCK_REGION = process.env.BEDROCK_CLIENT_REGION || 'us-west-2';

  constructor() {
    this.bedrockClient = new BedrockRuntimeClient(getAwsClientConfig(this.BEDROCK_REGION));
  }

  /**
   * Build the complete structured prompt for image generation
   */
  async buildStructuredPrompt(input: PromptInput): Promise<StructuredPrompt> {
    const { user, memory, memorySummary } = input;

    // Build static fields from user data
    const subject = this.buildSubjectField(user);
    const identityConstraints = this.buildIdentityConstraintsField(user);
    const styleConstraints = this.buildStyleConstraintsField(user);

    // Generate dynamic fields using LLM
    const [scene, composition] = await Promise.all([
      this.generateSceneField(memory, user, memorySummary),
      this.generateCompositionField(memory, user),
    ]);

    logger.info('scene', { scene });
    logger.info('composition', { composition });

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
   */
  formatPromptForAPI(structuredPrompt: StructuredPrompt): string {
    return `
[SUBJECT]
${structuredPrompt.subject}

[IDENTITY CONSTRAINTS]
${structuredPrompt.identityConstraints}

[STYLE CONSTRAINTS]
${structuredPrompt.styleConstraints}

[SCENE]
${structuredPrompt.scene}

[COMPOSITION]
${structuredPrompt.composition}
`.trim();
  }

  /**
   * Build the SUBJECT field describing who the subject is
   */
  private buildSubjectField(user: IUser): string {
    const name = `${user.firstName} ${user.lastName}`.trim();
    const genderDesc = user.gender ? ` ${user.gender}` : '';
    const ageDesc = user.age ? ` aged ${user.age}` : '';
    
    return `The subject is${genderDesc}${ageDesc} named ${name}. Use the provided reference image to accurately preserve ${user.firstName}'s identity and facial features throughout the illustration.`;
  }

  /**
   * Build the IDENTITY CONSTRAINTS field with physical invariants
   */
  private buildIdentityConstraintsField(user: IUser): string {
    const constraints: string[] = [];

    // Add name as constant identifier
    constraints.push(`- Name: ${user.firstName} ${user.lastName}`);

    // Add age-related constraints
    if (user.age) {
      if (user.age < 18) {
        constraints.push(`- Age appearance: Young person, approximately ${user.age} years old`);
      } else if (user.age < 30) {
        constraints.push(`- Age appearance: Young adult, approximately ${user.age} years old`);
      } else if (user.age < 50) {
        constraints.push(`- Age appearance: Adult, approximately ${user.age} years old`);
      } else {
        constraints.push(`- Age appearance: Mature adult, approximately ${user.age} years old`);
      }
    }

    // Add gender if specified
    if (user.gender) {
      constraints.push(`- Gender presentation: ${user.gender}`);
    }

    // Add cultural background if specified
    if (user.culturalBackground) {
      constraints.push(`- Cultural/ethnic appearance: ${user.culturalBackground}`);
    }

    // Add occupation context for wardrobe hints
    if (user.occupation) {
      constraints.push(`- Professional context: ${user.occupation} (may influence attire in relevant scenes)`);
    }

    // Fallback if minimal info
    if (constraints.length === 1) {
      constraints.push('- Maintain consistent facial features and body type from reference image');
    }

    return constraints.join('\n');
  }

  /**
   * Build the STYLE CONSTRAINTS field
   */
  private buildStyleConstraintsField(user: IUser): string {
    const baseStyle = DEFAULT_STYLE_CONSTRAINTS;
    
    if (user.preferredStyle) {
      return `${baseStyle}\n- User preference: Incorporate ${user.preferredStyle} elements`;
    }
    
    return baseStyle;
  }

  /**
   * Generate the SCENE field using LLM based on memory content
   */
  private async generateSceneField(
    memory: { title: string; content: string; date: Date; tags?: string[] },
    user: IUser,
    memorySummary?: string
  ): Promise<string> {
    try {
      const systemPrompt = `You are an expert at describing visual scenes for illustrations. 
Given a personal memory, describe the scene in 2-3 sentences focusing on:
- The setting/environment
- Key objects and elements present
- Lighting and atmosphere
- Time of day/season if relevant

Be specific and visual. Do not describe actions or emotions - focus on the physical scene.
Output ONLY the scene description, no preamble or explanation.`;

      const userMessage = `Memory Title: ${memory.title}
Memory Content: ${memory.content}
Date: ${this.formatDate(memory.date)}
${memory.tags?.length ? `Tags: ${memory.tags.join(', ')}` : ''}
${user.location ? `User's typical location: ${user.location}` : ''}
${memorySummary ? `Additional context from recent memories: ${memorySummary}` : ''}

Describe the visual scene for this memory:`;

logger.info('userMessage', { userMessage });

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
      const systemPrompt = `You are an expert at describing visual composition for illustrations.
Given a personal memory, describe the ideal composition in 2-3 sentences focusing on:
- Where to position the subject (center, rule of thirds, etc.)
- Perspective/camera angle (eye level, slightly above, etc.)
- Framing (close-up, medium shot, wide shot)
- Depth and layering of elements

Be specific about visual arrangement. Output ONLY the composition description, no preamble.`;

      const userMessage = `Memory Title: ${memory.title}
Memory Content: ${memory.content}

Describe the ideal composition for illustrating this memory:`;

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
    
    const text = response?.output?.message?.content
      ?.flatMap((content) => (content.text ? [content.text] : []))
      .join(' ') || '';

    return text.trim();
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
export const promptBuilder = new PromptBuilder();

