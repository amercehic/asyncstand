import { Injectable } from '@nestjs/common';
import { CacheService } from '@/common/cache/cache.service';
import { LoggerService } from '@/common/logger.service';

@Injectable()
export class DistributedLockService {
  private readonly DEFAULT_TTL = 30; // 30 seconds default lock TTL
  private readonly RETRY_DELAY = 50; // 50ms between retry attempts
  private readonly MAX_RETRIES = 20; // Max 1 second of retries

  constructor(
    private readonly cacheService: CacheService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(DistributedLockService.name);
  }

  /**
   * Acquire a distributed lock with automatic retry
   */
  async acquireLock(
    lockKey: string,
    ttlSeconds = this.DEFAULT_TTL,
    maxRetries = this.MAX_RETRIES,
  ): Promise<string> {
    const lockId = this.generateLockId();
    const fullLockKey = this.buildLockKey(lockKey);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Use SET with NX (not exists) and EX (expiry) for atomic lock acquisition
        const acquired = await this.cacheService.setIfNotExists(fullLockKey, lockId, ttlSeconds);

        if (acquired) {
          this.logger.debug('Lock acquired successfully', {
            lockKey: fullLockKey,
            lockId,
            attempt,
            ttlSeconds,
          });
          return lockId;
        }

        if (attempt < maxRetries) {
          await this.sleep(this.RETRY_DELAY);
        }
      } catch (error) {
        this.logger.error('Error acquiring lock', {
          lockKey: fullLockKey,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    }

    throw new Error(`Failed to acquire lock ${lockKey} after ${maxRetries} attempts`);
  }

  /**
   * Release a distributed lock
   */
  async releaseLock(lockKey: string, lockId: string): Promise<boolean> {
    const fullLockKey = this.buildLockKey(lockKey);

    try {
      // Use Lua script to ensure atomic check-and-delete
      const script = `
        if redis.call("GET", KEYS[1]) == ARGV[1] then
          return redis.call("DEL", KEYS[1])
        else
          return 0
        end
      `;

      const result = await this.cacheService.executeScript(script, [fullLockKey], [lockId]);
      const released = result === 1;

      this.logger.debug('Lock release attempt', {
        lockKey: fullLockKey,
        lockId,
        released,
      });

      return released;
    } catch (error) {
      this.logger.error('Error releasing lock', {
        lockKey: fullLockKey,
        lockId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Execute a function with distributed lock protection
   */
  async withLock<T>(
    lockKey: string,
    fn: () => Promise<T>,
    ttlSeconds = this.DEFAULT_TTL,
  ): Promise<T> {
    let lockId: string | null = null;

    try {
      lockId = await this.acquireLock(lockKey, ttlSeconds);
      return await fn();
    } finally {
      if (lockId) {
        await this.releaseLock(lockKey, lockId);
      }
    }
  }

  /**
   * Check if a lock exists
   */
  async isLocked(lockKey: string): Promise<boolean> {
    const fullLockKey = this.buildLockKey(lockKey);
    try {
      const lockValue = await this.cacheService.get(fullLockKey);
      return lockValue !== null;
    } catch (error) {
      this.logger.error('Error checking lock status', {
        lockKey: fullLockKey,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Extend lock TTL
   */
  async extendLock(lockKey: string, lockId: string, ttlSeconds: number): Promise<boolean> {
    const fullLockKey = this.buildLockKey(lockKey);

    try {
      // Use Lua script for atomic check-and-extend
      const script = `
        if redis.call("GET", KEYS[1]) == ARGV[1] then
          return redis.call("EXPIRE", KEYS[1], ARGV[2])
        else
          return 0
        end
      `;

      const result = await this.cacheService.executeScript(
        script,
        [fullLockKey],
        [lockId, ttlSeconds.toString()],
      );

      return result === 1;
    } catch (error) {
      this.logger.error('Error extending lock', {
        lockKey: fullLockKey,
        lockId,
        ttlSeconds,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  private generateLockId(): string {
    return `lock-${Date.now()}-${Math.random().toString(36).substring(2)}`;
  }

  private buildLockKey(lockKey: string): string {
    return this.cacheService.buildKey('distributed-lock', lockKey);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
