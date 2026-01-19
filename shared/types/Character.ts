/**
 * Character interface for additional people in the user's life
 * These can be tagged in memories for multi-person illustration generation
 */
export interface ICharacter {
  _id?: string;
  userId: string; // Owner reference - the user who created this character
  firstName: string;
  lastName: string;
  age: number; // Current age - used for age calculation at memory time
  gender?: string; // For image generation context
  relationship?: string; // e.g., "mother", "friend", "spouse"
  culturalBackground?: string; // Cultural context for image generation
  referenceImageS3Uri?: string; // Raw photo uploaded for generation
  avatarS3Uri?: string; // Generated avatar image
  createdAt?: Date;
  updatedAt?: Date;
}

// Type for creating a new character (without _id and timestamps)
export type CreateCharacterInput = Omit<ICharacter, '_id' | 'createdAt' | 'updatedAt'>;

// Type for updating a character (all fields optional except _id)
export type UpdateCharacterInput = Partial<Omit<ICharacter, '_id' | 'userId' | 'createdAt' | 'updatedAt'>>;

/**
 * Character reference used when tagging in memories
 */
export interface ITaggedCharacter {
  characterId: string;
  displayName: string; // "FirstName LastName" for display
}
