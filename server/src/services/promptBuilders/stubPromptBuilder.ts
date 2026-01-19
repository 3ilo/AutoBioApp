import { IPromptBuilder, MemoryPromptInput, MultiSubjectGridPromptInput } from '../interfaces/IPromptBuilder';
import { IUser } from '../../../../shared/types/User';

/**
 * Stub prompt builder for development/testing.
 * Returns simple mock prompts without any processing.
 */
export class StubPromptBuilder implements IPromptBuilder {
  buildMemoryPrompt(input: MemoryPromptInput): string {
    return `[STUB] Create an illustration for: ${input.memory.title} - ${input.memory.content.substring(0, 50)}...`;
  }

  buildSubjectPrompt(user: IUser): string {
    return `[STUB] Create a professional illustrated portrait of ${user.firstName} ${user.lastName}. Clothing must be a blank generic white t-shirt.`;
  }

  buildMultiSubjectGridPrompt(input: MultiSubjectGridPromptInput): string {
    const subjectNames = input.subjects.map(s => s.name).join(', ');
    return `[STUB] Multi-subject illustration with ${input.subjects.length} people: ${subjectNames}. ${input.gridDescription}`;
  }
}

export const stubPromptBuilder = new StubPromptBuilder();

