import mongoose from 'mongoose';
import { IMemory, CreateMemoryInput } from '../../../shared/types/Memory';

export interface IMemoryDocument extends Omit<IMemory, '_id'>, mongoose.Document {}

const memorySchema = new mongoose.Schema<IMemoryDocument>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
    },
    images: [{
      type: String,
      trim: true,
    }],
    tags: [{
      type: String,
      trim: true,
    }],
    author: {
      type: String,
      ref: 'User',
      required: true,
    },
    likes: [{
      type: String,
      ref: 'User',
    }],
    comments: [{
      user: {
        type: String,
        ref: 'User',
        required: true,
      },
      content: {
        type: String,
        required: true,
        trim: true,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    }],
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
memorySchema.index({ author: 1, date: -1 });
memorySchema.index({ tags: 1 });
memorySchema.index({ title: 'text', content: 'text' });

export const Memory = mongoose.model<IMemoryDocument>('Memory', memorySchema); 