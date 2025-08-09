import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { SlackMessagingService } from '@/integrations/slack/slack-messaging.service';
import { LoggerService } from '@/common/logger.service';
import { PrismaService } from '@/prisma/prisma.service';
import { StandupInstanceState } from '@prisma/client';

@Injectable()
export class StandupReminderService {
  constructor(
    @InjectQueue('standup-scheduler')
    private readonly standupQueue: Queue,
    private readonly slackMessaging: SlackMessagingService,
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
  ) {}

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  async triggerStandupReminder(instanceId: string): Promise<void> {
    try {
      this.logger.info('Triggering standup reminder', { instanceId });

      // Send the initial reminder to Slack
      const result = await this.slackMessaging.sendStandupReminder(instanceId);

      if (!result.ok) {
        this.logger.error('Failed to send standup reminder', {
          instanceId,
          error: result.error,
        });
        return;
      }

      // Schedule followup reminders
      await this.scheduleFollowupReminders(instanceId);

      this.logger.info('Standup reminder sent successfully', {
        instanceId,
        messageTs: result.ts,
      });
    } catch (error) {
      this.logger.error('Error triggering standup reminder', {
        instanceId,
        error: this.getErrorMessage(error),
      });
    }
  }

  async scheduleFollowupReminders(instanceId: string): Promise<void> {
    try {
      const instance = await this.prisma.standupInstance.findFirst({
        where: { id: instanceId },
        select: {
          id: true,
          createdAt: true,
          configSnapshot: true,
        },
      });

      if (!instance) {
        this.logger.error('Instance not found for followup reminders', { instanceId });
        return;
      }

      const configSnapshot = instance.configSnapshot as {
        responseTimeoutHours: number;
      };

      const timeoutHours = configSnapshot.responseTimeoutHours;
      const createdAt = instance.createdAt;

      // Schedule reminder at 50% of timeout period
      const halfwayPoint = new Date(createdAt.getTime() + timeoutHours * 0.5 * 60 * 60 * 1000);
      await this.scheduleFollowupJob(instanceId, halfwayPoint, 'halfway');

      // Schedule reminder at 80% of timeout period
      const lateReminder = new Date(createdAt.getTime() + timeoutHours * 0.8 * 60 * 60 * 1000);
      await this.scheduleFollowupJob(instanceId, lateReminder, 'late');

      // Schedule timeout warning at 95% of timeout period
      const timeoutWarning = new Date(createdAt.getTime() + timeoutHours * 0.95 * 60 * 60 * 1000);
      await this.scheduleFollowupJob(instanceId, timeoutWarning, 'timeout_warning');

      this.logger.info('Followup reminders scheduled', {
        instanceId,
        halfwayPoint,
        lateReminder,
        timeoutWarning,
      });
    } catch (error) {
      this.logger.error('Error scheduling followup reminders', {
        instanceId,
        error: this.getErrorMessage(error),
      });
    }
  }

  async sendTimeoutWarning(instanceId: string): Promise<void> {
    try {
      this.logger.info('Sending timeout warning', { instanceId });

      // Get missing users
      const missingUsers = await this.getMissingUsers(instanceId);

      if (missingUsers.length === 0) {
        this.logger.info('No missing users for timeout warning', { instanceId });
        return;
      }

      // Send followup reminder
      const results = await this.slackMessaging.sendFollowupReminder(
        instanceId,
        missingUsers.map((u) => u.platformUserId),
      );

      const successCount = results.filter((r) => r.ok).length;
      this.logger.info('Timeout warning sent', {
        instanceId,
        totalSent: results.length,
        successCount,
      });
    } catch (error) {
      this.logger.error('Error sending timeout warning', {
        instanceId,
        error: this.getErrorMessage(error),
      });
    }
  }

  async handleCollectionComplete(instanceId: string): Promise<void> {
    try {
      this.logger.info('Handling collection complete', { instanceId });

      // Update instance state to posted
      await this.prisma.standupInstance.update({
        where: { id: instanceId },
        data: { state: StandupInstanceState.posted },
      });

      // Post summary to Slack
      const result = await this.slackMessaging.postStandupSummary(instanceId);

      if (!result.ok) {
        this.logger.error('Failed to post standup summary', {
          instanceId,
          error: result.error,
        });
        return;
      }

      this.logger.info('Standup summary posted successfully', {
        instanceId,
        messageTs: result.ts,
      });
    } catch (error) {
      this.logger.error('Error handling collection complete', {
        instanceId,
        error: this.getErrorMessage(error),
      });
    }
  }

