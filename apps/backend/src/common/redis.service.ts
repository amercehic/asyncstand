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

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
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

  onModuleDestroy() {
    this.client.disconnect();
  }
}
