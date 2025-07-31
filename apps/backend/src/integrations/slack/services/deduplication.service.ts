import { Injectable } from '@nestjs/common';
import { RedisService } from '@/common/redis.service';
import { LoggerService } from '@/common/logger.service';

@Injectable()
export class DeduplicationService {
  private readonly keyPrefix = 'slack:event:';
  private readonly ttlSeconds = 60 * 60; // 1 hour

  constructor(
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(DeduplicationService.name);
  }

  async isDuplicate(eventId: string): Promise<boolean> {
    try {
      const key = `${this.keyPrefix}${eventId}`;

      // Use SETNX to atomically check and set if not exists
      // Returns 1 if key was set (not duplicate), 0 if key already exists (duplicate)
      const result = await this.redisService.getClient().setnx(key, '1');

      if (result === 1) {
        // Key was set, not a duplicate - set expiration
        await this.redisService.getClient().expire(key, this.ttlSeconds);
        this.logger.debug('Event marked as processed', { eventId });
        return false;
      } else {
        // Key already exists, this is a duplicate
        this.logger.warn('Duplicate event detected', { eventId });
        return true;
      }
    } catch (error) {
      this.logger.error('Failed to check event duplication', {
        eventId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // On Redis error, allow the event through to avoid blocking
      // This is safer than potentially dropping legitimate events
      return false;
    }
  }

  async markAsProcessed(eventId: string): Promise<void> {
    try {
      const key = `${this.keyPrefix}${eventId}`;
      await this.redisService.getClient().setex(key, this.ttlSeconds, '1');
      this.logger.debug('Event marked as processed', { eventId });
    } catch (error) {
      this.logger.error('Failed to mark event as processed', {
        eventId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Non-blocking error - don't throw
    }
  }

  async clearEvent(eventId: string): Promise<void> {
    try {
      const key = `${this.keyPrefix}${eventId}`;
      await this.redisService.getClient().del(key);
      this.logger.debug('Event cleared from deduplication cache', { eventId });
    } catch (error) {
      this.logger.error('Failed to clear event from deduplication cache', {
        eventId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Non-blocking error - don't throw
    }
  }

  async getStats(): Promise<{
    totalEvents: number;
    keyPattern: string;
    ttlSeconds: number;
  }> {
    try {
      const pattern = `${this.keyPrefix}*`;
      const keys = await this.redisService.getClient().keys(pattern);

      return {
        totalEvents: keys.length,
        keyPattern: pattern,
        ttlSeconds: this.ttlSeconds,
      };
    } catch (error) {
      this.logger.error('Failed to get deduplication stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        totalEvents: -1,
        keyPattern: this.keyPrefix,
        ttlSeconds: this.ttlSeconds,
      };
    }
  }
}
