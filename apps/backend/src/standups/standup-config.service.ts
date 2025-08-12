import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { LoggerService } from '@/common/logger.service';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { AuditActorType, AuditCategory, AuditSeverity } from '@/common/audit/types';
import { CreateStandupConfigDto } from '@/standups/dto/create-standup-config.dto';
import { UpdateStandupConfigDto } from '@/standups/dto/update-standup-config.dto';
import { UpdateMemberParticipationDto } from '@/standups/dto/update-member-participation.dto';
import { BulkUpdateParticipationDto } from '@/standups/dto/bulk-update-participation.dto';
import {
  StandupConfigResponse,
  MemberParticipationResponse,
  PreviewResponse,
  WEEKDAY_NAMES,
  QUESTION_TEMPLATES,
} from '@/standups/types/standup-config.types';
import { ValidationUtils } from '@/standups/utils/validation.utils';

@Injectable()
export class StandupConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(StandupConfigService.name);
  }

  async createStandupConfig(
    teamId: string,
    orgId: string,
    createdByUserId: string,
    data: CreateStandupConfigDto,
  ): Promise<{ id: string }> {
    this.logger.info('Creating standup configuration', { teamId, orgId, createdByUserId });

    // Validate team exists and belongs to organization
    const team = await this.prisma.team.findFirst({
      where: {
        id: teamId,
        orgId,
      },
      include: {
        members: {
          where: { active: true },
          include: {
            user: true,
            integrationUser: true,
          },
        },
        channel: true,
      },
    });

    if (!team) {
      throw new ApiError(
        ErrorCode.NOT_FOUND,
        'Team not found or does not belong to organization',
        HttpStatus.NOT_FOUND,
      );
    }

    if (!team.channel) {
      throw new ApiError(
        ErrorCode.CONFIGURATION_ERROR,
        'Team must have a Slack channel assigned before configuring standups',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Check if standup config with same purpose already exists (if purpose is provided)
    if (data.purpose) {
      const existingConfig = await this.prisma.standupConfig.findFirst({
        where: {
          teamId,
          purpose: data.purpose,
        },
      });

      if (existingConfig) {
        throw new ApiError(
          ErrorCode.STANDUP_CONFIG_ALREADY_EXISTS,
          `Standup configuration with purpose '${data.purpose}' already exists for this team`,
          HttpStatus.CONFLICT,
        );
      }
    }

    // Validate input data
    ValidationUtils.validateSchedule(data.weekdays, data.timeLocal, data.timezone);
    ValidationUtils.validateQuestions(data.questions);

    // Create standup config in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create the config
      const config = await tx.standupConfig.create({
        data: {
          teamId,
          purpose: data.purpose,
          questions: data.questions,
          weekdays: data.weekdays,
          timeLocal: data.timeLocal,
          timezone: data.timezone,
          reminderMinutesBefore: data.reminderMinutesBefore,
          responseTimeoutHours: data.responseTimeoutHours ?? 2,
          isActive: data.isActive ?? true,
          createdByUserId,
        },
      });

      // Add all active team members to standup participation (default: included)
      const memberParticipation = team.members.map((member) => ({
        standupConfigId: config.id,
        teamMemberId: member.id,
        include: true,
        role: null,
      }));

      if (memberParticipation.length > 0) {
        await tx.standupConfigMember.createMany({
          data: memberParticipation,
        });
      }

      return config;
    });

    // Audit log
    await this.auditLogService.log({
      action: 'standup_config.created',
      orgId,
      actorUserId: createdByUserId,
      actorType: AuditActorType.USER,
      category: AuditCategory.STANDUP_CONFIG,
      severity: AuditSeverity.INFO,
      requestData: {
        method: 'POST',
        path: `/teams/${teamId}/standup-config`,
        ipAddress: '127.0.0.1', // Service call, no real IP
        body: data,
      },
      payload: {
        teamId,
        teamName: team.name,
        configId: result.id,
        purpose: data.purpose,
        questions: data.questions.length,
        weekdays: data.weekdays,
        timeLocal: data.timeLocal,
        timezone: data.timezone,
      },
    });

    this.logger.info('Standup configuration created successfully', {
      configId: result.id,
      teamId,
      createdByUserId,
    });

    return { id: result.id };
  }

  async updateStandupConfig(
    teamId: string,
    orgId: string,
    data: UpdateStandupConfigDto,
  ): Promise<void> {
    this.logger.info('Updating standup configuration', { teamId, orgId });

    // Verify config exists and team belongs to org
    const config = await this.prisma.standupConfig.findFirst({
      where: {
        teamId,
        team: { orgId },
      },
      include: { team: true },
    });

    if (!config) {
      throw new ApiError(
        ErrorCode.STANDUP_CONFIG_NOT_FOUND,
        'Standup configuration not found',
        HttpStatus.NOT_FOUND,
      );
    }

    // Validate any provided data
    if (data.weekdays && data.timeLocal && data.timezone) {
      ValidationUtils.validateSchedule(data.weekdays, data.timeLocal, data.timezone);
    }

    if (data.questions) {
      ValidationUtils.validateQuestions(data.questions);
    }

    // Update the config
    await this.prisma.standupConfig.update({
      where: { id: config.id },
      data: {
        ...(data.purpose && { purpose: data.purpose }),
        ...(data.questions && { questions: data.questions }),
        ...(data.weekdays && { weekdays: data.weekdays }),
        ...(data.timeLocal && { timeLocal: data.timeLocal }),
        ...(data.timezone && { timezone: data.timezone }),
        ...(data.reminderMinutesBefore !== undefined && {
          reminderMinutesBefore: data.reminderMinutesBefore,
        }),
        ...(data.responseTimeoutHours !== undefined && {
          responseTimeoutHours: data.responseTimeoutHours,
        }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    this.logger.info('Standup configuration updated successfully', { teamId, configId: config.id });
  }

  async getStandupConfig(teamId: string, orgId: string): Promise<StandupConfigResponse> {
    this.logger.info('Getting standup configuration', { teamId, orgId });

    const config = await this.prisma.standupConfig.findFirst({
      where: {
        teamId,
        team: { orgId },
      },
      include: {
        team: {
          include: {
            channel: true,
          },
        },
        configMembers: {
          include: {
            teamMember: {
              include: {
                user: true,
                integrationUser: true,
              },
            },
          },
        },
      },
    });

    if (!config) {
      throw new ApiError(
        ErrorCode.STANDUP_CONFIG_NOT_FOUND,
        'Standup configuration not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const memberParticipation: MemberParticipationResponse[] = config.configMembers.map((cm) => ({
      teamMember: {
        id: cm.teamMember.id,
        name:
          cm.teamMember.user?.name ||
          cm.teamMember.integrationUser?.name ||
          cm.teamMember.name ||
          'Unknown',
        platformUserId:
          cm.teamMember.platformUserId || cm.teamMember.integrationUser?.externalUserId || '',
      },
      include: cm.include,
      role: cm.role,
    }));

    return {
      id: config.id,
      teamId: config.teamId,
      purpose: config.purpose as
        | 'daily'
        | 'weekly'
        | 'retrospective'
        | 'planning'
        | 'custom'
        | undefined,
      questions: config.questions,
      weekdays: config.weekdays,
      timeLocal: config.timeLocal,
      timezone: config.timezone,
      reminderMinutesBefore: config.reminderMinutesBefore,
      responseTimeoutHours: config.responseTimeoutHours,
      isActive: config.isActive,
      team: {
        id: config.team.id,
        name: config.team.name,
        channelName: config.team.channel?.name || 'Unknown Channel',
      },
      memberParticipation,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  async deleteStandupConfig(teamId: string, orgId: string): Promise<void> {
    this.logger.info('Deleting standup configuration', { teamId, orgId });

    const config = await this.prisma.standupConfig.findFirst({
      where: {
        teamId,
        team: { orgId },
      },
      include: { team: true },
    });

    if (!config) {
      throw new ApiError(
        ErrorCode.STANDUP_CONFIG_NOT_FOUND,
        'Standup configuration not found',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.prisma.standupConfig.delete({
      where: { id: config.id },
    });

    this.logger.info('Standup configuration deleted successfully', { teamId, configId: config.id });
  }

  async updateStandupConfigById(
    configId: string,
    orgId: string,
    data: UpdateStandupConfigDto,
  ): Promise<void> {
    this.logger.info('Updating standup configuration by ID', { configId, orgId });

    // Find the config and verify it belongs to the organization
    const config = await this.prisma.standupConfig.findFirst({
      where: {
        id: configId,
        team: { orgId },
      },
      include: { team: true },
    });

    if (!config) {
      throw new ApiError(
        ErrorCode.STANDUP_CONFIG_NOT_FOUND,
        'Standup configuration not found',
        HttpStatus.NOT_FOUND,
      );
    }

    // Validate input data if provided
    if (data.weekdays || data.timeLocal || data.timezone) {
      ValidationUtils.validateSchedule(
        data.weekdays || config.weekdays,
        data.timeLocal || config.timeLocal,
        data.timezone || config.timezone,
      );
    }
    if (data.questions) {
      ValidationUtils.validateQuestions(data.questions);
    }

    // Update the config
    await this.prisma.standupConfig.update({
      where: { id: configId },
      data: {
        ...(data.purpose && { purpose: data.purpose }),
        ...(data.questions && { questions: data.questions }),
        ...(data.weekdays && { weekdays: data.weekdays }),
        ...(data.timeLocal && { timeLocal: data.timeLocal }),
        ...(data.timezone && { timezone: data.timezone }),
        ...(data.reminderMinutesBefore !== undefined && {
          reminderMinutesBefore: data.reminderMinutesBefore,
        }),
        ...(data.responseTimeoutHours !== undefined && {
          responseTimeoutHours: data.responseTimeoutHours,
        }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    this.logger.info('Standup configuration updated successfully', { configId });
  }

  async deleteStandupConfigById(configId: string, orgId: string): Promise<void> {
    this.logger.info('Deleting standup configuration by ID', { configId, orgId });

    const config = await this.prisma.standupConfig.findFirst({
      where: {
        id: configId,
        team: { orgId },
      },
      include: { team: true },
    });

    if (!config) {
      throw new ApiError(
        ErrorCode.STANDUP_CONFIG_NOT_FOUND,
        'Standup configuration not found',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.prisma.standupConfig.delete({
      where: { id: configId },
    });

    this.logger.info('Standup configuration deleted successfully', { configId });
  }

  async listTeamsWithStandups(
    orgId: string,
  ): Promise<{ teamId: string; teamName: string; isActive: boolean }[]> {
    this.logger.info('Listing teams with standup configurations', { orgId });

    const configs = await this.prisma.standupConfig.findMany({
      where: {
        team: { orgId },
      },
      include: {
        team: true,
      },
    });

    return configs.map((config) => ({
      teamId: config.teamId,
      teamName: config.team.name,
      isActive: config.isActive,
    }));
  }

  async listStandupConfigsForTeam(teamId: string, orgId: string): Promise<StandupConfigResponse[]> {
    this.logger.info('Listing standup configurations for team', { teamId, orgId });

    const configs = await this.prisma.standupConfig.findMany({
      where: {
        teamId,
        team: { orgId },
      },
      include: {
        team: {
          include: {
            channel: true,
          },
        },
        configMembers: {
          include: {
            teamMember: {
              include: {
                user: true,
                integrationUser: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return configs.map((config) => {
      const memberParticipation: MemberParticipationResponse[] = config.configMembers.map((cm) => ({
        teamMember: {
          id: cm.teamMember.id,
          name:
            cm.teamMember.user?.name ||
            cm.teamMember.integrationUser?.name ||
            cm.teamMember.name ||
            'Unknown',
          platformUserId:
            cm.teamMember.platformUserId || cm.teamMember.integrationUser?.externalUserId || '',
        },
        include: cm.include,
        role: cm.role,
      }));

      return {
        id: config.id,
        teamId: config.teamId,
        purpose: config.purpose as
          | 'daily'
          | 'weekly'
          | 'retrospective'
          | 'planning'
          | 'custom'
          | undefined,
        questions: config.questions,
        weekdays: config.weekdays,
        timeLocal: config.timeLocal,
        timezone: config.timezone,
        reminderMinutesBefore: config.reminderMinutesBefore,
        responseTimeoutHours: config.responseTimeoutHours,
        isActive: config.isActive,
        team: {
          id: config.team.id,
          name: config.team.name,
          channelName: config.team.channel?.name || 'Unknown Channel',
        },
        memberParticipation,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      };
    });
  }

  async getStandupConfigById(configId: string, orgId: string): Promise<StandupConfigResponse> {
    this.logger.info('Getting standup configuration by ID', { configId, orgId });

    const config = await this.prisma.standupConfig.findFirst({
      where: {
        id: configId,
        team: { orgId },
      },
      include: {
        team: {
          include: {
            channel: true,
          },
        },
        configMembers: {
          include: {
            teamMember: {
              include: {
                user: true,
                integrationUser: true,
              },
            },
          },
        },
      },
    });

    if (!config) {
      throw new ApiError(
        ErrorCode.STANDUP_CONFIG_NOT_FOUND,
        'Standup configuration not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const memberParticipation: MemberParticipationResponse[] = config.configMembers.map((cm) => ({
      teamMember: {
        id: cm.teamMember.id,
        name:
          cm.teamMember.user?.name ||
          cm.teamMember.integrationUser?.name ||
          cm.teamMember.name ||
          'Unknown',
        platformUserId:
          cm.teamMember.platformUserId || cm.teamMember.integrationUser?.externalUserId || '',
      },
      include: cm.include,
      role: cm.role,
    }));

    return {
      id: config.id,
      teamId: config.teamId,
      purpose: config.purpose as
        | 'daily'
        | 'weekly'
        | 'retrospective'
        | 'planning'
        | 'custom'
        | undefined,
      questions: config.questions,
      weekdays: config.weekdays,
      timeLocal: config.timeLocal,
      timezone: config.timezone,
      reminderMinutesBefore: config.reminderMinutesBefore,
      responseTimeoutHours: config.responseTimeoutHours,
      isActive: config.isActive,
      team: {
        id: config.team.id,
        name: config.team.name,
        channelName: config.team.channel?.name || 'Unknown Channel',
      },
      memberParticipation,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  async updateMemberParticipation(
    teamId: string,
    memberId: string,
    data: UpdateMemberParticipationDto,
  ): Promise<void> {
    this.logger.info('Updating member participation', { teamId, memberId });

    // Verify standup config exists
    const config = await this.prisma.standupConfig.findFirst({
      where: { teamId },
    });

    if (!config) {
      throw new ApiError(
        ErrorCode.STANDUP_CONFIG_NOT_FOUND,
        'Standup configuration not found',
        HttpStatus.NOT_FOUND,
      );
    }

    // Verify team member exists
    const teamMember = await this.prisma.teamMember.findFirst({
      where: {
        id: memberId,
        teamId,
        active: true,
      },
    });

    if (!teamMember) {
      throw new ApiError(
        ErrorCode.TEAM_MEMBER_NOT_FOUND,
        'Team member not found or inactive',
        HttpStatus.NOT_FOUND,
      );
    }

    // Update or create participation record
    await this.prisma.standupConfigMember.upsert({
      where: {
        standupConfigId_teamMemberId: {
          standupConfigId: config.id,
          teamMemberId: memberId,
        },
      },
      create: {
        standupConfigId: config.id,
        teamMemberId: memberId,
        include: data.include,
        role: data.role,
      },
      update: {
        include: data.include,
        role: data.role,
      },
    });

    this.logger.info('Member participation updated successfully', { teamId, memberId });
  }

  async getMemberParticipation(teamId: string): Promise<MemberParticipationResponse[]> {
    this.logger.info('Getting member participation', { teamId });

    const config = await this.prisma.standupConfig.findFirst({
      where: { teamId },
      include: {
        configMembers: {
          include: {
            teamMember: {
              include: {
                user: true,
                integrationUser: true,
              },
            },
          },
        },
      },
    });

    if (!config) {
      throw new ApiError(
        ErrorCode.STANDUP_CONFIG_NOT_FOUND,
        'Standup configuration not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return config.configMembers.map((cm) => ({
      teamMember: {
        id: cm.teamMember.id,
        name:
          cm.teamMember.user?.name ||
          cm.teamMember.integrationUser?.name ||
          cm.teamMember.name ||
          'Unknown',
        platformUserId:
          cm.teamMember.platformUserId || cm.teamMember.integrationUser?.externalUserId || '',
      },
      include: cm.include,
      role: cm.role,
    }));
  }

  async getParticipatingMembers(teamId: string): Promise<MemberParticipationResponse[]> {
    const allMembers = await this.getMemberParticipation(teamId);
    return allMembers.filter((member) => member.include);
  }

  async bulkUpdateParticipation(teamId: string, data: BulkUpdateParticipationDto): Promise<void> {
    this.logger.info('Bulk updating member participation', {
      teamId,
      memberCount: data.members.length,
    });

    const config = await this.prisma.standupConfig.findFirst({
      where: { teamId },
    });

    if (!config) {
      throw new ApiError(
        ErrorCode.STANDUP_CONFIG_NOT_FOUND,
        'Standup configuration not found',
        HttpStatus.NOT_FOUND,
      );
    }

    // Verify all team members exist
    const memberIds = data.members.map((m) => m.teamMemberId);
    const teamMembers = await this.prisma.teamMember.findMany({
      where: {
        id: { in: memberIds },
        teamId,
        active: true,
      },
    });

    if (teamMembers.length !== memberIds.length) {
      throw new ApiError(
        ErrorCode.TEAM_MEMBER_NOT_FOUND,
        'One or more team members not found or inactive',
        HttpStatus.NOT_FOUND,
      );
    }

    // Bulk update in transaction
    await this.prisma.$transaction(async (tx) => {
      for (const member of data.members) {
        await tx.standupConfigMember.upsert({
          where: {
            standupConfigId_teamMemberId: {
              standupConfigId: config.id,
              teamMemberId: member.teamMemberId,
            },
          },
          create: {
            standupConfigId: config.id,
            teamMemberId: member.teamMemberId,
            include: member.include,
            role: member.role,
          },
          update: {
            include: member.include,
            role: member.role,
          },
        });
      }
    });

    this.logger.info('Bulk member participation updated successfully', { teamId });
  }

  async bulkUpdateParticipationById(
    configId: string,
    orgId: string,
    data: BulkUpdateParticipationDto,
  ): Promise<void> {
    this.logger.info('Bulk updating member participation by config ID', {
      configId,
      memberCount: data.members.length,
    });

    const config = await this.prisma.standupConfig.findFirst({
      where: {
        id: configId,
        team: { orgId },
      },
    });

    if (!config) {
      throw new ApiError(
        ErrorCode.STANDUP_CONFIG_NOT_FOUND,
        'Standup configuration not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return this.bulkUpdateParticipation(config.teamId, data);
  }

  async getPreview(teamId: string, orgId: string): Promise<PreviewResponse> {
    this.logger.info('Getting standup configuration preview', { teamId, orgId });

    const config = await this.getStandupConfig(teamId, orgId);
    const participatingMembers = config.memberParticipation.filter((m) => m.include);

    const weekdayNames = config.weekdays.map((day) => WEEKDAY_NAMES[day]);
    const nextStandup = ValidationUtils.getNextStandupDate(
      config.weekdays,
      config.timeLocal,
      config.timezone,
    );

    return {
      schedule: {
        weekdays: weekdayNames,
        timeLocal: config.timeLocal,
        timezone: config.timezone,
        nextStandup,
      },
      questions: config.questions,
      participatingMembers: participatingMembers.length,
      totalMembers: config.memberParticipation.length,
      reminderSettings: {
        minutesBefore: config.reminderMinutesBefore,
        timeoutHours: config.responseTimeoutHours,
      },
    };
  }

  // Validation methods
  validateSchedule(weekdays: number[], timeLocal: string, timezone: string): void {
    return ValidationUtils.validateSchedule(weekdays, timeLocal, timezone);
  }

  validateQuestions(questions: string[]): void {
    return ValidationUtils.validateQuestions(questions);
  }

  validateTimezone(timezone: string): boolean {
    return ValidationUtils.validateTimezone(timezone);
  }

  // Utility methods
  getQuestionTemplates() {
    return QUESTION_TEMPLATES;
  }

  getValidTimezones(): string[] {
    return ValidationUtils.getValidTimezones();
  }
}
