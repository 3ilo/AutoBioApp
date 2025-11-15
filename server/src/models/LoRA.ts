import mongoose from 'mongoose';
import { ILoRA } from '../../../shared/types/LoRA';

export interface ILoRADocument extends Omit<ILoRA, '_id' | 'user_id'>, mongoose.Document {
  user_id: mongoose.Types.ObjectId;
}

const loraSchema = new mongoose.Schema<ILoRADocument>(
  {
    lora_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    s3_uri: {
      type: String,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'training', 'completed', 'failed'],
      required: true,
      default: 'pending',
    },
    training_params: {
      type: mongoose.Schema.Types.Mixed,
    },
    error_message: {
      type: String,
      trim: true,
    },
    training_job_id: {
      type: String,
      trim: true,
      index: true,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Compound index for efficient "most recent" queries
loraSchema.index({ user_id: 1, createdAt: -1 });

// Unique index on lora_id (already defined in schema, but explicit here)
loraSchema.index({ lora_id: 1 }, { unique: true });

export const LoRA = mongoose.model<ILoRADocument>('LoRA', loraSchema);

