export interface ApiResponse<T> {
  status: 'success' | 'fail';
  data: T;
  message?: string;
} 