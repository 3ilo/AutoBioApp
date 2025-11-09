
export interface IComment {
  user: string | any; // User ID (ObjectId or string)
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
  author: string | any; // User ID (ObjectId or string)
  likes: (string | any)[]; // Array of User IDs (ObjectId or string)
  comments: IComment[];
  isPublic: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Extended memory interface for API responses with populated author
export interface IMemoryWithAuthor extends Omit<IMemory, 'author'> {
  author: {
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
}

// Type for creating a new memory (without _id and timestamps)
export type CreateMemoryInput = Omit<IMemory, '_id' | 'createdAt' | 'updatedAt'>;

// Type for updating a memory (all fields optional except _id)
export type UpdateMemoryInput = Partial<Omit<IMemory, '_id' | 'createdAt' | 'updatedAt'>> & {
  _id: string;
}; 