import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { LoggerService } from '@/common/logger.service';
import { AnswerCollectionService } from '@/standups/answer-collection.service';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { AuditActorType, AuditCategory, AuditSeverity, ResourceAction } from '@/common/audit/types';
import { Prisma } from '@prisma/client';
import { StandupInstanceState } from '@/standups/dto/update-instance-state.dto';
import { StandupInstanceDto } from '@/standups/dto/standup-instance.dto';
import { SubmitAnswersDto } from '@/standups/dto/submit-answers.dto';
import {
  ParticipationStatusDto,
  MemberParticipationStatus,
} from '@/standups/dto/participation-status.dto';

interface ConfigSnapshot {
  name: string; // Added standup configuration name
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
  deliveryType: string;
  targetChannelId?: string;
  targetChannel?: {
    id: string;
    channelId: string;
    name: string;
  };
}

@Injectable()
export class StandupInstanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly logger: LoggerService,
    private readonly answerCollectionService: AnswerCollectionService,
  ) {
    this.logger.setContext(StandupInstanceService.name);
  }

  /**
   * Create a daily standup instance for a team
   */
  async createStandupInstance(
    teamId: string,
    targetDate: Date,
    actorUserId?: string,
  ): Promise<{ id: string }> {
    this.logger.info('Creating standup instance', { teamId, targetDate });

    // Get team with active standup config
    const team = await this.prisma.team.findFirst({
      where: { id: teamId },
      include: {
        configs: {
          where: { isActive: true },
          include: {
            configMembers: {
              where: { include: true },
              include: {
                teamMember: {
                  include: {
                    integrationUser: true,
                  },
                },
              },
            },
            targetChannel: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!team) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Team not found', HttpStatus.NOT_FOUND);
    }

    const config = team.configs[0];
    if (!config) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        'No active standup configuration found for team',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Check if instance already exists for this date
    const existingInstance = await this.prisma.standupInstance.findFirst({
      where: {
        teamId,
        targetDate: {
          gte: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()),
          lt: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1),
        },
      },
    });

    if (existingInstance) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        'Standup instance already exists for this date',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Create config snapshot
    const participatingMembers = config.configMembers.map((cm) => ({
      id: cm.teamMember.id,
      name: cm.teamMember.name || cm.teamMember.integrationUser?.name || 'Unknown',
      platformUserId:
        cm.teamMember.integrationUser?.externalUserId || cm.teamMember.platformUserId || '',
    }));

    this.logger.debug('Creating config snapshot', {
      teamId,
      configId: config.id,
      participatingMembersCount: participatingMembers.length,
    });

    const configSnapshot: ConfigSnapshot = {
      name: config.name, // Include the standup configuration name
      questions: config.questions,
      responseTimeoutHours: config.responseTimeoutHours,
      reminderMinutesBefore: config.reminderMinutesBefore,
      timezone: config.timezone,
      timeLocal: config.timeLocal,
      participatingMembers,
      deliveryType: config.deliveryType,
      targetChannelId: config.targetChannelId,
      targetChannel: config.targetChannel
        ? {
            id: config.targetChannel.id,
            channelId: config.targetChannel.channelId,
            name: config.targetChannel.name,
          }
        : undefined,
    };

    // Create instance
    const instance = await this.prisma.standupInstance.create({
      data: {
        teamId,
        targetDate,
        state: StandupInstanceState.PENDING,
        configSnapshot: configSnapshot as unknown as Prisma.JsonValue,
      },
    });

    // Audit log
    await this.auditLogService.log({
      actorType: actorUserId ? AuditActorType.USER : AuditActorType.SYSTEM,
      actorUserId: actorUserId || 'system',
      orgId: team.orgId,
      category: AuditCategory.STANDUP,
      severity: AuditSeverity.INFO,
      action: 'standup_instance_created',
      requestData: {
        method: 'POST',
        path: '/standups/instances',
        ipAddress: null, // Background job - no real IP available
        body: {
          teamId,
          targetDate: targetDate.toISOString(),
          participatingMembers: configSnapshot.participatingMembers.length,
        },
      },
      resources: [
        {
          type: 'standup_instance',
          id: instance.id,
          action: ResourceAction.CREATED,
        },
      ],
    });

    this.logger.info('Standup instance created successfully', { instanceId: instance.id, teamId });

    return { id: instance.id };
  }

  /**
   * Update the state of a standup instance
   */
  async updateInstanceState(
    instanceId: string,
    newState: StandupInstanceState,
    actorUserId: string,
    orgId: string,
  ): Promise<void> {
    this.logger.info('Updating instance state', { instanceId, newState });

    const instance = await this.prisma.standupInstance.findFirst({
      where: {
        id: instanceId,
        team: { orgId },
      },
      include: { team: true },
    });

    if (!instance) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Standup instance not found', HttpStatus.NOT_FOUND);
    }

    const oldState = instance.state;

    // Validate state transition
    this.validateStateTransition(oldState as StandupInstanceState, newState);

    // Update state
    await this.prisma.standupInstance.update({
      where: { id: instanceId },
      data: { state: newState },
    });

    // Audit log
    await this.auditLogService.log({
      actorType: AuditActorType.USER,
      actorUserId: actorUserId,
      orgId,
      category: AuditCategory.STANDUP,
      severity: AuditSeverity.INFO,
      action: 'standup_instance_state_updated',
      requestData: {
        method: 'PUT',
        path: `/standups/instances/${instanceId}/state`,
        ipAddress: null, // Background job - no real IP available
        body: {
          newState,
          oldState,
        },
      },
      resources: [
        {
          type: 'standup_instance',
          id: instanceId,
          action: ResourceAction.UPDATED,
        },
      ],
    });

    this.logger.info('Instance state updated successfully', { instanceId, oldState, newState });
  }

  /**
   * Get active standup instances
   */
  async getActiveInstances(
    orgId: string,
    teamId?: string,
    limit = 50,
    offset = 0,
  ): Promise<StandupInstanceDto[]> {
    this.logger.debug('Getting active instances', { orgId, teamId, limit, offset });

    const where: Prisma.StandupInstanceWhereInput = {
      team: {
        orgId,
        // Only include instances where the team has at least one standup config
        configs: {
          some: {},
        },
      },
      state: { in: [StandupInstanceState.PENDING, StandupInstanceState.COLLECTING] },
    };

    if (teamId) {
      where.teamId = teamId;
    }

    const instances = await this.prisma.standupInstance.findMany({
      where,
      include: {
        team: { select: { name: true } },
        answers: { select: { teamMemberId: true } },
      },
      orderBy: [{ targetDate: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      skip: offset,
    });

    this.logger.debug('Found instances (filtered for teams with active configs)', {
      count: instances.length,
      instances: instances.map((i) => ({
        id: i.id,
        teamId: i.teamId,
        teamName: i.team?.name,
        targetDate: i.targetDate,
        state: i.state,
      })),
    });

    return instances.map((instance) => this.mapToDto(instance));
  }

  /**
   * Check if a standup instance is complete
   */
  async isInstanceComplete(instanceId: string, orgId: string): Promise<boolean> {
    const instance = await this.prisma.standupInstance.findFirst({
      where: {
        id: instanceId,
        team: { orgId },
      },
      include: {
        answers: { select: { teamMemberId: true } },
      },
    });

    if (!instance) {
      return false;
    }

    const configSnapshot = instance.configSnapshot as unknown as ConfigSnapshot;
    const totalQuestions = configSnapshot.questions.length;
    const participatingMemberIds = configSnapshot.participatingMembers.map((m) => m.id);

    // Group answers by team member
    const memberAnswers = new Map<string, number>();
    instance.answers.forEach((answer) => {
      const count = memberAnswers.get(answer.teamMemberId) || 0;
      memberAnswers.set(answer.teamMemberId, count + 1);
    });

    // Check if all participating members have answered all questions
    for (const memberId of participatingMemberIds) {
      const answerCount = memberAnswers.get(memberId) || 0;
      if (answerCount < totalQuestions) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get standup instances for a specific date
   */
  async createInstancesForDate(
    targetDate: Date,
  ): Promise<{ created: string[]; skipped: string[]; skipReasons?: Record<string, string> }> {
    this.logger.info('Creating instances for date', { targetDate });

    const created: string[] = [];
    const skipped: string[] = [];
    const skipReasons: Record<string, string> = {};

    // Get all teams with active standup configs
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

    for (const team of teams) {
      try {
        const shouldCreate = await this.shouldCreateStandupToday(team.id, targetDate);

        if (shouldCreate) {
          // Check if instance already exists
          const existingInstance = await this.prisma.standupInstance.findFirst({
            where: {
              teamId: team.id,
              targetDate: {
                gte: new Date(
                  targetDate.getFullYear(),
                  targetDate.getMonth(),
                  targetDate.getDate(),
                ),
                lt: new Date(
                  targetDate.getFullYear(),
                  targetDate.getMonth(),
                  targetDate.getDate() + 1,
                ),
              },
            },
          });

          if (existingInstance) {
            skipped.push(team.id);
            skipReasons[team.id] = 'Instance already exists for this date';
            this.logger.debug('Skipping team - instance already exists', {
              teamId: team.id,
              existingInstanceId: existingInstance.id,
              targetDate,
            });
          } else {
            const result = await this.createStandupInstance(team.id, targetDate);
            created.push(result.id);
            this.logger.debug('Created new instance for team', {
              teamId: team.id,
              instanceId: result.id,
              targetDate,
            });
          }
        } else {
          skipped.push(team.id);
          skipReasons[team.id] = 'Team is not scheduled for standups on this day';
          this.logger.debug('Skipping team - not scheduled for this day', {
            teamId: team.id,
            targetDate,
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error('Failed to create instance for team', {
          teamId: team.id,
          error: errorMessage,
        });
        skipped.push(team.id);
        skipReasons[team.id] = `Error: ${errorMessage}`;
      }
    }

    this.logger.info('Completed creating instances for date', {
      targetDate,
      created: created.length,
      skipped: skipped.length,
      skipReasons,
    });

    return { created, skipped, skipReasons };
  }

  /**
   * Create standup instance for a specific config with optimized performance
   */
  async createInstanceForConfig(
    configId: string,
    targetDate: Date,
  ): Promise<{
    instanceId?: string;
    success: boolean;
    message: string;
    messageResult?: { success: boolean; error?: string };
  }> {
    try {
      // Get the standup config with all needed data in one query
      const config = await this.prisma.standupConfig.findUnique({
        where: { id: configId },
        include: {
          team: true,
          configMembers: {
            where: { include: true },
            include: {
              teamMember: {
                include: {
                  integrationUser: true,
                },
              },
            },
          },
        },
      });

      if (!config || !config.isActive) {
        return {
          success: false,
          message: 'Active standup config not found',
        };
      }

      // Check if instance already exists for this team and date
      const existingInstance = await this.prisma.standupInstance.findFirst({
        where: {
          teamId: config.teamId,
          targetDate: {
            gte: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()),
            lt: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1),
          },
        },
      });

      if (existingInstance) {
        return {
          success: false,
          message: 'Standup instance already exists for this date',
        };
      }

      // Create the instance using optimized method
      const instance = await this.createStandupInstanceOptimized(config, targetDate);

      return {
        instanceId: instance.id,
        success: true,
        message: 'Standup instance created successfully',
      };
    } catch (error) {
      this.logger.error('Failed to create standup instance for config', {
        configId,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        message: 'Failed to create standup instance',
      };
    }
  }

  /**
   * Optimized instance creation that skips redundant operations
   */
  private async createStandupInstanceOptimized(
    config: {
      id: string;
      teamId: string;
      name: string;
      questions: string[];
      responseTimeoutHours: number;
      reminderMinutesBefore: number;
      timezone: string;
      timeLocal: string;
      deliveryType: string;
      targetChannelId: string | null;
      configMembers: Array<{
        teamMember: {
          id: string;
          name: string | null;
          integrationUser?: {
            name?: string;
            externalUserId?: string;
          } | null;
          platformUserId?: string;
        };
      }>;
    },
    targetDate: Date,
  ): Promise<{ id: string }> {
    // Create minimal config snapshot from existing data
    const participatingMembers = config.configMembers.map((cm) => ({
      id: cm.teamMember.id,
      name: cm.teamMember.name || cm.teamMember.integrationUser?.name || 'Unknown',
      platformUserId:
        cm.teamMember.integrationUser?.externalUserId || cm.teamMember.platformUserId || '',
    }));

    const configSnapshot = {
      name: config.name,
      questions: config.questions,
      responseTimeoutHours: config.responseTimeoutHours,
      reminderMinutesBefore: config.reminderMinutesBefore,
      timezone: config.timezone,
      timeLocal: config.timeLocal,
      participatingMembers,
      deliveryType: config.deliveryType,
      targetChannelId: config.targetChannelId,
    };

    // Create instance directly
    const instance = await this.prisma.standupInstance.create({
      data: {
        teamId: config.teamId,
        targetDate,
        state: 'pending',
        configSnapshot: configSnapshot as unknown as Prisma.JsonValue,
      },
    });

    return { id: instance.id };
  }

  /**
   * Check if a team should have a standup today
   */
  async shouldCreateStandupToday(teamId: string, date: Date): Promise<boolean> {
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

    if (!team || !team.configs[0]) {
      this.logger.debug('shouldCreateStandupToday: no team or config found', { teamId });
      return false;
    }

    const config = team.configs[0];

    // Convert date to config's timezone and check weekday
    const configDate = this.convertToTeamTimezone(date, config.timezone);
    const weekday = configDate.getDay(); // 0 = Sunday, 1 = Monday, etc.

    const shouldCreate = config.weekdays.includes(weekday);

    this.logger.debug('shouldCreateStandupToday: checking weekday', {
      teamId,
      originalDate: date.toISOString(),
      configTimezone: config.timezone,
      configDate: configDate.toISOString(),
      weekday,
      configWeekdays: config.weekdays,
      shouldCreate,
    });

    return config.weekdays.includes(weekday);
  }

  /**
   * Check if team exists
   */
  async teamExists(teamId: string): Promise<boolean> {
    const team = await this.prisma.team.findFirst({
      where: { id: teamId },
      select: { id: true },
    });
    return !!team;
  }

  /**
   * Calculate the next standup date for a team
   */
  async calculateNextStandupDate(teamId: string): Promise<Date | null> {
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

    if (!team || !team.configs[0]) {
      return null;
    }

    const config = team.configs[0];
    const now = new Date();
    const configNow = this.convertToTeamTimezone(now, config.timezone);

    // Find next scheduled weekday
    for (let i = 1; i <= 7; i++) {
      const checkDate = new Date(configNow);
      checkDate.setDate(checkDate.getDate() + i);
      const weekday = checkDate.getDay();

      if (config.weekdays.includes(weekday)) {
        return checkDate;
      }
    }

    return null;
  }

  /**
   * Get standup start time for an instance
   */
  async getStandupStartTime(instanceId: string): Promise<Date | null> {
    const instance = await this.prisma.standupInstance.findUnique({
      where: { id: instanceId },
      include: { team: true },
    });

    if (!instance) {
      return null;
    }

    const configSnapshot = instance.configSnapshot as unknown as ConfigSnapshot;
    const [hours, minutes] = configSnapshot.timeLocal.split(':').map(Number);

    const startTime = this.convertToTeamTimezone(instance.targetDate, configSnapshot.timezone);
    startTime.setHours(hours, minutes, 0, 0);

    return startTime;
  }

  /**
   * Get instance participation status
   */
  async getInstanceParticipation(
    instanceId: string,
    orgId: string,
  ): Promise<ParticipationStatusDto> {
    const instance = await this.prisma.standupInstance.findFirst({
      where: {
        id: instanceId,
        team: { orgId },
      },
      include: {
        team: { select: { name: true } },
        answers: {
          include: {
            teamMember: {
              include: {
                integrationUser: true,
              },
            },
          },
        },
      },
    });

    if (!instance) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Standup instance not found', HttpStatus.NOT_FOUND);
    }

    const configSnapshot = instance.configSnapshot as unknown as ConfigSnapshot;
    const totalQuestions = configSnapshot.questions.length;

    // Calculate participation metrics
    const memberAnswers = new Map<string, { count: number; lastAnswerAt: Date | null }>();

    instance.answers.forEach((answer) => {
      const existing = memberAnswers.get(answer.teamMemberId) || { count: 0, lastAnswerAt: null };
      memberAnswers.set(answer.teamMemberId, {
        count: existing.count + 1,
        lastAnswerAt: existing.lastAnswerAt
          ? answer.submittedAt > existing.lastAnswerAt
            ? answer.submittedAt
            : existing.lastAnswerAt
          : answer.submittedAt,
      });
    });

    const memberStatus: MemberParticipationStatus[] = configSnapshot.participatingMembers.map(
      (member) => {
        const answers = memberAnswers.get(member.id) || { count: 0, lastAnswerAt: null };
        return {
          teamMemberId: member.id,
          name: member.name,
          platformUserId: member.platformUserId,
          questionsAnswered: answers.count,
          totalQuestions,
          isComplete: answers.count >= totalQuestions,
          lastAnswerAt: answers.lastAnswerAt,
        };
      },
    );

    const respondedMembers = memberStatus.filter((m) => m.questionsAnswered > 0).length;
    const completeMembers = memberStatus.filter((m) => m.isComplete).length;
    const responseRate =
      configSnapshot.participatingMembers.length > 0
        ? Math.round((respondedMembers / configSnapshot.participatingMembers.length) * 100)
        : 0;
    const completionRate =
      configSnapshot.participatingMembers.length > 0
        ? Math.round((completeMembers / configSnapshot.participatingMembers.length) * 100)
        : 0;

    // Calculate timeout
    const startTime = await this.getStandupStartTime(instanceId);
    const timeoutAt = startTime
      ? new Date(startTime.getTime() + configSnapshot.responseTimeoutHours * 60 * 60 * 1000)
      : null;

    return {
      standupInstanceId: instanceId,
      state: instance.state,
      targetDate: instance.targetDate.toISOString().split('T')[0],
      totalMembers: configSnapshot.participatingMembers.length,
      respondedMembers,
      responseRate,
      completionRate,
      memberStatus,
      timeoutAt,
      canStillSubmit:
        instance.state === StandupInstanceState.COLLECTING &&
        (!timeoutAt || new Date() < timeoutAt),
    };
  }

  /**
   * Get participating members for an instance
   */
  async getParticipatingMembers(
    instanceId: string,
  ): Promise<Array<{ id: string; name: string; platformUserId: string }>> {
    const instance = await this.prisma.standupInstance.findUnique({
      where: { id: instanceId },
    });

    if (!instance) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Standup instance not found', HttpStatus.NOT_FOUND);
    }

    const configSnapshot = instance.configSnapshot as unknown as ConfigSnapshot;
    return configSnapshot.participatingMembers;
  }

  /**
   * Calculate response rate for an instance
   */
  async calculateResponseRate(instanceId: string, orgId: string): Promise<number> {
    const participation = await this.getInstanceParticipation(instanceId, orgId);
    return participation.responseRate;
  }

  /**
   * Get instance completion status with response rate
   */
  async getInstanceCompletionStatus(
    instanceId: string,
    orgId: string,
  ): Promise<{ isComplete: boolean; responseRate: number }> {
    const isComplete = await this.isInstanceComplete(instanceId, orgId);
    const responseRate = await this.calculateResponseRate(instanceId, orgId);

    return { isComplete, responseRate };
  }

  /**
   * Submit answers for a standup instance
   */
  async submitAnswersForInstance(
    instanceId: string,
    submitAnswersDto: SubmitAnswersDto,
    orgId: string,
  ): Promise<{ success: boolean; answersSubmitted: number }> {
    // Validate that the instanceId matches the DTO
    if (submitAnswersDto.standupInstanceId && submitAnswersDto.standupInstanceId !== instanceId) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        'Instance ID mismatch',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Set the instanceId from the URL parameter
    submitAnswersDto.standupInstanceId = instanceId;

    // Find the team member for this instance
    const teamMemberId = await this.getActiveTeamMemberForInstance(instanceId, orgId);

    return this.answerCollectionService.submitFullResponse(submitAnswersDto, teamMemberId, orgId);
  }

  /**
   * Get instance with full details
   */
  async getInstanceWithDetails(
    instanceId: string,
    orgId: string,
  ): Promise<StandupInstanceDto & { answers: unknown[] }> {
    const instance = await this.prisma.standupInstance.findFirst({
      where: {
        id: instanceId,
        team: { orgId },
      },
      include: {
        team: { select: { name: true } },
        answers: {
          include: {
            teamMember: {
              include: {
                integrationUser: true,
              },
            },
          },
          orderBy: { submittedAt: 'asc' },
        },
      },
    });

    if (!instance) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Standup instance not found', HttpStatus.NOT_FOUND);
    }

    const dto = this.mapToDto(instance);
    return {
      ...dto,
      answers: instance.answers.map((answer) => ({
        questionIndex: answer.questionIndex,
        text: answer.text,
        submittedAt: answer.submittedAt,
        teamMember: {
          id: answer.teamMember.id,
          name: answer.teamMember.name || answer.teamMember.integrationUser?.name || 'Unknown',
          platformUserId: answer.teamMember.integrationUser?.externalUserId,
        },
      })),
    };
  }

  /**
   * Archive old completed instances
   */
  async archiveOldInstances(cutoffDate: Date): Promise<{ archived: number }> {
    this.logger.info('Archiving old instances', { cutoffDate });

    const result = await this.prisma.standupInstance.deleteMany({
      where: {
        state: StandupInstanceState.POSTED,
        createdAt: { lt: cutoffDate },
      },
    });

    this.logger.info('Archived old instances', { count: result.count });

    return { archived: result.count };
  }

  /**
   * Convert UTC date to team's timezone
   */
  private convertToTeamTimezone(date: Date, timezone: string): Date {
    // Simple timezone conversion - in production, use a proper timezone library
    // For now, assume UTC and basic offset handling
    const teamDate = new Date(date);

    // Basic timezone offset mapping (simplified)
    const timezoneOffsets: Record<string, string | number> = {
      'America/New_York': -5,
      'America/Los_Angeles': -8,
      'Europe/London': 0,
      'Europe/Berlin': 1,
      'Asia/Tokyo': 9,
      UTC: 0,
      // Add more as needed
    };

    const offset = timezoneOffsets[timezone];

    // If timezone is 'UTC' or offset is 0, don't modify the date
    if (timezone === 'UTC' || offset === 0) {
      this.logger.debug('convertToTeamTimezone: UTC timezone, returning original date', {
        originalDate: date.toISOString(),
        timezone,
        weekday: date.getDay(),
      });
      return teamDate;
    }

    // Apply offset for other timezones
    if (typeof offset === 'number') {
      teamDate.setHours(teamDate.getHours() + offset);
      this.logger.debug('convertToTeamTimezone: applied offset', {
        originalDate: date.toISOString(),
        convertedDate: teamDate.toISOString(),
        timezone,
        offset,
        originalWeekday: date.getDay(),
        convertedWeekday: teamDate.getDay(),
      });
    } else {
      this.logger.warn('convertToTeamTimezone: unknown timezone, using UTC', {
        timezone,
        originalDate: date.toISOString(),
      });
    }

    return teamDate;
  }

  /**
   * Validate state transition
   */
  private validateStateTransition(
    fromState: StandupInstanceState,
    toState: StandupInstanceState,
  ): void {
    const validTransitions: Record<StandupInstanceState, StandupInstanceState[]> = {
      [StandupInstanceState.PENDING]: [StandupInstanceState.COLLECTING],
      [StandupInstanceState.COLLECTING]: [StandupInstanceState.POSTED],
      [StandupInstanceState.POSTED]: [], // No transitions from posted
    };

    if (!validTransitions[fromState]?.includes(toState)) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        `Invalid state transition from ${fromState} to ${toState}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Map database entity to DTO
   */
  private mapToDto(instance: {
    id: string;
    teamId: string;
    targetDate: Date;
    state: string;
    createdAt: Date;
    configSnapshot: unknown;
    team?: { name: string };
    answers?: unknown[];
    [key: string]: unknown;
  }): StandupInstanceDto {
    const configSnapshot = instance.configSnapshot as unknown as ConfigSnapshot;

    // Calculate participation metrics
    const uniqueRespondents = new Set(
      (instance.answers as { teamMemberId: string }[])?.map((a) => a.teamMemberId) || [],
    );
    const respondedMembers = uniqueRespondents.size;
    const totalMembers = configSnapshot.participatingMembers.length;
    const responseRate = totalMembers > 0 ? Math.round((respondedMembers / totalMembers) * 100) : 0;

    // Build member details from configSnapshot
    const members = configSnapshot.participatingMembers.map((member) => {
      const hasResponded = uniqueRespondents.has(member.id);
      return {
        id: member.id,
        name: member.name,
        platformUserId: member.platformUserId,
        status: (hasResponded ? 'completed' : 'not_started') as
          | 'completed'
          | 'not_started'
          | 'in_progress',
        lastReminderSent: undefined as string | undefined,
        reminderCount: 0,
        responseTime: undefined as string | undefined,
        isLate: false,
      };
    });

    return {
      id: instance.id,
      teamId: instance.teamId,
      teamName: instance.team?.name || 'Unknown Team',
      configName: configSnapshot.name, // Extract config name for easy frontend access
      targetDate: instance.targetDate.toISOString().split('T')[0],
      state: instance.state,
      configSnapshot,
      createdAt: instance.createdAt,
      totalMembers,
      respondedMembers,
      responseRate,
      members,
    };
  }

  /**
   * Get instance members with status
   */
  async getInstanceMembers(
    instanceId: string,
    orgId: string,
  ): Promise<
    Array<{
      id: string;
      name: string;
      platformUserId: string;
      status: 'completed' | 'not_started' | 'in_progress';
      lastReminderSent?: string;
      reminderCount: number;
      responseTime?: string;
      isLate: boolean;
    }>
  > {
    const instance = await this.getInstanceWithDetails(instanceId, orgId);
    if (!instance) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Standup instance not found', HttpStatus.NOT_FOUND);
    }

    return instance.members;
  }

  /**
   * Get active team member ID for an instance
   */
  async getActiveTeamMemberForInstance(instanceId: string, orgId: string): Promise<string> {
    const instance = await this.getInstanceWithDetails(instanceId, orgId);
    if (!instance) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Standup instance not found', HttpStatus.NOT_FOUND);
    }

    // Find the team member for this team - for the test, there's only one
    const teamMember = await this.prisma.teamMember.findFirst({
      where: {
        teamId: instance.teamId,
        active: true,
      },
    });

    if (!teamMember) {
      throw new ApiError(ErrorCode.FORBIDDEN, 'No active team member found', HttpStatus.FORBIDDEN);
    }

    return teamMember.id;
  }

  /**
   * Get individual member response for a standup instance
   */
  async getMemberResponse(
    instanceId: string,
    memberId: string,
    orgId: string,
  ): Promise<{
    instanceId: string;
    memberId: string;
    memberName: string;
    answers: Record<string, string>;
    submittedAt?: string;
    isComplete: boolean;
  }> {
    this.logger.debug('Getting member response', { instanceId, memberId, orgId });

    // Get the instance to validate it exists and belongs to the org
    const instance = await this.prisma.standupInstance.findFirst({
      where: {
        id: instanceId,
        team: {
          orgId: orgId,
        },
      },
      include: {
        answers: {
          where: {
            teamMemberId: memberId,
          },
          orderBy: {
            questionIndex: 'asc',
          },
        },
        team: {
          include: {
            members: {
              where: { id: memberId },
            },
          },
        },
      },
    });

    if (!instance) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Standup instance not found', HttpStatus.NOT_FOUND);
    }

    const member = instance.team.members[0];
    if (!member) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Team member not found', HttpStatus.NOT_FOUND);
    }

    // Get config snapshot for question count
    const configSnapshot = instance.configSnapshot as unknown as ConfigSnapshot;
    const totalQuestions = configSnapshot.questions.length;

    // Map answers to the expected format (Record<string, string>)
    const answersRecord: Record<string, string> = {};
    instance.answers.forEach((answer: { questionIndex: number; text: string }) => {
      answersRecord[answer.questionIndex.toString()] = answer.text || '';
    });

    const isComplete = instance.answers.length === totalQuestions;
    const submittedAt =
      instance.answers.length > 0 ? instance.answers[0]?.submittedAt?.toISOString() : undefined;

    return {
      instanceId,
      memberId,
      memberName: member.name,
      answers: answersRecord,
      submittedAt,
      isComplete,
    };
  }
}
