export interface IComment {
  user: string; // User ID
  content: string;
  createdAt: Date;
}

export interface IMemory {
  _id?: string;
  title: string;
  content: string;
  date: Date;
  images: string[];
  tags: string[];
  author: string; // User ID
  likes: string[]; // Array of User IDs
  comments: IComment[];
  createdAt?: Date;
  updatedAt?: Date;
}

// Type for creating a new memory (without _id and timestamps)
export type CreateMemoryInput = Omit<IMemory, '_id' | 'createdAt' | 'updatedAt'>;

// Type for updating a memory (all fields optional except _id)
export type UpdateMemoryInput = Partial<Omit<IMemory, '_id' | 'createdAt' | 'updatedAt'>> & {
  _id: string;
}; 