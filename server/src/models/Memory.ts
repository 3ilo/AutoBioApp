import mongoose from 'mongoose';
import { IMemory } from '../../../shared/types/Memory';

const memorySchema = new mongoose.Schema<IMemory>(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    date: { type: Date, required: true },
    images: [{
      url: { type: String, required: true },
      position: {
        x: { type: Number, required: true },
        y: { type: Number, required: true },
        width: { type: Number, required: true },
        height: { type: Number, required: true }
      }
    }],
    tags: [{ type: String }],
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