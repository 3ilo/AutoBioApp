import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import { User, Memory } from '../types';

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
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
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
  data: T;
  message?: string;
}

// Auth endpoints
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await api.post<ApiResponse<{ user: User; token: string }>>('/auth/login', {
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
    const response = await api.post<ApiResponse<{ user: User; token: string }>>('/auth/register', userData);
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get<ApiResponse<User>>('/auth/profile');
    return response.data;
  },

  updateProfile: async (profileData: Partial<User>) => {
    const response = await api.patch<ApiResponse<User>>('/auth/profile', profileData);
    return response.data;
  },
};

// Memories endpoints
export const memoriesApi = {
  create: async (memoryData: Omit<Memory, 'id' | 'creator' | 'createdAt' | 'updatedAt'>) => {
    const response = await api.post<ApiResponse<Memory>>('/memories', memoryData);
    return response.data;
  },

  getAll: async () => {
    const response = await api.get<ApiResponse<Memory[]>>('/memories');
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get<ApiResponse<Memory>>(`/memories/${id}`);
    return response.data;
  },

  update: async (id: string, memoryData: Partial<Memory>) => {
    const response = await api.patch<ApiResponse<Memory>>(`/memories/${id}`, memoryData);
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
    const response = await api.get<ApiResponse<Memory[]>>('/explore', {
      params: { query, ...filters },
    });
    return response.data;
  },

  getFeatured: async () => {
    const response = await api.get<ApiResponse<Memory[]>>('/explore/featured');
    return response.data;
  },
};

export default api; 