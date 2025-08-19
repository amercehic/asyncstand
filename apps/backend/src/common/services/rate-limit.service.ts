import { Injectable } from '@nestjs/common';
import { CacheService } from '@/common/cache/cache.service';
import { LoggerService } from '@/common/logger.service';

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

interface RateLimitConfig {
  key: string;
  limit: number;
  windowMs: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

@Injectable()
export class RateLimitService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(RateLimitService.name);
  }

  /**
   * Check if a request should be rate limited
   */
  async checkLimit(config: RateLimitConfig): Promise<RateLimitResult> {
    const { key, limit, windowMs } = config;
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const windowEnd = windowStart + windowMs;

    const cacheKey = `rate-limit:${key}:${windowStart}`;

    try {
      // Get current request count for this window
      const current = (await this.cacheService.get<number>(cacheKey)) || 0;

      if (current >= limit) {
        // Rate limit exceeded
        const resetTime = new Date(windowEnd);
        const retryAfter = Math.ceil((windowEnd - now) / 1000);

        this.logger.warn('Rate limit exceeded', {
          key,
          current,
          limit,
          windowStart: new Date(windowStart),
          windowEnd: new Date(windowEnd),
          retryAfter,
        });

        return {
          allowed: false,
          limit,
          remaining: 0,
          resetTime,
          retryAfter,
        };
      }

      // Increment counter
      const newCount = current + 1;
      const ttlSeconds = Math.ceil((windowEnd - now) / 1000);
      await this.cacheService.set(cacheKey, newCount, ttlSeconds);

      return {
        allowed: true,
        limit,
        remaining: Math.max(0, limit - newCount),
        resetTime: new Date(windowEnd),
      };
    } catch (error) {
      this.logger.error('Error checking rate limit', {
        error: error instanceof Error ? error.message : 'Unknown error',
        key,
      });

      // Fail open - allow request if Redis is down
      return {
        allowed: true,
        limit,
        remaining: limit - 1,
        resetTime: new Date(windowEnd),
      };
    }
  }

  /**
   * Check multiple rate limits (e.g., per-user and per-IP)
   */
  async checkMultipleLimits(configs: RateLimitConfig[]): Promise<RateLimitResult> {
    const results = await Promise.all(configs.map((config) => this.checkLimit(config)));

    // Find the most restrictive result
    const blockedResult = results.find((result) => !result.allowed);
    if (blockedResult) {
      return blockedResult;
    }

    // All limits passed - return the most restrictive remaining count
    const mostRestrictive = results.reduce((prev, current) =>
      current.remaining < prev.remaining ? current : prev,
    );

    return mostRestrictive;
  }

  /**
   * Custom sliding window rate limiter
   */
  async checkSlidingWindow(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - windowMs;
    const slidingKey = `sliding:${key}`;

    try {
      // Get timestamps of recent requests
      const recentRequests = (await this.cacheService.get<number[]>(slidingKey)) || [];

      // Filter out requests outside the sliding window
      const validRequests = recentRequests.filter((timestamp) => timestamp > windowStart);

      if (validRequests.length >= limit) {
        const oldestRequest = Math.min(...validRequests);
        const retryAfter = Math.ceil((oldestRequest + windowMs - now) / 1000);

        return {
          allowed: false,
          limit,
          remaining: 0,
          resetTime: new Date(oldestRequest + windowMs),
          retryAfter: Math.max(1, retryAfter),
        };
      }

      // Add current request timestamp
      const updatedRequests = [...validRequests, now];
      await this.cacheService.set(slidingKey, updatedRequests, Math.ceil(windowMs / 1000));

      return {
        allowed: true,
        limit,
        remaining: limit - updatedRequests.length,
        resetTime: new Date(now + windowMs),
      };
    } catch (error) {
      this.logger.error('Error in sliding window rate limit', {
        error: error instanceof Error ? error.message : 'Unknown error',
        key,
      });

      return {
        allowed: true,
        limit,
        remaining: limit - 1,
        resetTime: new Date(now + windowMs),
      };
    }
  }

  /**
   * Exponential backoff rate limiting for repeated violations
   */
  async checkWithBackoff(
    key: string,
    baseLimit: number,
    windowMs: number,
  ): Promise<RateLimitResult> {
    const violationKey = `backoff-violations:${key}`;
    const violations = (await this.cacheService.get<number>(violationKey)) || 0;

    // Exponentially decrease limit based on violations
    const adjustedLimit = Math.max(1, Math.floor(baseLimit / Math.pow(2, violations)));

    const result = await this.checkLimit({
      key: `backoff:${key}`,
      limit: adjustedLimit,
      windowMs,
    });

    if (!result.allowed) {
      // Record violation
      await this.cacheService.set(
        violationKey,
        violations + 1,
        Math.ceil((windowMs * Math.pow(2, violations)) / 1000), // Exponential timeout
      );

      this.logger.warn('Rate limit violation recorded with backoff', {
        key,
        violations: violations + 1,
        adjustedLimit,
        baseLimit,
      });
    }

    return result;
  }

  /**
   * Token bucket rate limiter
   */
  async checkTokenBucket(
    key: string,
    capacity: number,
    refillRate: number, // tokens per second
    tokensRequested = 1,
  ): Promise<RateLimitResult> {
    const bucketKey = `bucket:${key}`;
    const now = Date.now();

    try {
      const bucket = (await this.cacheService.get<{
        tokens: number;
        lastRefill: number;
      }>(bucketKey)) || { tokens: capacity, lastRefill: now };

      // Calculate tokens to add based on time elapsed
      const timeDelta = (now - bucket.lastRefill) / 1000; // seconds
      const tokensToAdd = Math.floor(timeDelta * refillRate);
      const newTokens = Math.min(capacity, bucket.tokens + tokensToAdd);

      if (newTokens < tokensRequested) {
        // Not enough tokens
        const waitTime = Math.ceil((tokensRequested - newTokens) / refillRate);

        return {
          allowed: false,
          limit: capacity,
          remaining: newTokens,
          resetTime: new Date(now + waitTime * 1000),
          retryAfter: waitTime,
        };
      }

      // Consume tokens
      const updatedBucket = {
        tokens: newTokens - tokensRequested,
        lastRefill: now,
      };

      await this.cacheService.set(bucketKey, updatedBucket, 3600); // 1 hour expiry

      return {
        allowed: true,
        limit: capacity,
        remaining: updatedBucket.tokens,
        resetTime: new Date(now + ((capacity - updatedBucket.tokens) / refillRate) * 1000),
      };
    } catch (error) {
      this.logger.error('Error in token bucket rate limit', {
        error: error instanceof Error ? error.message : 'Unknown error',
        key,
      });

      return {
        allowed: true,
        limit: capacity,
        remaining: capacity - tokensRequested,
        resetTime: new Date(now + 60000), // 1 minute
      };
    }
  }

  /**
   * Get rate limit statistics for monitoring
   */
  async getStats(): Promise<{
    totalKeys: number;
    activeWindows: number;
    topKeys: Array<{ key: string; count: number }>;
  }> {
    try {
      // This would need to be implemented based on your Redis setup
      // For now, return placeholder data
      return {
        totalKeys: 0,
        activeWindows: 0,
        topKeys: [],
      };
    } catch (error) {
      this.logger.error('Error getting rate limit stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        totalKeys: 0,
        activeWindows: 0,
        topKeys: [],
      };
    }
  }
}
