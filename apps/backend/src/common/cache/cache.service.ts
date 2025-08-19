import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@/common/redis.service';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly defaultTTL = 3600; // 1 hour

  constructor(private readonly redis: RedisService) {}

  /**
   * Get a cached value by key
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      if (!cached) {
        this.logger.debug(`Cache miss for key: ${key}`);
        return null;
      }

      this.logger.debug(`Cache hit for key: ${key}`);
      return JSON.parse(cached) as T;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a cached value with optional TTL
   */
  async set(key: string, value: unknown, ttl: number = this.defaultTTL): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.redis.set(key, serialized, ttl);
      this.logger.debug(`Cache set for key: ${key}, TTL: ${ttl}s`);
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  /**
   * Delete a cached value
   */
  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      this.logger.debug(`Cache deleted for key: ${key}`);
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}:`, error);
    }
  }

  /**
   * Invalidate cache entries by pattern
   */
  async invalidate(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.debug(`Cache invalidated ${keys.length} keys matching pattern: ${pattern}`);
      }
    } catch (error) {
      this.logger.error(`Cache invalidate error for pattern ${pattern}:`, error);
    }
  }

  /**
   * Build a consistent cache key
   */
  buildKey(prefix: string, ...parts: (string | number)[]): string {
    return `${prefix}:${parts.join(':')}`;
  }

  /**
   * Get or set cache with a fallback function
   */
  async getOrSet<T>(
    key: string,
    fallback: () => Promise<T>,
    ttl: number = this.defaultTTL,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    try {
      const result = await fallback();
      await this.set(key, result, ttl);
      return result;
    } catch (error) {
      this.logger.error(`Cache fallback error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Increment a counter in cache
   */
  async increment(key: string, expiry: number = this.defaultTTL): Promise<number> {
    try {
      const result = await this.redis.incr(key);
      if (result === 1) {
        // Set expiry only when first incrementing
        await this.redis.expire(key, expiry);
      }
      return result;
    } catch (error) {
      this.logger.error(`Cache increment error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Check if a key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      return await this.redis.exists(key);
    } catch (error) {
      this.logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  async getStats(): Promise<{
    memory: string;
    keys: number;
    hitRate?: number;
  }> {
    try {
      const info = await this.redis.info('memory');
      const dbSize = await this.redis.dbsize();

      return {
        memory: this.parseMemoryInfo(info),
        keys: dbSize,
      };
    } catch (error) {
      this.logger.error('Cache stats error:', error);
      return { memory: 'unknown', keys: 0 };
    }
  }

  private parseMemoryInfo(info: string): string {
    const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
    return memoryMatch ? memoryMatch[1] : 'unknown';
  }
}
