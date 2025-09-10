import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  type Flags,
  getInitialFlags,
  setCachedFlags,
  StickyVariants,
  isStickyExperiment,
} from '@/lib/flags';

interface FlagsContextValue {
  flags: Flags;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refetch: () => Promise<void>;
  isSticky: (key: string) => boolean;
}

const FlagsContext = createContext<FlagsContextValue | null>(null);

interface FlagsProviderProps {
  children: React.ReactNode;
  /**
   * Enable SSE for real-time updates (optional)
   */
  enableSSE?: boolean;
  /**
   * Polling interval in milliseconds (default: 60000 = 1 minute)
   */
  pollingInterval?: number;
  /**
   * User ID for sticky experiments
   */
  userId?: string;
}

export function ZeroFlickerFlagsProvider({
  children,
  enableSSE = false,
  pollingInterval = 60000,
  userId,
}: FlagsProviderProps) {
  // Initialize with bootstrapped + cached flags (zero flicker!)
  const [flags, setFlags] = useState<Flags>(() => getInitialFlags());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());

  // Refs for cleanup and deduplication
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const fetchingRef = useRef(false);
  const etag = useRef<string | null>(null);

  /**
   * Fetch flags from API with ETag support
   */
  const fetchFlags = useCallback(
    async (force = false): Promise<void> => {
      // Prevent concurrent fetches
      if (fetchingRef.current && !force) return;

      fetchingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };

        // Add If-None-Match header for ETag (if we have one and not forcing)
        if (etag.current && !force) {
          headers['If-None-Match'] = etag.current;
        }

        const response = await fetch('/api/feature-flags', {
          method: 'GET',
          headers,
          credentials: 'include', // Include cookies for auth
          cache: force ? 'no-cache' : 'default',
        });

        // Handle 304 Not Modified
        if (response.status === 304) {
          console.log('Flags unchanged (304 Not Modified)');
          return;
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Update ETag for next request
        const newEtag = response.headers.get('ETag');
        if (newEtag) {
          etag.current = newEtag;
        }

        const newFlags: Flags = await response.json();

        // Apply sticky variants for experiments
        const processedFlags: Flags = {};
        for (const [key, value] of Object.entries(newFlags)) {
          if (isStickyExperiment(key)) {
            // Use sticky variant for experiments
            processedFlags[key] = StickyVariants.getStickyVariant(key, value);
          } else {
            // Use live value for operational flags
            processedFlags[key] = value;
          }
        }

        setFlags(processedFlags);
        setLastUpdated(new Date());

        // Cache the raw flags (before sticky processing)
        setCachedFlags(newFlags);

        console.log('Flags updated:', Object.keys(processedFlags));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch flags';
        setError(errorMessage);
        console.error('Failed to fetch flags:', err);
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    },
    [userId]
  );

  /**
   * Setup polling for background updates
   */
  const setupPolling = useCallback(() => {
    const poll = () => {
      fetchFlags().then(() => {
        // Schedule next poll
        pollingTimeoutRef.current = setTimeout(poll, pollingInterval);
      });
    };

    // Start polling
    pollingTimeoutRef.current = setTimeout(poll, pollingInterval);
  }, [fetchFlags, pollingInterval]);

  /**
   * Setup SSE for real-time updates
   */
  const setupSSE = useCallback(() => {
    if (!enableSSE) return;

    try {
      const eventSource = new EventSource('/api/feature-flags/stream', {
        withCredentials: true,
      });

      eventSource.onopen = () => {
        console.log('SSE connection opened for flags');
        setError(null);
      };

      eventSource.onmessage = event => {
        try {
          const newFlags: Flags = JSON.parse(event.data);

          // Apply sticky variants
          const processedFlags: Flags = {};
          for (const [key, value] of Object.entries(newFlags)) {
            if (isStickyExperiment(key)) {
              processedFlags[key] = StickyVariants.getStickyVariant(key, value);
            } else {
              processedFlags[key] = value;
            }
          }

          setFlags(processedFlags);
          setLastUpdated(new Date());
          setCachedFlags(newFlags);

          console.log('Flags updated via SSE:', Object.keys(processedFlags));
        } catch (err) {
          console.error('Failed to parse SSE flags:', err);
        }
      };

      eventSource.onerror = error => {
        console.error('SSE error:', error);
        setError('Real-time connection lost, falling back to polling');

        // Close SSE and fall back to polling
        eventSource.close();
        setupPolling();
      };

      eventSourceRef.current = eventSource;
    } catch (err) {
      console.error('Failed to setup SSE:', err);
      // Fall back to polling
      setupPolling();
    }
  }, [enableSSE, setupPolling, userId]);

  /**
   * Handle visibility change (tab focus)
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab focused, refreshing flags');
        fetchFlags(true); // Force refresh on focus
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchFlags]);

  /**
   * Initialize background updates
   */
  useEffect(() => {
    // Start background updates
    if (enableSSE) {
      setupSSE();
    } else {
      setupPolling();
    }

    // Cleanup
    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [enableSSE, setupSSE, setupPolling]);

  /**
   * Check if a flag uses sticky variants
   */
  const isSticky = useCallback((key: string): boolean => {
    return isStickyExperiment(key);
  }, []);

  const value: FlagsContextValue = {
    flags,
    loading,
    error,
    lastUpdated,
    refetch: () => fetchFlags(true),
    isSticky,
  };

  return <FlagsContext.Provider value={value}>{children}</FlagsContext.Provider>;
}

/**
 * Hook to use feature flags
 */
export function useFlag(key: string): boolean {
  const context = useContext(FlagsContext);
  if (!context) {
    throw new Error('useFlag must be used within a ZeroFlickerFlagsProvider');
  }

  return context.flags[key] || false;
}

/**
 * Hook to get all flags
 */
export function useFlags(): Flags {
  const context = useContext(FlagsContext);
  if (!context) {
    throw new Error('useFlags must be used within a ZeroFlickerFlagsProvider');
  }

  return context.flags;
}

/**
 * Hook to get flags context (including loading, error states)
 */
export function useFlagsContext(): FlagsContextValue {
  const context = useContext(FlagsContext);
  if (!context) {
    throw new Error('useFlagsContext must be used within a ZeroFlickerFlagsProvider');
  }

  return context;
}

/**
 * Multiple flags hook for convenience
 */
export function useFlags2(keys: string[]): Record<string, boolean> {
  const context = useContext(FlagsContext);
  if (!context) {
    throw new Error('useFlags2 must be used within a ZeroFlickerFlagsProvider');
  }

  const result: Record<string, boolean> = {};
  for (const key of keys) {
    result[key] = context.flags[key] || false;
  }

  return result;
}
