/**
 * Character interface for client-side use
 * Mirrors the shared type but with client-specific considerations
 */
export interface ICharacter {
  _id: string;
  userId: string;
  firstName: string;
  lastName: string;
  age: number;
  gender?: string;
  relationship?: string;
  culturalBackground?: string;
  referenceImageS3Uri?: string;
  avatarS3Uri?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCharacterInput {
  firstName: string;
  lastName: string;
  age: number;
  gender?: string;
  relationship?: string;
  culturalBackground?: string;
}

export interface UpdateCharacterInput {
  firstName?: string;
  lastName?: string;
  age?: number;
  gender?: string;
  relationship?: string;
  culturalBackground?: string;
}

export interface ITaggedCharacter {
  characterId: string;
  displayName: string;
}
