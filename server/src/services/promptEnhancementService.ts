import { IUser } from '../../../shared/types/User';

export interface MemoryData {
  title: string;
  content: string;
  date: Date;
}

export class PromptEnhancementService {
  async createEnhancedPrompt(
    currentMemory: MemoryData,
    user: IUser,
    memorySummary: string
  ): Promise<string> {
    const userContext = this.getUserContextString(user);
    const currentMemorySection = this.getCurrentMemoryString(currentMemory);
    const recentMemoriesSection = this.getRecentMemoriesString(memorySummary);
    const styleSection = this.getStyleSection(user);


    // TEMPORARY
    return currentMemory.content;

    return `Create an illustration for a memory titled "${currentMemory.title}" from ${this.formatDate(currentMemory.date)}.
    Focus mainly on the details and subjects in CURRENT_MEMORY.
    Utilize the USER_CONTEXT data to provide the right physical characteristics of the subject.
    Utilize carefully the RECENT_MEMORIES **when applicable** to fill out context on the CURRENT_MEMOR  but **do not over-use this metadata**.
    Your goal is to generate an image about the **current memory** with the correct physical characterstics without incorporating elements of past memories when they do not match the current memory.

USER_CONTEXT: ${userContext}

RECENT_MEMORIES: ${recentMemoriesSection}

CURRENT_MEMORY: ${currentMemorySection}

The image should match the style: ${styleSection}.`;
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

    if (contextParts.length === 0) {
      return 'User Context: No additional context available';
    }

    return `User Context:
${contextParts.join('\n')}`;
  }

  private getRecentMemoriesString(memorySummary: string): string {
    if (!memorySummary || memorySummary.trim() === '') {
      return '';
    }

    return `Recent Memories:
${memorySummary}`;
  }

  private getCurrentMemoryString(memory: MemoryData): string {
    return `Current Memory:
Title: ${memory.title}
Content: ${memory.content}
Date: ${this.formatDate(memory.date)}`;
  }

  private getStyleSection(user: IUser): string {
    const baseStyle = 'Realistic fiction, illustration style with soft, warm color palette, autobiographical aesthetic with subtle textures balanced and harmonious composition';

    if (user.preferredStyle) {
      return `Style Requirements:
- ${baseStyle}
- Incorporate ${user.preferredStyle} elements
- Include subtle details that reflect the memory's content`;
    }

    return `Style Requirements:
- ${baseStyle}
- Include details that reflect the memory's content`;
  }

  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}
