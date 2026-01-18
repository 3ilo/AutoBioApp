import { IUser } from '../../../../shared/types/User';

/**
 * Input for building memory illustration prompts
 */
export interface MemoryPromptInput {
  memory: {
    title: string;
    content: string;
    date: Date;
    tags?: string[];
  };
  user: IUser;
  recentMemoriesContext?: string;
}

/**
 * Interface for prompt builders.
 * Different providers (OpenAI, SDXL) have different prompt building strategies.
 */
export interface IPromptBuilder {
  /**
   * Build a prompt for memory illustration
   * @param input - Memory and user context for prompt building
   * @returns The built prompt string
   */
  buildMemoryPrompt(input: MemoryPromptInput): Promise<string> | string;

  /**
   * Build a prompt for subject illustration (portrait)
   * @param user - User to create portrait of
   * @returns The built prompt string
   */
  buildSubjectPrompt(user: IUser): string;
}

