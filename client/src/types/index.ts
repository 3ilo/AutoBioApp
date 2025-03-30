export interface User {
  id: string;
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
  id: string;
  title: string;
  content: string; // Rich text content
  date: string; // ISO date string
  datetime: Date;
  place: {
    name: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  isPublic: boolean;
  creator: User;
  relatedUsers: User[];
  images: string[]; // URLs of images
  tags: string[];
  likes: number;
  comments: number;
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

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
} 