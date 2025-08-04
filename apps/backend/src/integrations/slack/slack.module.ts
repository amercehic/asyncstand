import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SlackOauthController } from '@/integrations/slack/slack-oauth.controller';
import { SlackIntegrationController } from '@/integrations/slack/slack-integration.controller';
import { SlackWebhookController } from '@/integrations/slack/slack-webhook.controller';
import { SlackOauthService } from '@/integrations/slack/slack-oauth.service';
import { SlackApiService } from '@/integrations/slack/slack-api.service';
import { SlackMessagingService } from '@/integrations/slack/slack-messaging.service';
import { SlackMessageFormatterService } from '@/integrations/slack/slack-message-formatter.service';
import { SlackEventService } from '@/integrations/slack/slack-event.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { RedisService } from '@/common/redis.service';
import { LoggerService } from '@/common/logger.service';
import { AuditModule } from '@/common/audit/audit.module';

@Module({
  imports: [ConfigModule, PrismaModule, AuditModule],
  controllers: [SlackOauthController, SlackIntegrationController, SlackWebhookController],
  providers: [
    SlackOauthService,
    SlackApiService,
    SlackMessagingService,
    SlackMessageFormatterService,
    SlackEventService,
    RedisService,
    LoggerService,
  ],
  exports: [SlackOauthService, SlackApiService, SlackMessagingService, SlackEventService],
})
export class SlackModule {}
