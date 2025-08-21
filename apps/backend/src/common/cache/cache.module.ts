import { Module } from '@nestjs/common';
import { CacheService } from '@/common/cache/cache.service';
import { RedisService } from '@/common/redis.service';
import { LoggerService } from '@/common/logger.service';

@Module({
  providers: [CacheService, RedisService, LoggerService],
  exports: [CacheService],
})
export class CacheModule {}
