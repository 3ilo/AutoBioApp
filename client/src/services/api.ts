import axios, { AxiosError } from 'axios';
import { useAuthStore } from '../stores/authStore';
import { IMemory } from '@shared/types/Memory';
import { IUser } from '@shared/types/User';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  console.log('Making request to:', config.url);
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    console.error('API Error:', error.config?.url, error.response?.status, error.response?.data);
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

export interface ApiResponse<T> {
  status: 'success' | 'fail';
  data: T;
  message?: string;
}

// Auth endpoints
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await api.post<ApiResponse<{ user: IUser; token: string }>>('/auth/login', {
      email,
      password,
    });
    return response.data;
  },

  register: async (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    age: number;
  }) => {
    const response = await api.post<ApiResponse<{ user: IUser; token: string }>>('/auth/register', userData);
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get<ApiResponse<IUser>>('/users/me');
    return response.data;
  },

  updateProfile: async (profileData: Partial<IUser>) => {
    const response = await api.patch<ApiResponse<IUser>>('/users/me', profileData);
    return response.data;
  },
};

// Memories endpoints
export const memoriesApi = {
  create: async (memoryData: Omit<IMemory, '_id' | 'author' | 'createdAt' | 'updatedAt'>) => {
    const response = await api.post<ApiResponse<IMemory>>('/memories', memoryData);
    return response.data;
  },

  ///
  getAll: async () => {
    const response = await api.get<ApiResponse<IMemory[]>>('/memories');
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get<ApiResponse<IMemory>>(`/memories/${id}`);
    return response.data;
  },

  update: async (id: string, memoryData: Partial<IMemory>) => {
    const response = await api.patch<ApiResponse<IMemory>>(`/memories/${id}`, memoryData);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<ApiResponse<void>>(`/memories/${id}`);
    return response.data;
  },
};

// Explore endpoints
export const exploreApi = {
  search: async (query: string, filters?: { tags?: string[] }) => {
    const response = await api.get<ApiResponse<IMemory[]>>('/explore', {
      params: { query, ...filters },
    });
    return response.data;
  },

  getFeatured: async () => {
    const response = await api.get<ApiResponse<IMemory[]>>('/explore/featured');
    return response.data;
  },
};

// Image Generation endpoints
export const imageGenerationApi = {
  generate: async (data: { title: string; content: string; date: Date }) => {
    const response = await api.post<ApiResponse<{ url: string }>>('/images/generate', data);
    return response.data;
  },

  regenerate: async (data: { title: string; content: string; date: Date; previousUrl: string }) => {
    const response = await api.post<ApiResponse<{ url: string }>>('/images/regenerate', data);
    return response.data;
  },
};

export default api; 