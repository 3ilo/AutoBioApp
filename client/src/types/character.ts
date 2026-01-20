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
  referenceImageS3Uri?: string; // Raw photo uploaded for generation (legacy single image)
  referenceImagesS3Uris?: string[]; // Multiple reference photos for multi-angle generation (up to 5)
  multiAngleReferenceS3Uri?: string; // Generated 3-angle array (left profile, front, right profile)
  avatarS3Uri?: string; // Generated avatar image (front-facing extracted from multi-angle)
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
