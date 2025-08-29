import { IUser } from "./User";

export interface IComment {
  user: string; // User ID
  content: string;
  createdAt: Date;
}

export interface IMemoryImage {
  url: string;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface IMemory {
  _id?: string;
  title: string;
  content: string;
  summary?: string; // AI-generated summary for context aggregation
  date: Date;
  images: IMemoryImage[];
  tags: string[];
  author: IUser; // User ID
  likes: IUser[]; // Array of User IDs
  comments: IComment[];
  isPublic: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Type for creating a new memory (without _id and timestamps)
export type CreateMemoryInput = Omit<IMemory, '_id' | 'createdAt' | 'updatedAt'>;

// Type for updating a memory (all fields optional except _id)
export type UpdateMemoryInput = Partial<Omit<IMemory, '_id' | 'createdAt' | 'updatedAt'>> & {
  _id: string;
}; 