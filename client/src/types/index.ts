export interface User {
  _id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  age: number;
  avatar?: string; // Optional avatar URL
  bio?: string; // Optional user bio
  location?: string; // Optional user location
  createdAt: Date;
  updatedAt: Date;
}

export interface Memory {
  _id: string;
  title: string;
  content: string; // Rich text content
  date: Date;
  images: string[]; // URLs of images
  tags: string[];
  author: User;
  likes: string[];
  comments: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryImage {
  id: string;
  url: string;
  position?: {
    x: number;
    y: number;
  };
  style?: string; // For storing AI generation style
  createdAt: Date;
}

export interface Comment {
  _id: string;
  content: string;
  author: User;
  memory: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
} 