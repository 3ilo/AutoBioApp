export interface IUser {
  _id?: string;
  firstName: string;
  lastName: string;
  age: number;
  email: string;
  password?: string; // Optional because we don't want to send password to client
  avatar?: string;
  bio?: string;
  location?: string;
  role: 'user' | 'admin';
  createdAt?: Date;
  updatedAt?: Date;
}

// Type for creating a new user (without _id and timestamps)
export type CreateUserInput = Omit<IUser, '_id' | 'createdAt' | 'updatedAt'>;

// Type for updating a user (all fields optional except _id)
export type UpdateUserInput = Partial<Omit<IUser, '_id' | 'createdAt' | 'updatedAt'>> & {
  _id: string;
}; 

export interface AuthState {
  user: IUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
} 