  async sendFollowupToMissingUsers(instanceId: string, reminderType: string): Promise<void> {
    try {
      this.logger.info('Sending followup reminder', { instanceId, reminderType });

      const missingUsers = await this.getMissingUsers(instanceId);

      if (missingUsers.length === 0) {
        this.logger.info('No missing users for followup reminder', { instanceId, reminderType });
        return;
      }

      // Send followup reminder
      const results = await this.slackMessaging.sendFollowupReminder(
        instanceId,
        missingUsers.map((u) => u.platformUserId),
      );

      const successCount = results.filter((r) => r.ok).length;
      this.logger.info('Followup reminder sent', {
        instanceId,
        reminderType,
        totalSent: results.length,
        successCount,
        missingUserCount: missingUsers.length,
      });
    } catch (error) {
      this.logger.error('Error sending followup reminder', {
        instanceId,
        reminderType,
        error: this.getErrorMessage(error),
      });
    }
  }

  async checkAndCompleteStandup(instanceId: string): Promise<void> {
    try {
      const instance = await this.prisma.standupInstance.findFirst({
        where: { id: instanceId },
        select: {
          id: true,
          state: true,
          createdAt: true,
          configSnapshot: true,
        },
      });

      if (!instance) {
        this.logger.error('Instance not found for completion check', { instanceId });
        return;
      }

      if (instance.state !== StandupInstanceState.collecting) {
        this.logger.info('Instance not in collecting state, skipping completion check', {
          instanceId,
          state: instance.state,
        });
        return;
      }

      // Check if timeout has passed
      const configSnapshot = instance.configSnapshot as {
        responseTimeoutHours: number;
        participatingMembers: Array<{ id: string; platformUserId: string }>;
      };

      const timeoutDeadline = new Date(
        instance.createdAt.getTime() + configSnapshot.responseTimeoutHours * 60 * 60 * 1000,
      );

      const now = new Date();
      const hasTimedOut = now >= timeoutDeadline;

      // Check if all users have responded
      const respondedUsers = await this.prisma.answer.findMany({
        where: { standupInstanceId: instanceId },
        select: { teamMemberId: true },
        distinct: ['teamMemberId'],
      });

      const allUsersResponded = respondedUsers.length >= configSnapshot.participatingMembers.length;

      if (hasTimedOut || allUsersResponded) {
        this.logger.info('Completing standup', {
          instanceId,
          hasTimedOut,
          allUsersResponded,
          respondedCount: respondedUsers.length,
          totalCount: configSnapshot.participatingMembers.length,
        });

        await this.handleCollectionComplete(instanceId);
      }
    } catch (error) {
      this.logger.error('Error checking standup completion', {
        instanceId,
        error: this.getErrorMessage(error),
      });
    }
  }

  private async scheduleFollowupJob(
    instanceId: string,
    scheduledFor: Date,
    reminderType: string,
  ): Promise<void> {
    const delay = scheduledFor.getTime() - Date.now();

    if (delay <= 0) {
      this.logger.warn('Scheduled time is in the past, skipping followup job', {
        instanceId,
        reminderType,
        scheduledFor,
      });
      return;
    }

    const jobData = {
      instanceId,
      reminderType,
    };

    await this.standupQueue.add('followup-reminder', jobData, {
      delay,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });

    this.logger.debug('Followup reminder job scheduled', {
      instanceId,
      reminderType,
      scheduledFor,
      delay,
    });
  }

  private async getMissingUsers(
    instanceId: string,
  ): Promise<Array<{ id: string; platformUserId: string }>> {
    try {
      const instance = await this.prisma.standupInstance.findFirst({
        where: { id: instanceId },
        select: {
          configSnapshot: true,
          teamId: true,
        },
      });

      if (!instance) {
        return [];
      }

      const configSnapshot = instance.configSnapshot as {
        participatingMembers: Array<{ id: string; platformUserId: string }>;
      };

      // Get users who have already responded
      const respondedMembers = await this.prisma.answer.findMany({
        where: { standupInstanceId: instanceId },
        select: { teamMemberId: true },
        distinct: ['teamMemberId'],
      });

      const respondedMemberIds = new Set(respondedMembers.map((m) => m.teamMemberId));

      // Filter out users who have already responded
      const missingUsers = configSnapshot.participatingMembers.filter(
        (member) => !respondedMemberIds.has(member.id),
      );

      return missingUsers;
    } catch (error) {
      this.logger.error('Error getting missing users', {
        instanceId,
        error: this.getErrorMessage(error),
      });
      return [];
    }
  }
}
