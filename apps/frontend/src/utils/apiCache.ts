/**
 * Advanced API caching and optimization utilities
 */

interface CacheEntry {
  data: unknown;
  timestamp: number;
  expiry: number;
}

/**
 * In-memory cache with TTL support
 */
class ApiCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize = 100; // Prevent memory leaks

  set<T>(key: string, data: T, ttlMs: number = 5 * 60 * 1000) {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data: data as unknown,
      timestamp: Date.now(),
      expiry: Date.now() + ttlMs,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  invalidate(key: string) {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: string) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  clear() {
    this.cache.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  getCacheEntry(key: string): CacheEntry | undefined {
    return this.cache.get(key);
  }
}

export const apiCache = new ApiCache();

/**
 * Request deduplication to prevent duplicate API calls
 */
class RequestDeduplicator {
  private pendingRequests = new Map<string, Promise<unknown>>();

  async deduplicate<T>(key: string, request: () => Promise<T>): Promise<T> {
    // Return existing promise if request is already in flight
    const existing = this.pendingRequests.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    // Execute new request and cache the promise
    const promise = request().finally(() => {
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }
}

export const requestDeduplicator = new RequestDeduplicator();

/**
 * Optimized API wrapper with caching and deduplication
 */
export function createOptimizedApi<T>(
  apiCall: () => Promise<T>,
  cacheKey: string,
  options: {
    ttl?: number;
    enableCache?: boolean;
    enableDeduplication?: boolean;
  } = {}
) {
  const {
    ttl = 5 * 60 * 1000, // 5 minutes default
    enableCache = true,
    enableDeduplication = true,
  } = options;

  return async (): Promise<T> => {
    // Try cache first
    if (enableCache) {
      const cached = apiCache.get<T>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Use deduplication if enabled
    const request = enableDeduplication
      ? () => requestDeduplicator.deduplicate(cacheKey, apiCall)
      : apiCall;

    const result = await request();

    // Cache the result
    if (enableCache) {
      apiCache.set(cacheKey, result, ttl);
    }

    return result;
  };
}

/**
 * Background refresh utility for stale-while-revalidate pattern
 */
export function createBackgroundRefresh<T>(
  apiCall: () => Promise<T>,
  cacheKey: string,
  staleTime: number = 2 * 60 * 1000 // 2 minutes
) {
  return async (): Promise<T> => {
    const cached = apiCache.get<T>(cacheKey);

    // Return cached data immediately if available
    if (cached) {
      // Check if data is stale and needs background refresh
      const entry = apiCache.getCacheEntry(cacheKey);
      const isStale = entry && Date.now() - entry.timestamp > staleTime;

      if (isStale) {
        // Background refresh (fire and forget)
        apiCall()
          .then(fresh => {
            apiCache.set(cacheKey, fresh);
          })
          .catch(console.error);
      }

      return cached;
    }

    // No cached data, fetch fresh
    const result = await apiCall();
    apiCache.set(cacheKey, result);
    return result;
  };
}

/**
 * Batch API requests utility
 */
interface BatchItem<T> {
  request: T;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}
class BatchManager {
  private batches = new Map<string, BatchItem<unknown>[]>();
  private timeouts = new Map<string, NodeJS.Timeout>();

  addToBatch<T>(
    batchKey: string,
    request: T,
    processor: (requests: T[]) => Promise<unknown[]>,
    delay: number = 100
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      // Get or create batch
      if (!this.batches.has(batchKey)) {
        this.batches.set(batchKey, []);
      }

      const batch = this.batches.get(batchKey)!;
      batch.push({ request: request as unknown, resolve, reject });

      // Clear existing timeout
      const existingTimeout = this.timeouts.get(batchKey);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Set new timeout to process batch
      const timeout = setTimeout(async () => {
        const currentBatch = this.batches.get(batchKey) || [];
        this.batches.delete(batchKey);
        this.timeouts.delete(batchKey);

        try {
          const requests = currentBatch.map(item => item.request) as T[];
          const results = await processor(requests);

          // Resolve all promises in batch
          currentBatch.forEach((item, index) => {
            item.resolve((results as unknown[])[index]);
          });
        } catch (error) {
          // Reject all promises in batch
          currentBatch.forEach(item => {
            item.reject(error);
          });
        }
      }, delay);

      this.timeouts.set(batchKey, timeout);
    });
  }
}

export const batchManager = new BatchManager();

/**
 * Optimized fetch wrapper with retry logic
 */
export async function optimizedFetch<T>(
  url: string,
  options: RequestInit = {},
  retries: number = 3
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (retries > 0 && response.status >= 500) {
        // Retry on server errors with exponential backoff
        const delay = Math.pow(2, 3 - retries) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return optimizedFetch(url, options, retries - 1);
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);

    if (retries > 0 && error instanceof Error && error.name !== 'AbortError') {
      const delay = Math.pow(2, 3 - retries) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      return optimizedFetch(url, options, retries - 1);
    }

    throw error;
  }
}
