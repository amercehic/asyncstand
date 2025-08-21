import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { validate, envConfig } from '@/config/env';
import { AuthModule } from '@/auth/auth.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { createLoggerModule } from '@/config/logger.config';
import { LoggerService } from '@/common/logger.service';
import { AuditModule } from '@/common/audit/audit.module';
import { IntegrationsModule } from '@/integrations/integrations.module';
import { TeamsModule } from '@/teams/teams.module';
import { StandupsModule } from '@/standups/standups.module';
import { CacheModule } from '@/common/cache/cache.module';
import { CacheInterceptor } from '@/common/cache/cache.interceptor';
import { QueryPerformanceInterceptor } from '@/common/interceptors/query-performance.interceptor';
import { CustomThrottlerGuard } from '@/common/guards/throttler.guard';
import { CsrfGuard } from '@/common/security/csrf.guard';
import { SecurityModule } from '@/common/security/security.module';
import { RateLimitService } from '@/common/services/rate-limit.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: '.env',
      load: [envConfig],
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD'),
          username: configService.get<string>('REDIS_USERNAME'),
          db: configService.get<number>('REDIS_DB', 0),
        },
        defaultJobOptions: {
          removeOnComplete: 10,
          removeOnFail: 5,
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: () => ({
        throttlers: [
          {
            name: 'short',
            ttl: 1000, // 1 second
            limit: 20, // 20 requests per second (generous for normal usage)
          },
          {
            name: 'medium',
            ttl: 60000, // 1 minute
            limit: 200, // 200 requests per minute
          },
          {
            name: 'long',
            ttl: 900000, // 15 minutes
            limit: 2000, // 2000 requests per 15 minutes
          },
        ],
        skipIf: () => {
          // Skip throttling in test environment
          return process.env.NODE_ENV === 'test';
        },
        generateKey: (context, tracker, throttlerName) => {
          const request = context.switchToHttp().getRequest();
          const userId = request.user?.id || 'anonymous';
          const orgId = request.user?.organizationId || 'no-org';
          return `throttle:${throttlerName}:${userId}:${orgId}:${tracker}`;
        },
        // Use memory storage by default, can be switched to Redis for production
        // storage: new ThrottlerStorageRedisService(redisClient),
      }),
    }),
    createLoggerModule(),
    PrismaModule,
    AuditModule,
    CacheModule,
    SecurityModule,
    AuthModule,
    IntegrationsModule,
    TeamsModule,
    StandupsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    LoggerService,
    RateLimitService,
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: QueryPerformanceInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
  ],
})
export class AppModule {}
