import mongoose from 'mongoose';
import { IMemory } from '../../../shared/types/Memory';

const memorySchema = new mongoose.Schema<IMemory>(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    summary: { type: String, trim: true }, // AI-generated summary for context aggregation
    date: { type: Date, required: true },
    mainImage: {
      url: { type: String, required: false },
      position: {
        x: { type: Number, required: false },
        y: { type: Number, required: false },
        width: { type: Number, required: false },
        height: { type: Number, required: false }
      },
      isMain: { type: Boolean, required: false },
      float: { type: String, enum: ['left', 'right'], required: false },
      size: { type: String, enum: ['small', 'medium', 'large'], required: false }
    },
    images: [{
      url: { type: String, required: true },
      position: {
        x: { type: Number, required: true },
        y: { type: Number, required: true },
        width: { type: Number, required: true },
        height: { type: Number, required: true }
      },
      isMain: { type: Boolean, required: false },
      float: { type: String, enum: ['left', 'right'], required: false },
      size: { type: String, enum: ['small', 'medium', 'large'], required: false }
    }],
    tags: [{ type: String }],
    taggedCharacters: [{
      characterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Character', required: true },
      displayName: { type: String, required: true }
    }],
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      content: { type: String, required: true },
      createdAt: { type: Date, default: Date.now }
    }],
    isPublic: { type: Boolean, default: true }
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
memorySchema.index({ author: 1, date: -1 });
memorySchema.index({ tags: 1 });
memorySchema.index({ title: 'text', content: 'text' });

export const Memory = mongoose.model<IMemory>('Memory', memorySchema); 