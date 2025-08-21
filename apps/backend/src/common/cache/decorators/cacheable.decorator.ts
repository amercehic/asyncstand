import { SetMetadata } from '@nestjs/common';

export const CACHEABLE_KEY = 'cacheable';

export interface CacheableOptions {
  prefix: string;
  ttl?: number;
  keyGenerator?: (...args: unknown[]) => string;
}

/**
 * Decorator to mark methods for caching
 * @param prefix Cache key prefix
 * @param ttl Time to live in seconds (default: 3600)
 * @param keyGenerator Custom key generation function
 */
export const Cacheable = (
  prefix: string,
  ttl: number = 3600,
  keyGenerator?: (...args: unknown[]) => string,
) => {
  const options: CacheableOptions = {
    prefix,
    ttl,
    keyGenerator,
  };
  return SetMetadata(CACHEABLE_KEY, options);
};

/**
 * Decorator to invalidate cache entries
 * @param patterns Array of cache key patterns to invalidate
 */
export const CacheEvict = (patterns: string[]) => {
  return SetMetadata('cache_evict', patterns);
};
