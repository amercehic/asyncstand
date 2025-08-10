import { useState, useCallback, useRef, useEffect } from 'react';

interface UseAsyncState<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isIdle: boolean;
  isSuccess: boolean;
  isError: boolean;
}

interface UseAsyncReturn<T> extends UseAsyncState<T> {
  execute: () => Promise<T | null>;
  reset: () => void;
}

export function useAsync<T>(asyncFunction: () => Promise<T>, immediate = false): UseAsyncReturn<T> {
  const [state, setState] = useState<UseAsyncState<T>>({
    data: null,
    error: null,
    isLoading: false,
    isIdle: true,
    isSuccess: false,
    isError: false,
  });

  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const execute = useCallback(async (): Promise<T | null> => {
    if (!mountedRef.current) return null;

    setState(prev => ({
      ...prev,
      isLoading: true,
      isIdle: false,
      isError: false,
      error: null,
    }));

    try {
      const data = await asyncFunction();

      if (mountedRef.current) {
        setState({
          data,
          error: null,
          isLoading: false,
          isIdle: false,
          isSuccess: true,
          isError: false,
        });
      }

      return data;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));

      if (mountedRef.current) {
        setState({
          data: null,
          error: errorObj,
          isLoading: false,
          isIdle: false,
          isSuccess: false,
          isError: true,
        });
      }

      throw errorObj;
    }
  }, [asyncFunction]);

  const reset = useCallback(() => {
    setState({
      data: null,
      error: null,
      isLoading: false,
      isIdle: true,
      isSuccess: false,
      isError: false,
    });
  }, []);

  // Execute immediately if requested
  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate, execute]);

  return {
    ...state,
    execute,
    reset,
  };
}
