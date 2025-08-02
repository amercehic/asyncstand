import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SlackOauthController } from '@/integrations/slack/slack-oauth.controller';
import { SlackIntegrationController } from '@/integrations/slack/slack-integration.controller';
import { SlackOauthService } from '@/integrations/slack/slack-oauth.service';
import { SlackApiService } from '@/integrations/slack/slack-api.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { RedisService } from '@/common/redis.service';
import { LoggerService } from '@/common/logger.service';
import { AuditModule } from '@/common/audit/audit.module';

@Module({
  imports: [ConfigModule, PrismaModule, AuditModule],
  controllers: [SlackOauthController, SlackIntegrationController],
  providers: [SlackOauthService, SlackApiService, RedisService, LoggerService],
  exports: [SlackOauthService, SlackApiService],
})
export class SlackModule {}
