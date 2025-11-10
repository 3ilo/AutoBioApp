import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { IUser } from '@shared/types/User';
import { authApi } from '../services/api';
import { getErrorMessage } from '../utils/errorMessages';

interface AuthState {
  user: IUser | null;
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
    registrationSecret?: string;
  }) => Promise<void>;
  updateProfile: (profileData: Partial<IUser>) => Promise<void>;
  logout: () => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setUser: (user: IUser | null) => void;
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
          const response = await authApi.login(email, password);
          set({
            user: response.data.user,
            token: response.data.token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          const errorMessage = getErrorMessage(error);
          set({
            error: errorMessage,
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
          const errorMessage = getErrorMessage(error);
          set({
            error: errorMessage,
            isLoading: false,
          });
          throw error;
        }
      },
      updateProfile: async (profileData) => {
        try {
          set({ isLoading: true, error: null });
          const response = await authApi.updateProfile(profileData);
          set({
            user: response.data.user,
            isLoading: false,
          });
        } catch (error) {
          const errorMessage = getErrorMessage(error);
          set({
            error: errorMessage,
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
      setUser: (user) => set({ user }),
    }),
    {
      name: 'auth-storage',
      // Only persist user, token, and isAuthenticated - not error or isLoading
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
); 