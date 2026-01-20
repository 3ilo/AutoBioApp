import { IPromptBuilder, MemoryPromptInput, MultiSubjectGridPromptInput, MultiAngleReferenceInput } from '../interfaces/IPromptBuilder';
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
    return `[STUB] Create a realistic professional portrait sketch of ${user.firstName} ${user.lastName} with photorealistic precision. NOT cartoon, NOT anime. Clothing must be a blank generic white t-shirt.`;
  }

  buildMultiAngleSubjectPrompt(user: IUser): string {
    return `[STUB] Create a realistic 3-angle portrait array of ${user.firstName} ${user.lastName} (left profile, front, right profile) with photorealistic precision. NOT cartoon, NOT anime. Clothing must be a blank generic white t-shirt.`;
  }

  buildSubjectAnglePrompt(user: IUser, angle: 'left' | 'front' | 'right'): string {
    return `[STUB] Create a realistic ${angle} angle portrait of ${user.firstName} ${user.lastName} with photorealistic precision. NOT cartoon, NOT anime. Clothing must be a blank generic white t-shirt.`;
  }

  buildMultiAngleReferencePrompt(input: MultiAngleReferenceInput): string {
    return `[STUB] Multi-angle reference for ${input.name}: 3-panel array (left/front/right).`;
  }

  buildMultiSubjectGridPrompt(input: MultiSubjectGridPromptInput): string {
    const subjectNames = input.subjects.map(s => s.name).join(', ');
    return `[STUB] Multi-subject illustration with ${input.subjects.length} people: ${subjectNames}. ${input.gridDescription}`;
  }
}

export const stubPromptBuilder = new StubPromptBuilder();

