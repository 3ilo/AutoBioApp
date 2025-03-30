import fetch from 'node-fetch';
import { API_URL } from './config';
import logger from './utils/logger';

export class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private getHeaders(contentType: string = 'application/json') {
    const headers: Record<string, string> = {
      'Content-Type': contentType,
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  private async handleResponse(response: any) {
    if (response.status === 204) {
      return { status: 'success' };
    }
    const data = await response.json();
    if (!response.ok) {
      const error = new Error('API request failed');
      (error as any).response = {
        status: response.status,
        statusText: response.statusText,
        data,
      };
      throw error;
    }
    return data;
  }

  async get(endpoint: string) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async post(endpoint: string, data: any) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    const result = await this.handleResponse(response);
    
    // If this is a login request and it was successful, set the token
    if (endpoint === '/auth/login' && result.status === 'success') {
      logger.info('Login response:', JSON.stringify(result, null, 2));
      if (result.token) {
        this.setToken(result.token);
        logger.info('Token set from root level');
      } else if (result.data?.token) {
        this.setToken(result.data.token);
        logger.info('Token set from data object');
      } else {
        logger.error('No token found in login response');
      }
    }
    
    return result;
  }

  async put(endpoint: string, data: any) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async patch(endpoint: string, data: any) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async delete(endpoint: string) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }
} 