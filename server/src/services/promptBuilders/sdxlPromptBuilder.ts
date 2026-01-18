import { IUser } from '../../../../shared/types/User';
import { IMemory } from '../../../../shared/types/Memory';
import { IPromptBuilder, MemoryPromptInput } from '../interfaces/IPromptBuilder';

/**
 * Input data for building an SDXL illustration prompt
 */
export interface SDXLPromptInput {
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
  recentMemoriesContext?: string;
}

/**
 * SDXL Prompt Builder
 * 
 * Builds enhanced prompts for SDXL image generation.
 * Similar structure to OpenAI prompt builder but with SDXL-specific formatting.
 */
export class SDXLPromptBuilder implements IPromptBuilder {
  /**
   * Build an enhanced prompt for SDXL memory illustration
   * Implements IPromptBuilder interface
   */
  buildMemoryPrompt(input: MemoryPromptInput): string {
    const { memory, user, recentMemoriesContext } = input;

    // Build user context section
    const userContext = this.buildUserContext(user);
    
    // Build memory section
    const memorySection = this.buildMemorySection(memory);
    
    // Build recent memories context if available
    const recentMemoriesSection = recentMemoriesContext 
      ? `\n\nRECENT_MEMORIES: ${recentMemoriesContext}` 
      : '';
    
    // Build style section
    const styleSection = this.buildStyleSection(user);

    return `Create an illustration for a memory titled "${memory.title}" from ${this.formatDate(memory.date)}.
Focus mainly on the details and subjects in CURRENT_MEMORY.
Utilize the USER_CONTEXT data to provide the right physical characteristics of the subject.
Utilize carefully the RECENT_MEMORIES **when applicable** to fill out context on the CURRENT_MEMORY but **do not over-use this metadata**.
Your goal is to generate an image about the **current memory** with the correct physical characteristics without incorporating elements of past memories when they do not match the current memory.

USER_CONTEXT: ${userContext}${recentMemoriesSection}

CURRENT_MEMORY: ${memorySection}

The image should match the style: ${styleSection}.`;
  }

  /**
   * Build a prompt for SDXL subject illustration
   */
  buildSubjectPrompt(user: IUser): string {
    const userContext = this.buildUserContext(user);
    const styleSection = this.buildStyleSection(user);

    return `Create a professional illustrated portrait of ${user.firstName} ${user.lastName}.
Use the provided reference image to accurately capture ${user.firstName}'s facial features, expression, and likeness.

USER_CONTEXT: ${userContext}

The image should match the style: ${styleSection}.

IMPORTANT: Clothing must be illustrated as a blank generic white t-shirt with no patterns, logos, or designs.`;
  }

  /**
   * Build user context string
   */
  private buildUserContext(user: IUser): string {
    const contextParts: string[] = [];

    if (user.firstName && user.lastName) {
      contextParts.push(`Name: ${user.firstName} ${user.lastName}`);
    }

    if (user.age) {
      contextParts.push(`Age: ${user.age}`);
    }

    if (user.gender) {
      contextParts.push(`Gender: ${user.gender}`);
    }

    if (user.culturalBackground) {
      contextParts.push(`Cultural/Ethnic Background: ${user.culturalBackground}`);
    }

    if (user.occupation) {
      contextParts.push(`Occupation: ${user.occupation}`);
    }

    if (user.location) {
      contextParts.push(`Location: ${user.location}`);
    }

    return contextParts.join('\n');
  }

  /**
   * Build memory section string
   */
  private buildMemorySection(memory: { title: string; content: string; date: Date; tags?: string[] }): string {
    const parts: string[] = [
      `Title: ${memory.title}`,
      `Content: ${memory.content}`,
      `Date: ${this.formatDate(memory.date)}`,
    ];

    if (memory.tags && memory.tags.length > 0) {
      parts.push(`Tags: ${memory.tags.join(', ')}`);
    }

    return parts.join('\n');
  }

  /**
   * Build style section string
   */
  private buildStyleSection(user: IUser): string {
    const baseStyle = 'Professional hand-drawn illustration with clean linework, monochrome, minimal line work that includes the main details without fully rendering textures or fine detail, personal, nostalgic, autobiographical memoir style';
    
    if (user.preferredStyle) {
      return `${baseStyle}, incorporating ${user.preferredStyle} elements`;
    }
    
    return baseStyle;
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
export const sdxlPromptBuilder = new SDXLPromptBuilder();

