import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { LoggerService } from '@/common/logger.service';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(RedisService.name);
    const redisUrl = this.configService.get<string>('redisUrl');
    this.client = new Redis(redisUrl);

    this.client.on('connect', () => {
      this.logger.debug('Connected to Redis');
    });

    this.client.on('error', (error) => {
      this.logger.error('Redis connection error', { error: error.message });
    });
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  async del(...keys: string[]): Promise<number> {
    return await this.client.del(...keys);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async keys(pattern: string): Promise<string[]> {
    return await this.client.keys(pattern);
  }

  async incr(key: string): Promise<number> {
    return await this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return await this.client.expire(key, seconds);
  }

  async info(section?: string): Promise<string> {
    return await this.client.info(section);
  }

  async dbsize(): Promise<number> {
    return await this.client.dbsize();
  }

  async generateStateToken(orgId: string): Promise<string> {
    const crypto = await import('crypto');
    const state = crypto.randomBytes(32).toString('hex');
    const key = `slack_oauth_state:${state}`;

    // Store state with orgId for 10 minutes
    await this.set(key, orgId, 600);
    return state;
  }

  async validateStateToken(state: string): Promise<string | null> {
    const key = `slack_oauth_state:${state}`;
    const orgId = await this.get(key);

    if (orgId) {
      // Delete the token after validation (one-time use)
      await this.del(key);
    }

    return orgId;
  }

  /**
   * Set if not exists with TTL (atomic operation)
   */
  async setNX(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  /**
   * Execute Lua script
   */
  async eval(script: string, keys: string[], args: string[]): Promise<unknown> {
    return await this.client.eval(script, keys.length, ...keys, ...args);
  }

  onModuleDestroy() {
    this.client.disconnect();
  }
}
