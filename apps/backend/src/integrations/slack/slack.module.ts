import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { SlackEventsController } from '@/integrations/slack/controllers/slack-events.controller';
import { SlackEventProcessorController } from '@/integrations/slack/controllers/slack-event-processor.controller';
import { SlackInstallController } from '@/integrations/slack/controllers/slack-install.controller';
import { SlackCommandsController } from '@/integrations/slack/controllers/slack-commands.controller';
import { SlackOAuthController } from '@/integrations/slack/controllers/slack-oauth.controller';
import { SlackSignatureMiddleware } from '@/integrations/slack/middleware/slack-signature.middleware';
import { HmacVerificationGuard } from '@/integrations/slack/guards/hmac-verification.guard';
import { EventTransformerService } from '@/integrations/slack/services/event-transformer.service';
import { DeduplicationService } from '@/integrations/slack/services/deduplication.service';
import { HttpClientService } from '@/integrations/slack/services/http-client.service';
import { SlackInstallService } from '@/integrations/slack/services/slack-install.service';
import { StandupAnalyticsService } from '@/integrations/slack/services/standup-analytics.service';
import { StandupSchedulerJob } from '@/integrations/slack/jobs/standup-scheduler.job';
import { StandupDigestJob } from '@/integrations/slack/jobs/standup-digest.job';
import { StandupReminderJob } from '@/integrations/slack/jobs/standup-reminder.job';
import { PrismaModule } from '@/prisma/prisma.module';
import { RedisService } from '@/common/redis.service';
import { LoggerService } from '@/common/logger.service';
import { AuditModule } from '@/common/audit/audit.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuditModule,
    // Only import ScheduleModule in non-test environments
    ...(process.env.NODE_ENV !== 'test' ? [ScheduleModule.forRoot()] : []),
  ],
  controllers: [
    SlackEventsController,
    SlackEventProcessorController,
    SlackInstallController,
    SlackCommandsController,
    SlackOAuthController,
  ],
  providers: [
    SlackInstallService,
    EventTransformerService,
    DeduplicationService,
    HttpClientService,
    StandupAnalyticsService,
    HmacVerificationGuard,
    RedisService,
    LoggerService,
    // Only include jobs in non-test environments
    ...(process.env.NODE_ENV !== 'test'
      ? [StandupSchedulerJob, StandupDigestJob, StandupReminderJob]
      : []),
  ],
  exports: [
    SlackInstallService,
    EventTransformerService,
    DeduplicationService,
    HttpClientService,
    StandupAnalyticsService,
  ],
})
export class SlackModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SlackSignatureMiddleware)
      .forRoutes(
        { path: 'slack/events', method: RequestMethod.POST },
        { path: 'slack/interactive', method: RequestMethod.POST },
        { path: 'slack/install', method: RequestMethod.POST },
        { path: 'slack/commands/*path', method: RequestMethod.POST },
      );
  }
}
