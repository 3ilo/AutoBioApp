import { useState, useCallback } from 'react';
import { ApiError } from '../services/api';
import { getErrorMessage } from '../utils/errorMessages';

interface UseApiState<T> {
  data: T | null;
  isLoading: boolean;
  error: ApiError | null;
}

interface UseApiResult<T> extends UseApiState<T> {
  execute: (...args: any[]) => Promise<void>;
  reset: () => void;
}

export function useApi<T>(
  apiFunction: (...args: any[]) => Promise<{ data: T }>,
  initialData: T | null = null
): UseApiResult<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: initialData,
    isLoading: false,
    error: null,
  });

  const execute = useCallback(
    async (...args: any[]) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        const response = await apiFunction(...args);
        setState({
          data: response.data,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        setState({
          data: null,
          isLoading: false,
          error: {
            message: errorMessage,
            status: (error as any)?.response?.status,
          } as ApiError,
        });
      }
    },
    [apiFunction]
  );

  const reset = useCallback(() => {
    setState({
      data: initialData,
      isLoading: false,
      error: null,
    });
  }, [initialData]);

  return {
    ...state,
    execute,
    reset,
  };
} 