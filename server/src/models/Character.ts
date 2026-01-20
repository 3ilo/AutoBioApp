import mongoose from 'mongoose';
import { ICharacter } from '../../../shared/types/Character';

export interface ICharacterDocument extends Omit<ICharacter, '_id' | 'userId'>, mongoose.Document {
  userId: mongoose.Types.ObjectId;
}

const characterSchema = new mongoose.Schema<ICharacterDocument>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    age: {
      type: Number,
      required: true,
      min: 0,
    },
    gender: {
      type: String,
      trim: true,
    },
    relationship: {
      type: String,
      trim: true,
    },
    culturalBackground: {
      type: String,
      trim: true,
    },
    referenceImageS3Uri: {
      type: String,
      trim: true,
    },
    referenceImagesS3Uris: {
      type: [String],
      default: [],
    },
    multiAngleReferenceS3Uri: {
      type: String,
      trim: true,
    },
    avatarS3Uri: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries by user
characterSchema.index({ userId: 1, firstName: 1, lastName: 1 });

export const Character = mongoose.model<ICharacterDocument>('Character', characterSchema);
