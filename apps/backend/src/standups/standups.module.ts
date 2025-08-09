import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { StandupConfigController } from '@/standups/standup-config.controller';
import { StandupInstanceController } from '@/standups/standup-instance.controller';
import { AnswerCollectionController } from '@/standups/answer-collection.controller';
import { StandupConfigService } from '@/standups/standup-config.service';
import { StandupInstanceService } from '@/standups/standup-instance.service';
import { AnswerCollectionService } from '@/standups/answer-collection.service';
import { StandupSchedulerService } from '@/standups/standup-scheduler.service';
import { StandupReminderService } from '@/standups/standup-reminder.service';
import { StandupJobService } from '@/standups/jobs/standup-job.service';
import { StandupSchedulerProcessor } from '@/standups/jobs/standup-scheduler.processor';
import { TimezoneService } from '@/common/services/timezone.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuditModule } from '@/common/audit/audit.module';
import { SlackModule } from '@/integrations/slack/slack.module';
import { LoggerService } from '@/common/logger.service';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    SlackModule,
    BullModule.registerQueue({
      name: 'standup-scheduler',
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    }),
  ],
  controllers: [StandupConfigController, StandupInstanceController, AnswerCollectionController],
  providers: [
    StandupConfigService,
    StandupInstanceService,
    AnswerCollectionService,
    StandupSchedulerService,
    StandupReminderService,
    StandupJobService,
    StandupSchedulerProcessor,
    TimezoneService,
    LoggerService,
  ],
  exports: [
    StandupConfigService,
    StandupInstanceService,
    AnswerCollectionService,
    StandupSchedulerService,
    StandupReminderService,
    StandupJobService,
  ],
})
export class StandupsModule {}
