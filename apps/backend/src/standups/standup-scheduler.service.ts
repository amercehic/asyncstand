import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';
import { StandupInstanceService } from '@/standups/standup-instance.service';
import { StandupJobService } from '@/standups/jobs/standup-job.service';
import { StandupInstanceState } from '@/standups/dto/update-instance-state.dto';

interface ConfigSnapshot {
  questions: string[];
  responseTimeoutHours: number;
  reminderMinutesBefore: number;
  participatingMembers: Array<{
    id: string;
    name: string;
    platformUserId: string;
  }>;
  timezone: string;
  timeLocal: string;
}

interface SchedulingResult {
  date: string;
  processed: number;
  created: number;
  skipped: number;
  errors: string[];
}

interface TeamScheduleResult {
  teamId: string;
  teamName: string;
  instanceId?: string;
  skipped: boolean;
  error?: string;
}

@Injectable()
export class StandupSchedulerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly standupInstanceService: StandupInstanceService,
    private readonly standupJobService: StandupJobService,
  ) {
    this.logger.setContext(StandupSchedulerService.name);
  }

  /**
   * Main job to create standup instances for today
   * Should be called daily at midnight UTC
   */
  async scheduleDailyStandups(targetDate?: Date): Promise<SchedulingResult> {
    const date = targetDate || new Date();
    this.logger.info('Starting daily standup scheduling', { date });

    const result: SchedulingResult = {
      date: date.toISOString().split('T')[0],
      processed: 0,
      created: 0,
      skipped: 0,
      errors: [],
    };

    try {
      // Get all teams with active standup configurations
      const teams = await this.prisma.team.findMany({
        where: {
          configs: {
            some: { isActive: true },
          },
        },
        include: {
          configs: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      this.logger.info(`Found ${teams.length} teams with active standup configs`);

      // Process each team
      for (const team of teams) {
        result.processed++;

        try {
          const teamResult = await this.processTeamSchedule(team.id, date);

          if (teamResult.skipped) {
            result.skipped++;
            this.logger.debug('Skipped team', { teamId: team.id, reason: teamResult.error });
          } else if (teamResult.instanceId) {
            result.created++;
            this.logger.info('Created standup instance', {
              teamId: team.id,
              instanceId: teamResult.instanceId,
            });

            // Queue collection jobs for this instance
            await this.queueCollectionJobs(teamResult.instanceId);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Team ${team.id}: ${errorMessage}`);
          this.logger.error('Failed to process team schedule', {
            teamId: team.id,
            error: errorMessage,
          });
        }
      }

      this.logger.info('Daily standup scheduling completed', {
        date: result.date,
        processed: result.processed,
        created: result.created,
        skipped: result.skipped,
        errorsCount: result.errors.length,
      });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Scheduling failed: ${errorMessage}`);
      this.logger.error('Daily standup scheduling failed', { error: errorMessage });
      return result;
    }
  }

  /**
   * Process scheduling for an individual team
   */
  async processTeamSchedule(teamId: string, date: Date): Promise<TeamScheduleResult> {
    this.logger.debug('Processing team schedule', { teamId, date });

    const team = await this.prisma.team.findFirst({
      where: { id: teamId },
      include: {
        configs: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!team) {
      return {
        teamId,
        teamName: 'Unknown',
        skipped: true,
        error: 'Team not found',
      };
    }

    const config = team.configs[0];
    if (!config) {
      return {
        teamId,
        teamName: team.name,
        skipped: true,
        error: 'No active standup configuration',
      };
    }

    // Check if standup should be created today
    const shouldCreate = this.isScheduledDay(config.weekdays, date, team.timezone);
    if (!shouldCreate) {
      return {
        teamId,
        teamName: team.name,
        skipped: true,
        error: 'Not a scheduled day',
      };
    }

    // Check if instance already exists
    const existingInstance = await this.prisma.standupInstance.findFirst({
      where: {
        teamId,
        targetDate: {
          gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
          lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
        },
      },
    });

    if (existingInstance) {
      return {
        teamId,
        teamName: team.name,
        instanceId: existingInstance.id,
        skipped: true,
        error: 'Instance already exists',
      };
    }

    // Create the standup instance
    const result = await this.standupInstanceService.createStandupInstance(teamId, date);

    return {
      teamId,
      teamName: team.name,
      instanceId: result.id,
      skipped: false,
    };
  }

  /**
   * Queue collection start and timeout jobs for an instance
   */
  async queueCollectionJobs(instanceId: string): Promise<void> {
    this.logger.info('Queueing collection jobs', { instanceId });

    try {
      const instance = await this.prisma.standupInstance.findUnique({
        where: { id: instanceId },
        include: { team: true },
      });

      if (!instance) {
        this.logger.error('Instance not found for job queueing', { instanceId });
        return;
      }

      const configSnapshot = instance.configSnapshot as unknown as ConfigSnapshot;

      // Calculate start time
      const startTime = this.calculateCollectionStartTime(
        instance.targetDate,
        configSnapshot,
        instance.team.timezone,
      );

      // Calculate timeout time
      const timeoutTime = new Date(
        startTime.getTime() + configSnapshot.responseTimeoutHours * 60 * 60 * 1000,
      );

      // Queue the collection start job
      await this.standupJobService.scheduleCollectionStart(instanceId, instance.teamId, startTime);

      // Queue the collection timeout job
      await this.standupJobService.scheduleCollectionTimeout(
        instanceId,
        timeoutTime,
        configSnapshot.responseTimeoutHours * 60,
      );

      this.logger.info('Collection jobs queued successfully', {
        instanceId,
        startTime: startTime.toISOString(),
        timeoutTime: timeoutTime.toISOString(),
      });
    } catch (error) {
      this.logger.error('Failed to queue collection jobs', {
        instanceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Start collection for a standup instance
   * This would typically be called by a background job processor
   */
  async startCollection(instanceId: string): Promise<void> {
    this.logger.info('Starting collection for instance', { instanceId });

    try {
      const instance = await this.prisma.standupInstance.findUnique({
        where: { id: instanceId },
        include: { team: true },
      });

      if (!instance) {
        this.logger.error('Instance not found for collection start', { instanceId });
        return;
      }

      if (instance.state !== StandupInstanceState.PENDING) {
        this.logger.warn('Instance not in pending state', {
          instanceId,
          currentState: instance.state,
        });
        return;
      }

      // Update state to collecting
      await this.prisma.standupInstance.update({
        where: { id: instanceId },
        data: { state: StandupInstanceState.COLLECTING },
      });

      this.logger.info('Collection started successfully', { instanceId });

      // Here you would trigger notifications to team members
      // For example, send Slack messages, emails, etc.
    } catch (error) {
      this.logger.error('Failed to start collection', {
        instanceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle collection timeout for a standup instance
   * This would typically be called by a background job processor
   */
  async handleCollectionTimeout(instanceId: string): Promise<void> {
    this.logger.info('Handling collection timeout', { instanceId });

    try {
      const instance = await this.prisma.standupInstance.findUnique({
        where: { id: instanceId },
        include: { team: true },
      });

      if (!instance) {
        this.logger.error('Instance not found for timeout handling', { instanceId });
        return;
      }

      if (instance.state !== StandupInstanceState.COLLECTING) {
        this.logger.warn('Instance not in collecting state', {
          instanceId,
          currentState: instance.state,
        });
        return;
      }

      // Update state to posted (ready for summary generation in Phase 6)
      await this.prisma.standupInstance.update({
        where: { id: instanceId },
        data: { state: StandupInstanceState.POSTED },
      });

      this.logger.info('Collection timeout handled successfully', { instanceId });

      // Here you would trigger summary generation and posting
      // This will be implemented in Phase 6
    } catch (error) {
      this.logger.error('Failed to handle collection timeout', {
        instanceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle missed standups - recover from failed scheduling
   */
  async handleMissedStandups(date: Date): Promise<{ recovered: number; failed: number }> {
    this.logger.info('Handling missed standups', { date });

    let recovered = 0;
    let failed = 0;

    try {
      // Find teams that should have had standups but don't have instances
      const teams = await this.prisma.team.findMany({
        where: {
          configs: {
            some: { isActive: true },
          },
        },
        include: {
          configs: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          instances: {
            where: {
              targetDate: {
                gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
                lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
              },
            },
          },
        },
      });

      for (const team of teams) {
        try {
          const config = team.configs[0];
          if (!config) continue;

          // Check if this team should have had a standup today
          const shouldHaveStandup = this.isScheduledDay(config.weekdays, date, team.timezone);
          const hasInstance = team.instances.length > 0;

          if (shouldHaveStandup && !hasInstance) {
            this.logger.info('Recovering missed standup', { teamId: team.id, date });

            await this.standupInstanceService.createStandupInstance(team.id, date);
            recovered++;
          }
        } catch (error) {
          this.logger.error('Failed to recover missed standup', {
            teamId: team.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          failed++;
        }
      }

      this.logger.info('Missed standups handling completed', { recovered, failed });
      return { recovered, failed };
    } catch (error) {
      this.logger.error('Failed to handle missed standups', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { recovered, failed };
    }
  }

  /**
   * Convert UTC date to team's timezone
   */
  private convertToTeamTimezone(date: Date, timezone: string): Date {
    // Simple timezone conversion - in production, use date-fns-tz or similar
    const teamDate = new Date(date);

    // Basic timezone offset mapping (simplified for this implementation)
    const timezoneOffsets: Record<string, number> = {
      'America/New_York': -5,
      'America/Chicago': -6,
      'America/Denver': -7,
      'America/Los_Angeles': -8,
      'Europe/London': 0,
      'Europe/Berlin': 1,
      'Europe/Moscow': 3,
      'Asia/Tokyo': 9,
      'Asia/Shanghai': 8,
      'Australia/Sydney': 11,
    };

    const offset = timezoneOffsets[timezone] || 0;
    teamDate.setHours(teamDate.getHours() + offset);

    return teamDate;
  }

  /**
   * Check if today is a scheduled standup day for the team
   */
  private isScheduledDay(weekdays: number[], date: Date, timezone: string): boolean {
    const teamDate = this.convertToTeamTimezone(date, timezone);
    const weekday = teamDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    return weekdays.includes(weekday);
  }

  /**
   * Calculate when collection should start for an instance
   */
  private calculateCollectionStartTime(
    targetDate: Date,
    configSnapshot: ConfigSnapshot,
    timezone: string,
  ): Date {
    const teamDate = this.convertToTeamTimezone(targetDate, timezone);
    const [hours, minutes] = configSnapshot.timeLocal.split(':').map(Number);

    const startTime = new Date(teamDate);
    startTime.setHours(hours, minutes, 0, 0);

    return startTime;
  }

  /**
   * Calculate the collection window (start time + timeout period)
   */
  async calculateCollectionWindow(
    instanceId: string,
  ): Promise<{ startTime: Date; endTime: Date } | null> {
    const instance = await this.prisma.standupInstance.findUnique({
      where: { id: instanceId },
      include: { team: true },
    });

    if (!instance) {
      return null;
    }

    const configSnapshot = instance.configSnapshot as unknown as ConfigSnapshot;
    const startTime = this.calculateCollectionStartTime(
      instance.targetDate,
      configSnapshot,
      instance.team.timezone,
    );
    const endTime = new Date(
      startTime.getTime() + configSnapshot.responseTimeoutHours * 60 * 60 * 1000,
    );

    return { startTime, endTime };
  }

  /**
   * Clean up old completed instances
   * This would typically be called by a scheduled cleanup job
   */
  async cleanupOldInstances(cutoffDays = 30): Promise<{ deleted: number }> {
    this.logger.info('Starting cleanup of old instances', { cutoffDays });

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - cutoffDays);

    try {
      const result = await this.standupInstanceService.archiveOldInstances(cutoffDate);

      this.logger.info('Old instances cleanup completed', {
        deleted: result.archived,
        cutoffDate: cutoffDate.toISOString(),
      });

      return { deleted: result.archived };
    } catch (error) {
      this.logger.error('Failed to cleanup old instances', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { deleted: 0 };
    }
  }

  /**
   * Get scheduling status for a specific date
   */
  async getSchedulingStatus(date: Date): Promise<{
    date: string;
    totalTeams: number;
    scheduledTeams: number;
    instancesCreated: number;
    instancesPending: number;
    instancesCollecting: number;
    instancesPosted: number;
  }> {
    const dateStr = date.toISOString().split('T')[0];

    // Get all teams with active configs
    const totalTeams = await this.prisma.team.count({
      where: {
        configs: {
          some: { isActive: true },
        },
      },
    });

    // Count teams that should have standups today
    const teams = await this.prisma.team.findMany({
      where: {
        configs: {
          some: { isActive: true },
        },
      },
      include: {
        configs: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    let scheduledTeams = 0;
    for (const team of teams) {
      const config = team.configs[0];
      if (config && this.isScheduledDay(config.weekdays, date, team.timezone)) {
        scheduledTeams++;
      }
    }

    // Get instance counts
    const instances = await this.prisma.standupInstance.findMany({
      where: {
        targetDate: {
          gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
          lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
        },
      },
      select: { state: true },
    });

    const instancesCreated = instances.length;
    const instancesPending = instances.filter(
      (i) => i.state === StandupInstanceState.PENDING,
    ).length;
    const instancesCollecting = instances.filter(
      (i) => i.state === StandupInstanceState.COLLECTING,
    ).length;
    const instancesPosted = instances.filter((i) => i.state === StandupInstanceState.POSTED).length;

    return {
      date: dateStr,
      totalTeams,
      scheduledTeams,
      instancesCreated,
      instancesPending,
      instancesCollecting,
      instancesPosted,
    };
  }
}
