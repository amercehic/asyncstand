import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, JobOptions } from 'bull';
import { LoggerService } from '@/common/logger.service';
import {
  DailyStandupJobData,
  CollectionStartJobData,
  CollectionTimeoutJobData,
  CleanupJobData,
} from '@/standups/jobs/standup-scheduler.processor';

@Injectable()
export class StandupJobService {
  constructor(
    @InjectQueue('standup-scheduler')
    private readonly standupQueue: Queue,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(StandupJobService.name);
  }

  /**
   * Schedule daily standup creation job
   * Typically scheduled to run at midnight UTC daily
   */
  async scheduleDailyStandupCreation(date: Date, delay?: number): Promise<string> {
    const jobData: DailyStandupJobData = { date };

    const options: JobOptions = {
      removeOnComplete: 10, // Keep last 10 completed jobs
      removeOnFail: 5, // Keep last 5 failed jobs
      attempts: 3, // Retry up to 3 times
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    };

    if (delay) {
      options.delay = delay;
    }

    const job = await this.standupQueue.add('create-daily-standups', jobData, options);

    this.logger.info('Scheduled daily standup creation job', {
      jobId: job.id,
      date: date.toISOString(),
      delay,
    });

    return job.id.toString();
  }

  /**
   * Schedule collection start job for a specific time
   */
  async scheduleCollectionStart(
    instanceId: string,
    teamId: string,
    startTime: Date,
  ): Promise<string> {
    const delay = Math.max(0, startTime.getTime() - Date.now());

    const jobData: CollectionStartJobData = {
      instanceId,
      teamId,
    };

    const options: JobOptions = {
      delay,
      removeOnComplete: 10,
      removeOnFail: 5,
      attempts: 2,
      backoff: {
        type: 'fixed',
        delay: 30000, // 30 seconds
      },
    };

    const job = await this.standupQueue.add('start-collection', jobData, options);

    this.logger.info('Scheduled collection start job', {
      jobId: job.id,
      instanceId,
      startTime: startTime.toISOString(),
      delay,
    });

    return job.id.toString();
  }

  /**
   * Schedule collection timeout job
   */
  async scheduleCollectionTimeout(
    instanceId: string,
    timeoutTime: Date,
    timeoutMinutes: number,
  ): Promise<string> {
    const delay = Math.max(0, timeoutTime.getTime() - Date.now());

    const jobData: CollectionTimeoutJobData = {
      instanceId,
      timeoutMinutes,
    };

    const options: JobOptions = {
      delay,
      removeOnComplete: 10,
      removeOnFail: 5,
      attempts: 2,
      backoff: {
        type: 'fixed',
        delay: 60000, // 1 minute
      },
    };

    const job = await this.standupQueue.add('collection-timeout', jobData, options);

    this.logger.info('Scheduled collection timeout job', {
      jobId: job.id,
      instanceId,
      timeoutTime: timeoutTime.toISOString(),
      delay,
    });

    return job.id.toString();
  }

  /**
   * Schedule cleanup job for old instances
   */
  async scheduleCleanup(cutoffDate: Date, delay?: number): Promise<string> {
    const jobData: CleanupJobData = { cutoffDate };

    const options: JobOptions = {
      removeOnComplete: 5,
      removeOnFail: 3,
      attempts: 2,
      backoff: {
        type: 'fixed',
        delay: 300000, // 5 minutes
      },
    };

    if (delay) {
      options.delay = delay;
    }

    const job = await this.standupQueue.add('cleanup-old-instances', jobData, options);

    this.logger.info('Scheduled cleanup job', {
      jobId: job.id,
      cutoffDate: cutoffDate.toISOString(),
      delay,
    });

    return job.id.toString();
  }

  /**
   * Schedule recurring daily standup creation
   * This would typically be set up once on application startup
   */
  async scheduleRecurringDailyStandups(): Promise<void> {
    // Remove any existing recurring job
    await this.standupQueue.removeRepeatable('create-daily-standups', {
      cron: '0 0 * * *', // Daily at midnight UTC
    });

    // Add new recurring job
    await this.standupQueue.add(
      'create-daily-standups',
      { date: new Date() }, // This will be updated each time the job runs
      {
        repeat: { cron: '0 0 * * *' }, // Daily at midnight UTC
        removeOnComplete: 10,
        removeOnFail: 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );

    this.logger.info('Scheduled recurring daily standup creation job');
  }

  /**
   * Schedule recurring cleanup job
   * Runs weekly to clean up old instances
   */
  async scheduleRecurringCleanup(): Promise<void> {
    // Remove any existing recurring cleanup job
    await this.standupQueue.removeRepeatable('cleanup-old-instances', {
      cron: '0 2 * * 0', // Weekly on Sunday at 2 AM UTC
    });

    // Add new recurring cleanup job
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 days ago

    await this.standupQueue.add(
      'cleanup-old-instances',
      { cutoffDate },
      {
        repeat: { cron: '0 2 * * 0' }, // Weekly on Sunday at 2 AM UTC
        removeOnComplete: 5,
        removeOnFail: 3,
        attempts: 2,
      },
    );

    this.logger.info('Scheduled recurring cleanup job');
  }

  /**
   * Get job status and statistics
   */
  async getJobStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.standupQueue.getWaiting(),
      this.standupQueue.getActive(),
      this.standupQueue.getCompleted(),
      this.standupQueue.getFailed(),
      this.standupQueue.getDelayed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    };
  }

  /**
   * Get recent jobs for monitoring
   */
  async getRecentJobs(limit = 20): Promise<
    Array<{
      id: string;
      name: string;
      data: unknown;
      opts: JobOptions;
      progress: number;
      delay: number;
      timestamp: number;
      attemptsMade: number;
      failedReason?: string;
      finishedOn?: number;
      processedOn?: number;
    }>
  > {
    const jobs = await this.standupQueue.getJobs(
      ['waiting', 'active', 'completed', 'failed'],
      0,
      limit,
    );

    return jobs.map((job) => ({
      id: job.id.toString(),
      name: job.name,
      data: job.data,
      opts: job.opts,
      progress: job.progress(),
      delay: job.opts?.delay || null,
      timestamp: job.timestamp,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
    }));
  }

  /**
   * Cancel a specific job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.standupQueue.getJob(jobId);
      if (job) {
        await job.remove();
        this.logger.info('Job cancelled successfully', { jobId });
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error('Failed to cancel job', {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.standupQueue.getJob(jobId);
      if (job && job.isFailed()) {
        await job.retry();
        this.logger.info('Job retried successfully', { jobId });
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error('Failed to retry job', {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Clean completed and failed jobs
   */
  async cleanJobs(grace = 24 * 60 * 60 * 1000): Promise<{ cleaned: number }> {
    const completedJobs = await this.standupQueue.clean(grace, 'completed');
    const failedJobs = await this.standupQueue.clean(grace, 'failed');
    const cleaned = completedJobs.length + failedJobs.length;

    this.logger.info('Cleaned old jobs', { cleaned, grace });

    return { cleaned };
  }

  /**
   * Pause job processing
   */
  async pauseQueue(): Promise<void> {
    await this.standupQueue.pause();
    this.logger.info('Queue paused');
  }

  /**
   * Resume job processing
   */
  async resumeQueue(): Promise<void> {
    await this.standupQueue.resume();
    this.logger.info('Queue resumed');
  }
}
