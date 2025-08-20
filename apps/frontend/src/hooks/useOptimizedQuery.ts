import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { apiCache, requestDeduplicator } from '@/utils/apiCache';

interface QueryOptions<T> {
  enabled?: boolean;
  cacheTime?: number;
  staleTime?: number;
  refetchInterval?: number;
  refetchOnFocus?: boolean;
  refetchOnReconnect?: boolean;
  retry?: number;
  retryDelay?: (attempt: number) => number;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  initialData?: T;
}

interface QueryResult<T> {
  data: T | undefined;
  error: Error | null;
  isLoading: boolean;
  isFetching: boolean;
  isStale: boolean;
  refetch: () => Promise<void>;
  invalidate: () => void;
}

/**
 * Optimized data fetching hook with caching, deduplication, and automatic refetching
 * Similar to react-query/SWR but lightweight and tailored for our needs
 */
export function useOptimizedQuery<T>(
  key: string | string[],
  fetcher: () => Promise<T>,
  options: QueryOptions<T> = {}
): QueryResult<T> {
  const {
    enabled = true,
    cacheTime = 5 * 60 * 1000, // 5 minutes
    staleTime = 2 * 60 * 1000, // 2 minutes
    refetchInterval,
    refetchOnFocus = true,
    refetchOnReconnect = true,
    retry = 3,
    retryDelay = attempt => Math.min(1000 * 2 ** attempt, 30000),
    onSuccess,
    onError,
    initialData,
  } = options;

  const cacheKey = Array.isArray(key) ? key.join(':') : key;
  const [data, setData] = useState<T | undefined>(() => {
    const cached = apiCache.get<T>(cacheKey);
    return cached || initialData;
  });
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(!data);
  const [isFetching, setIsFetching] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  const mountedRef = useRef(true);
  const retryCountRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Check if data is stale
  const isStale = useMemo(() => {
    if (!lastFetchTime) return true;
    return Date.now() - lastFetchTime > staleTime;
  }, [lastFetchTime, staleTime]);

  // Fetch function with retry logic
  const fetchData = useCallback(async () => {
    if (!enabled || !mountedRef.current) return;

    setIsFetching(true);
    setError(null);

    try {
      // Use request deduplication
      const result = await requestDeduplicator.deduplicate(cacheKey, async () => {
        let lastError: Error | null = null;

        for (let i = 0; i <= retry; i++) {
          try {
            return await fetcher();
          } catch (err) {
            lastError = err as Error;

            if (i < retry) {
              const delay = retryDelay(i);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }

        throw lastError;
      });

      if (mountedRef.current) {
        setData(result);
        setLastFetchTime(Date.now());
        apiCache.set(cacheKey, result, cacheTime);
        onSuccess?.(result);
        retryCountRef.current = 0;
      }
    } catch (err) {
      if (mountedRef.current) {
        const error = err as Error;
        setError(error);
        onError?.(error);
      }
    } finally {
      if (mountedRef.current) {
        setIsFetching(false);
        setIsLoading(false);
      }
    }
  }, [enabled, cacheKey, fetcher, retry, retryDelay, cacheTime, onSuccess, onError]);

  // Initial fetch or when key changes
  useEffect(() => {
    if (!enabled) return;

    // Check cache first
    const cached = apiCache.get<T>(cacheKey);
    if (cached) {
      setData(cached);
      setIsLoading(false);

      // Fetch in background if stale
      if (isStale) {
        fetchData();
      }
    } else {
      fetchData();
    }
  }, [cacheKey, enabled]); // Intentionally not including fetchData to avoid loops

  // Refetch interval
  useEffect(() => {
    if (!refetchInterval || !enabled) return;

    intervalRef.current = setInterval(() => {
      fetchData();
    }, refetchInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refetchInterval, enabled, fetchData]);

  // Refetch on focus
  useEffect(() => {
    if (!refetchOnFocus || !enabled) return;

    const handleFocus = () => {
      if (isStale) {
        fetchData();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetchOnFocus, enabled, isStale, fetchData]);

  // Refetch on reconnect
  useEffect(() => {
    if (!refetchOnReconnect || !enabled) return;

    const handleOnline = () => {
      fetchData();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [refetchOnReconnect, enabled, fetchData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Manual refetch function
  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  // Invalidate cache
  const invalidate = useCallback(() => {
    apiCache.invalidate(cacheKey);
    setLastFetchTime(0);
    fetchData();
  }, [cacheKey, fetchData]);

  return {
    data,
    error,
    isLoading,
    isFetching,
    isStale,
    refetch,
    invalidate,
  };
}

/**
 * Hook for mutations with optimistic updates
 */
export function useOptimizedMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: {
    onSuccess?: (data: TData, variables: TVariables) => void;
    onError?: (error: Error, variables: TVariables) => void;
    onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables) => void;
  } = {}
) {
  const [data, setData] = useState<TData | undefined>();
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const mutate = useCallback(
    async (variables: TVariables) => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await mutationFn(variables);
        setData(result);
        options.onSuccess?.(result, variables);
        options.onSettled?.(result, null, variables);
        return result;
      } catch (err) {
        const error = err as Error;
        setError(error);
        options.onError?.(error, variables);
        options.onSettled?.(undefined, error, variables);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [mutationFn, options]
  );

  const reset = useCallback(() => {
    setData(undefined);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    mutate,
    data,
    error,
    isLoading,
    reset,
  };
}
