import { IUser } from '../../../../shared/types/User';
import { IMemory } from '../../../../shared/types/Memory';
import { IPromptBuilder, MemoryPromptInput, MultiSubjectGridPromptInput, MultiAngleReferenceInput } from '../interfaces/IPromptBuilder';

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
 * Builds streamlined prompts for SDXL image generation.
 * Focuses on essential information: reference images, age, and realistic style.
 */
export class SDXLPromptBuilder implements IPromptBuilder {
  /**
   * Build a streamlined prompt for SDXL memory illustration
   * Implements IPromptBuilder interface
   */
  buildMemoryPrompt(input: MemoryPromptInput): string {
    const { memory, user, recentMemoriesContext } = input;
    
    const age = user.age ? `, age ${user.age}` : '';
    const userInfo = `${user.firstName} ${user.lastName}${age}`;
    
    const recentContext = recentMemoriesContext 
      ? `\n\nRECENT CONTEXT: ${recentMemoriesContext}` 
      : '';
    
    const styleSection = this.buildStyleSection(user);

    return `Create an illustration for: "${memory.title}" (${this.formatDate(memory.date)})

SUBJECT: ${userInfo}

MEMORY: ${memory.content}${recentContext}

STYLE: ${styleSection}

Use provided reference image to accurately capture subject's appearance.`;
  }

  /**
   * Build a prompt for SDXL subject illustration
   */
  buildSubjectPrompt(user: IUser): string {
    const age = user.age ? `, age ${user.age}` : '';
    
    return `Create a realistic professional portrait sketch of ${user.firstName} ${user.lastName}${age}.

REFERENCE: Use the provided reference image to accurately capture facial features and likeness.

STYLE: Realistic sketch with natural human proportions and clean linework. Monochrome. NOT cartoon or anime style.

COMPOSITION: Head and shoulders portrait, centered, white background.

CLOTHING: Plain white t-shirt.`;
  }

  /**
   * Build a prompt for SDXL multi-angle subject illustration (3-angle array)
   * @deprecated Use buildSubjectAnglePrompt with specific angle instead
   */
  buildMultiAngleSubjectPrompt(user: IUser): string {
    const userContext = this.buildUserContext(user);
    const styleSection = this.buildStyleSection(user);

    return `Create a professional illustrated portrait array of ${user.firstName} ${user.lastName} showing three different angles in a horizontal 3-panel layout.
Use the provided reference images to accurately capture ${user.firstName}'s facial features from multiple angles.

Layout: Three equal-width panels (left profile, front-facing, right profile)
- Left panel: Three-quarter view facing left
- Center panel: Direct frontal view
- Right panel: Three-quarter view facing right

USER_CONTEXT: ${userContext}

The image should match the style: ${styleSection}.

IMPORTANT: 
- All three portraits must be of the same person with consistent features
- Clothing must be illustrated as a blank generic white t-shirt with no patterns, logos, or designs
- Maintain consistent illustration style across all three panels`;
  }

  /**
   * Build a prompt for a specific angle of subject illustration (SDXL version)
   */
  buildSubjectAnglePrompt(user: IUser, angle: 'left' | 'front' | 'right'): string {
    const age = user.age ? `, age ${user.age}` : '';
    
    const angleInstructions = {
      left: 'Left three-quarter profile (face turned 45° to their right)',
      front: 'Front-facing (looking directly at viewer)',
      right: 'Right three-quarter profile (face turned 45° to their left)'
    };

    return `Create a realistic professional portrait sketch of ${user.firstName} ${user.lastName}${age}.

ANGLE: ${angleInstructions[angle]}.

REFERENCE: Use the provided reference image(s) to accurately capture facial features. 

STYLE: Realistic sketch with natural human proportions and clean linework. Monochrome. NOT cartoon or anime style.

COMPOSITION: Head and shoulders, centered, white background.

CLOTHING: Plain white t-shirt.

CRITICAL: preserve the major charactersitic and identity of the reference.`;
  }

  /**
   * Build a prompt section for multi-angle reference in illustrations (SDXL version)
   */
  buildMultiAngleReferencePrompt(input: MultiAngleReferenceInput): string {
    let prompt = `[MULTI-ANGLE REFERENCE]
The reference image for ${input.name} is a 3-panel array showing three angles (left profile, front, right profile).
Use the appropriate angle from the reference based on the scene composition.
Maintain ${input.name}'s facial features and identity from the reference.`;

    if (input.deAgingInstruction) {
      prompt += `\n${input.deAgingInstruction}`;
    }

    return prompt;
  }

  /**
   * Build a prompt for multi-subject grid-based illustrations (SDXL version)
   */
  buildMultiSubjectGridPrompt(input: MultiSubjectGridPromptInput): string {
    const parts: string[] = [];
    
    parts.push('[MULTIPLE SUBJECTS - GRID REFERENCE]');
    parts.push(input.gridDescription);
    parts.push('');
    parts.push('Subject details:');
    
    for (const subject of input.subjects) {
      let line = `- ${subject.name}`;
      if (subject.relationship) {
        line += ` (${subject.relationship})`;
      }
      if (subject.isPrimary) {
        line += ' (primary subject)';
      }
      if (subject.deAgingInstruction) {
        line += ` - ${subject.deAgingInstruction}`;
      }
      parts.push(line);
    }
    
    parts.push('');
    parts.push('IMPORTANT: Use the grid positions to identify each person and accurately preserve their facial features and identity in the illustrated scene.');
    
    return parts.join('\n');
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
    const baseStyle = 'Realistic professional sketch. Clean linework, natural human proportions. Monochrome. NOT cartoon or anime style';
    
    if (user.preferredStyle) {
      return `${baseStyle}. Incorporate ${user.preferredStyle} elements`;
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

