import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { LoggerService } from '@/common/logger.service';
import { StandupSchedulerService } from '@/standups/standup-scheduler.service';
import { StandupInstanceService } from '@/standups/standup-instance.service';
import { StandupReminderService } from '@/standups/standup-reminder.service';
import { StandupInstanceState } from '@/standups/dto/update-instance-state.dto';

export interface DailyStandupJobData {
  date: Date;
}

export interface CollectionStartJobData {
  instanceId: string;
  teamId: string;
}

export interface CollectionTimeoutJobData {
  instanceId: string;
  timeoutMinutes: number;
}

export interface CleanupJobData {
  cutoffDate: Date;
}

export interface FollowupReminderJobData {
  instanceId: string;
  reminderType: string;
}

@Injectable()
@Processor('standup-scheduler')
export class StandupSchedulerProcessor {
  constructor(
    private readonly logger: LoggerService,
    private readonly standupSchedulerService: StandupSchedulerService,
    private readonly standupInstanceService: StandupInstanceService,
    private readonly standupReminderService: StandupReminderService,
  ) {
    this.logger.setContext(StandupSchedulerProcessor.name);
  }

  /**
   * Process daily standup creation job
   * Runs daily at midnight UTC
   */
  @Process('create-daily-standups')
  async handleCreateDailyStandups(job: Job<DailyStandupJobData>) {
    this.logger.info('Processing create daily standups job', {
      jobId: job.id,
      date: job.data.date,
    });

    try {
      const result = await this.standupSchedulerService.scheduleDailyStandups(job.data.date);

      this.logger.info('Daily standups creation completed', {
        jobId: job.id,
        result,
      });

      return {
        success: true,
        processed: result.processed,
        created: result.created,
        skipped: result.skipped,
        errors: result.errors,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Daily standups creation failed', {
        jobId: job.id,
        error: errorMessage,
      });

      throw error; // Re-throw to mark job as failed
    }
  }

  /**
   * Process collection start job
   * Activates standup collection for an instance
   */
  @Process('start-collection')
  async handleStartCollection(job: Job<CollectionStartJobData>) {
    this.logger.info('Processing start collection job', {
      jobId: job.id,
      instanceId: job.data.instanceId,
    });

    try {
      const { instanceId } = job.data;

      // Verify instance exists and is in pending state
      const instance = await this.standupInstanceService.getInstanceWithDetails(instanceId, '');

      if (!instance) {
        this.logger.warn('Instance not found for collection start', {
          jobId: job.id,
          instanceId,
        });
        return { success: false, message: 'Instance not found' };
      }

      if (instance.state !== StandupInstanceState.PENDING) {
        this.logger.warn('Instance not in pending state', {
          jobId: job.id,
          instanceId,
          currentState: instance.state,
        });
        return { success: false, message: `Instance in ${instance.state} state` };
      }

      // Start collection
      await this.standupSchedulerService.startCollection(instanceId);

      // Send Slack reminder
      await this.standupReminderService.triggerStandupReminder(instanceId);

      this.logger.info('Collection started successfully', {
        jobId: job.id,
        instanceId,
      });

      return {
        success: true,
        instanceId,
        message: 'Collection started',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Start collection job failed', {
        jobId: job.id,
        instanceId: job.data.instanceId,
        error: errorMessage,
      });

      throw error;
    }
  }

  /**
   * Process collection timeout job
   * Handles timeout for standup collection
   */
  @Process('collection-timeout')
  async handleCollectionTimeout(job: Job<CollectionTimeoutJobData>) {
    this.logger.info('Processing collection timeout job', {
      jobId: job.id,
      instanceId: job.data.instanceId,
    });

    try {
      const { instanceId } = job.data;

      // Verify instance exists and is in collecting state
      const instance = await this.standupInstanceService.getInstanceWithDetails(instanceId, '');

      if (!instance) {
        this.logger.warn('Instance not found for collection timeout', {
          jobId: job.id,
          instanceId,
        });
        return { success: false, message: 'Instance not found' };
      }

      if (instance.state !== StandupInstanceState.COLLECTING) {
        this.logger.warn('Instance not in collecting state', {
          jobId: job.id,
          instanceId,
          currentState: instance.state,
        });
        return { success: false, message: `Instance in ${instance.state} state` };
      }

      // Handle timeout
      await this.standupSchedulerService.handleCollectionTimeout(instanceId);

      // Post summary to Slack
      await this.standupReminderService.handleCollectionComplete(instanceId);

      this.logger.info('Collection timeout handled successfully', {
        jobId: job.id,
        instanceId,
      });

      return {
        success: true,
        instanceId,
        message: 'Collection timeout handled',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Collection timeout job failed', {
        jobId: job.id,
        instanceId: job.data.instanceId,
        error: errorMessage,
      });

      throw error;
    }
  }

  /**
   * Process cleanup job
   * Archives old completed standup instances
   */
  @Process('cleanup-old-instances')
  async handleCleanupOldInstances(job: Job<CleanupJobData>) {
    this.logger.info('Processing cleanup old instances job', {
      jobId: job.id,
      cutoffDate: job.data.cutoffDate,
    });

    try {
      const result = await this.standupInstanceService.archiveOldInstances(job.data.cutoffDate);

      this.logger.info('Cleanup completed successfully', {
        jobId: job.id,
        archived: result.archived,
      });

      return {
        success: true,
        archived: result.archived,
        message: `Archived ${result.archived} old instances`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Cleanup job failed', {
        jobId: job.id,
        error: errorMessage,
      });

      throw error;
    }
  }

  /**
   * Process followup reminder job
   */
  @Process('followup-reminder')
  async handleFollowupReminder(job: Job<FollowupReminderJobData>) {
    this.logger.info('Processing followup reminder job', {
      jobId: job.id,
      instanceId: job.data.instanceId,
      reminderType: job.data.reminderType,
    });

    try {
      const { instanceId, reminderType } = job.data;

      if (reminderType === 'timeout_warning') {
        await this.standupReminderService.sendTimeoutWarning(instanceId);
      } else {
        await this.standupReminderService.sendFollowupToMissingUsers(instanceId, reminderType);
      }

      // Also check if standup should be completed
      await this.standupReminderService.checkAndCompleteStandup(instanceId);

      this.logger.info('Followup reminder processed successfully', {
        jobId: job.id,
        instanceId,
        reminderType,
      });

      return {
        success: true,
        instanceId,
        reminderType,
        message: 'Followup reminder sent',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Followup reminder job failed', {
        jobId: job.id,
        instanceId: job.data.instanceId,
        reminderType: job.data.reminderType,
        error: errorMessage,
      });

      throw error;
    }
  }

  /**
   * Handle job completion
   */
  onCompleted(job: Job, result: unknown) {
    this.logger.info('Job completed successfully', {
      jobId: job.id,
      jobName: job.name,
      result,
    });
  }

  /**
   * Handle job failure
   */
  onFailed(job: Job, error: Error) {
    this.logger.error('Job failed', {
      jobId: job.id,
      jobName: job.name,
      error: error.message,
      attempts: job.attemptsMade,
      maxAttempts: job.opts.attempts || 1,
    });
  }

  /**
   * Handle job retry
   */
  onStalled(job: Job) {
    this.logger.warn('Job stalled', {
      jobId: job.id,
      jobName: job.name,
    });
  }
}
