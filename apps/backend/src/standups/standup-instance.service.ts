import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { LoggerService } from '@/common/logger.service';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { AuditActorType, AuditCategory, AuditSeverity, ResourceAction } from '@/common/audit/types';
import { Prisma } from '@prisma/client';
import { StandupInstanceState } from '@/standups/dto/update-instance-state.dto';
import { StandupInstanceDto } from '@/standups/dto/standup-instance.dto';
import {
  ParticipationStatusDto,
  MemberParticipationStatus,
} from '@/standups/dto/participation-status.dto';

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

@Injectable()
export class StandupInstanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly logger: LoggerService,
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
      return { id: existingInstance.id };
    }

    // Create config snapshot
    const configSnapshot: ConfigSnapshot = {
      questions: config.questions,
      responseTimeoutHours: config.responseTimeoutHours,
      reminderMinutesBefore: config.reminderMinutesBefore,
      timezone: team.timezone,
      timeLocal: config.timeLocal,
      participatingMembers: config.configMembers.map((cm) => ({
        id: cm.teamMember.id,
        name: cm.teamMember.name || cm.teamMember.integrationUser?.name || 'Unknown',
        platformUserId: cm.teamMember.integrationUser?.externalUserId || '',
      })),
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
        ipAddress: '127.0.0.1',
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
        ipAddress: '127.0.0.1',
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
    const where: Prisma.StandupInstanceWhereInput = {
      team: { orgId },
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

    return instances.map((instance) => this.mapToDto(instance));
  }

  /**
   * Check if a standup instance is complete
   */
  async isInstanceComplete(instanceId: string): Promise<boolean> {
    const instance = await this.prisma.standupInstance.findUnique({
      where: { id: instanceId },
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
  ): Promise<{ created: string[]; skipped: string[] }> {
    this.logger.info('Creating instances for date', { targetDate });

    const created: string[] = [];
    const skipped: string[] = [];

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
          const result = await this.createStandupInstance(team.id, targetDate);
          created.push(result.id);
        } else {
          skipped.push(team.id);
        }
      } catch (error) {
        this.logger.error('Failed to create instance for team', {
          teamId: team.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        skipped.push(team.id);
      }
    }

    this.logger.info('Completed creating instances for date', {
      targetDate,
      created: created.length,
      skipped: skipped.length,
    });

    return { created, skipped };
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
      return false;
    }

    const config = team.configs[0];

    // Convert date to team's timezone and check weekday
    const teamDate = this.convertToTeamTimezone(date, team.timezone);
    const weekday = teamDate.getDay(); // 0 = Sunday, 1 = Monday, etc.

    return config.weekdays.includes(weekday);
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
    const teamNow = this.convertToTeamTimezone(now, team.timezone);

    // Find next scheduled weekday
    for (let i = 1; i <= 7; i++) {
      const checkDate = new Date(teamNow);
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

    const startTime = this.convertToTeamTimezone(instance.targetDate, instance.team.timezone);
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
    const responseRate =
      configSnapshot.participatingMembers.length > 0
        ? Math.round((respondedMembers / configSnapshot.participatingMembers.length) * 100)
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
  async calculateResponseRate(instanceId: string): Promise<number> {
    const participation = await this.getInstanceParticipation(instanceId, ''); // orgId will be validated in getInstanceParticipation
    return participation.responseRate;
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
    const timezoneOffsets: Record<string, number> = {
      'America/New_York': -5,
      'America/Los_Angeles': -8,
      'Europe/London': 0,
      'Europe/Berlin': 1,
      'Asia/Tokyo': 9,
      // Add more as needed
    };

    const offset = timezoneOffsets[timezone] || 0;
    teamDate.setHours(teamDate.getHours() + offset);

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

    return {
      id: instance.id,
      teamId: instance.teamId,
      teamName: instance.team?.name || 'Unknown Team',
      targetDate: instance.targetDate.toISOString().split('T')[0],
      state: instance.state,
      configSnapshot,
      createdAt: instance.createdAt,
      totalMembers,
      respondedMembers,
      responseRate,
    };
  }
}
