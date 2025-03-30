import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';
import { authApi } from '../services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    age: number;
  }) => Promise<void>;
  logout: () => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: async (email, password) => {
        try {
          set({ isLoading: true, error: null });
          // const response = await authApi.login(email, password);
          set({
            // user: response.data.user,
            // token: response.data.token,
            user: {
              id: "1",
              email: "test@test.com",
              name: "Test User",
              firstName: "Test",
              lastName: "User",
              age: 30,
              avatar: "https://via.placeholder.com/150",
              bio: "Test bio",
              location: "Test location",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            token: "token",
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Login failed',
            isLoading: false,
          });
          throw error;
        }
      },
      register: async (userData) => {
        try {
          set({ isLoading: true, error: null });
          const response = await authApi.register(userData);
          set({
            user: response.data.user,
            token: response.data.token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Registration failed',
            isLoading: false,
          });
          throw error;
        }
      },
      logout: () => {
        set({ user: null, token: null, isAuthenticated: false, error: null });
      },
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
    }),
    {
      name: 'auth-storage',
    }
  )
); 