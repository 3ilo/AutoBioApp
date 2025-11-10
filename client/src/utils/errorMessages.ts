import { AxiosError } from 'axios';

/**
 * Extracts a user-friendly error message from an error object.
 * Handles axios errors, API response errors, and generic errors.
 */
export function getErrorMessage(error: unknown): string {
  // Handle axios errors with API response
  if (error instanceof AxiosError) {
    const response = error.response;
    
    // Check if the API returned a structured error response
    if (response?.data) {
      const apiResponse = response.data as any;
      
      // API returns { status: 'fail', message: '...' }
      if (apiResponse.message) {
        return apiResponse.message;
      }
      
      // Some APIs return { status: 'fail', errors: [...] }
      if (apiResponse.errors && Array.isArray(apiResponse.errors)) {
        return apiResponse.errors.join(', ');
      }
    }
    
    // Fallback to status code-based messages
    const status = response?.status;
    if (status === 401) {
      return 'Incorrect email or password';
    }
    if (status === 403) {
      return 'Access denied. Please check your credentials.';
    }
    if (status === 404) {
      return 'Resource not found';
    }
    if (status === 409) {
      return 'This email is already registered';
    }
    if (status === 422) {
      return 'Invalid input. Please check your information.';
    }
    if (status === 500) {
      return 'Server error. Please try again later.';
    }
    if (status) {
      return `Request failed. Please try again.`;
    }
    
    // Network errors
    if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
      return 'Network error. Please check your connection.';
    }
    
    // Timeout errors
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }
  }
  
  // Handle generic Error objects
  if (error instanceof Error) {
    // Don't show technical axios error messages
    if (error.message.includes('Request failed with status code')) {
      return 'Something went wrong. Please try again.';
    }
    if (error.message.includes('Network Error')) {
      return 'Network error. Please check your connection.';
    }
    return error.message;
  }
  
  // Fallback for unknown error types
  return 'An unexpected error occurred. Please try again.';
}

