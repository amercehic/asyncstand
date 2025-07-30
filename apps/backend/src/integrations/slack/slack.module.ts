import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SlackOauthController } from '@/integrations/slack/slack-oauth.controller';
import { SlackOauthService } from '@/integrations/slack/slack-oauth.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { RedisService } from '@/common/redis.service';
import { LoggerService } from '@/common/logger.service';
import { AuditModule } from '@/common/audit/audit.module';

@Module({
  imports: [ConfigModule, PrismaModule, AuditModule],
  controllers: [SlackOauthController],
  providers: [SlackOauthService, RedisService, LoggerService],
  exports: [SlackOauthService],
})
export class SlackModule {}
