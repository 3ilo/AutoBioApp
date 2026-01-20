import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUser, CreateUserInput } from '../../../shared/types/User';

export interface IUserDocument extends Omit<IUser, '_id'>, mongoose.Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new mongoose.Schema<IUserDocument>(
  {
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
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    avatar: {
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
    bio: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    location: {
      type: String,
      trim: true,
    },
    occupation: {
      type: String,
      trim: true,
    },
    gender: {
      type: String,
      trim: true,
    },
    interests: [{
      type: String,
      trim: true,
    }],
    culturalBackground: {
      type: String,
      trim: true,
    },
    preferredStyle: {
      type: String,
      trim: true,
    },
    following: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    followers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    if (this.password) {
      this.password = await bcrypt.hash(this.password, salt);
    }
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  try {
    if (!this.password) return false;
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

export const User = mongoose.model<IUserDocument>('User', userSchema); 