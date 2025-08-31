import { Injectable, HttpStatus, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';
import { SlackApiService } from '@/integrations/slack/slack-api.service';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
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
    private readonly logger: LoggerService,
    @Inject(forwardRef(() => SlackApiService))
    private readonly slackApi: SlackApiService,
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
      },
    });

    if (!team) {
      throw new ApiError(
        ErrorCode.NOT_FOUND,
        'Team not found or does not belong to organization',
        HttpStatus.NOT_FOUND,
      );
    }

    // Validate channel if delivery type is channel
    if (data.deliveryType === 'channel') {
      if (!data.targetChannelId) {
        throw new ApiError(
          ErrorCode.CONFIGURATION_ERROR,
          'Target channel is required for channel-based standups',
          HttpStatus.BAD_REQUEST,
        );
      }

      const targetChannel = await this.prisma.channel.findUnique({
        where: { id: data.targetChannelId },
      });

      if (!targetChannel || targetChannel.integrationId !== team.integrationId) {
        throw new ApiError(
          ErrorCode.NOT_FOUND,
          'Target channel not found or does not belong to team integration',
          HttpStatus.NOT_FOUND,
        );
      }
    }

    // Check for existing config with same name
    const existingConfig = await this.prisma.standupConfig.findFirst({
      where: {
        teamId,
        name: data.name,
      },
    });

    if (existingConfig) {
      throw new ApiError(
        ErrorCode.STANDUP_CONFIG_ALREADY_EXISTS,
        `A standup configuration with name "${data.name}" already exists for this team`,
        HttpStatus.CONFLICT,
      );
    }

    // Validate memberIds if provided
    if (data.memberIds && data.memberIds.length > 0) {
      const validMemberIds = team.members.map((m) => m.id);
      const invalidMemberIds = data.memberIds.filter((id) => !validMemberIds.includes(id));

      if (invalidMemberIds.length > 0) {
        throw new ApiError(
          ErrorCode.VALIDATION_FAILED,
          `Invalid member IDs provided: ${invalidMemberIds.join(', ')}. Members must belong to this team.`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // Check for time conflicts with existing configs
    await this.validateTimeConflicts(teamId, data.weekdays, data.timeLocal, data.timezone);

    // Validate input data
    ValidationUtils.validateSchedule(data.weekdays, data.timeLocal, data.timezone);
    ValidationUtils.validateQuestions(data.questions);

    // Create standup config in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create the config
      const config = await tx.standupConfig.create({
        data: {
          teamId,
          name: data.name,
          deliveryType: data.deliveryType,
          targetChannelId: data.targetChannelId,
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

      // Add team members to standup configuration based on selection
      const memberParticipation = team.members.map((member) => {
        // If memberIds were specified, only include those members
        // If no memberIds specified, include all members (backwards compatibility)
        const shouldInclude = data.memberIds ? data.memberIds.includes(member.id) : false; // Default to false - require explicit selection

        return {
          standupConfigId: config.id,
          teamMemberId: member.id,
          include: shouldInclude,
          role: null,
        };
      });

      if (memberParticipation.length > 0) {
        await tx.standupConfigMember.createMany({
          data: memberParticipation,
        });

        const includedCount = memberParticipation.filter((mp) => mp.include).length;
        this.logger.info('Added team members to standup config with selective inclusion', {
          configId: config.id,
          totalMembers: memberParticipation.length,
          includedMembers: includedCount,
          memberIdsProvided: !!data.memberIds,
          teamId,
        });
      }

      return config;
    });

    // Audit logging is now handled by the @Audit decorator in StandupConfigController

    this.logger.info('Standup configuration created successfully', {
      configId: result.id,
      teamId,
      createdByUserId,
    });

    // If this is a channel-based standup, automatically join the bot to the channel
    if (data.deliveryType === 'channel' && data.targetChannelId && team.integrationId) {
      try {
        // Get the target channel details to get the Slack channel ID
        const targetChannel = await this.prisma.channel.findUnique({
          where: { id: data.targetChannelId },
          select: { channelId: true, name: true },
        });

        if (targetChannel?.channelId) {
          this.logger.info('Attempting to join bot to channel', {
            configId: result.id,
            channelId: targetChannel.channelId,
            channelName: targetChannel.name,
            integrationId: team.integrationId,
          });

          const joinResult = await this.slackApi.joinChannel(
            team.integrationId,
            targetChannel.channelId,
          );

          if (joinResult.success) {
            this.logger.info('Bot successfully joined channel', {
              configId: result.id,
              channelId: targetChannel.channelId,
              channelName: targetChannel.name,
            });
          } else {
            this.logger.warn('Failed to join bot to channel', {
              configId: result.id,
              channelId: targetChannel.channelId,
              channelName: targetChannel.name,
              error: joinResult.error,
            });
          }
        } else {
          this.logger.warn('Target channel not found for bot joining', {
            configId: result.id,
            targetChannelId: data.targetChannelId,
          });
        }
      } catch (error) {
        // Don't fail the entire config creation if bot joining fails
        this.logger.error('Error joining bot to channel', {
          configId: result.id,
          targetChannelId: data.targetChannelId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { id: result.id };
  }

  // DEPRECATED: Use updateStandupConfigById instead
  // This method was used when there was only one config per team
  async updateStandupConfig(
    teamId: string,
    orgId: string,
    data: UpdateStandupConfigDto,
  ): Promise<void> {
    this.logger.info('Updating standup configuration', { teamId, orgId });

    // For backwards compatibility, get the first (usually only) config for this team
    const config = await this.prisma.standupConfig.findFirst({
      where: {
        teamId,
        team: { orgId },
      },
      include: { team: true },
      orderBy: { createdAt: 'asc' }, // Get the oldest one for consistency
    });

    if (!config) {
      throw new ApiError(
        ErrorCode.STANDUP_CONFIG_NOT_FOUND,
        'Standup configuration not found',
        HttpStatus.NOT_FOUND,
      );
    }

    // Validate any provided data
    const updatedWeekdays = data.weekdays || config.weekdays;
    const updatedTimeLocal = data.timeLocal || config.timeLocal;
    const updatedTimezone = data.timezone || config.timezone;

    if (data.weekdays || data.timeLocal || data.timezone) {
      ValidationUtils.validateSchedule(updatedWeekdays, updatedTimeLocal, updatedTimezone);
    }

    if (data.questions) {
      ValidationUtils.validateQuestions(data.questions);
    }

    // Check for time conflicts if schedule is being updated
    if (data.weekdays || data.timeLocal || data.timezone) {
      await this.validateTimeConflicts(
        config.teamId,
        updatedWeekdays,
        updatedTimeLocal,
        updatedTimezone,
        config.id, // Exclude current config from conflict check
      );
    }

    // Allow multiple configs per team with same name - only validate time conflicts when schedule changes

    // Update the config
    await this.prisma.standupConfig.update({
      where: { id: config.id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.deliveryType && { deliveryType: data.deliveryType }),
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

  async getStandupConfigById(configId: string, orgId: string): Promise<StandupConfigResponse> {
    this.logger.info('Getting standup configuration by ID', { configId, orgId });

    const config = await this.prisma.standupConfig.findFirst({
      where: {
        id: configId,
        team: { orgId },
      },
      include: {
        team: true,
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
      name: config.name,
      deliveryType: config.deliveryType,
      targetChannelId: config.targetChannelId || undefined,
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
      },
      memberParticipation,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  async getStandupConfig(teamId: string, orgId: string): Promise<StandupConfigResponse> {
    this.logger.info('Getting standup configuration', { teamId, orgId });

    // For backwards compatibility, get the first (usually the primary/oldest) config for this team
    const config = await this.prisma.standupConfig.findFirst({
      where: {
        teamId,
        team: { orgId },
      },
      include: {
        team: true,
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
      orderBy: [
        { isActive: 'desc' }, // Prefer active configs
        { createdAt: 'asc' }, // Then oldest (original) config
      ],
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
      name: config.name,
      deliveryType: config.deliveryType,
      targetChannelId: config.targetChannelId || undefined,
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
      },
      memberParticipation,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  async deleteStandupConfig(teamId: string, orgId: string): Promise<void> {
    this.logger.info('Deleting standup configuration', { teamId, orgId });

    // For backwards compatibility, delete the first config for this team
    const config = await this.prisma.standupConfig.findFirst({
      where: {
        teamId,
        team: { orgId },
      },
      include: { team: true },
      orderBy: [
        { isActive: 'desc' }, // Prefer active configs
        { createdAt: 'asc' }, // Then oldest (original) config
      ],
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
    const updatedWeekdays = data.weekdays || config.weekdays;
    const updatedTimeLocal = data.timeLocal || config.timeLocal;
    const updatedTimezone = data.timezone || config.timezone;

    if (data.weekdays || data.timeLocal || data.timezone) {
      ValidationUtils.validateSchedule(updatedWeekdays, updatedTimeLocal, updatedTimezone);
    }
    if (data.questions) {
      ValidationUtils.validateQuestions(data.questions);
    }

    // Check for time conflicts if schedule is being updated
    if (data.weekdays || data.timeLocal || data.timezone) {
      await this.validateTimeConflicts(
        config.teamId,
        updatedWeekdays,
        updatedTimeLocal,
        updatedTimezone,
        configId, // Exclude current config from conflict check
      );
    }

    // Allow multiple configs per team with same name - only validate time conflicts when schedule changes

    // Update the config
    await this.prisma.standupConfig.update({
      where: { id: configId },
      data: {
        ...(data.name && { name: data.name }),
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

  async updateMemberParticipation(
    teamId: string,
    memberId: string,
    data: UpdateMemberParticipationDto,
  ): Promise<void> {
    this.logger.info('Updating member participation', { teamId, memberId });

    // Verify standup config exists - use first config for backward compatibility
    const config = await this.prisma.standupConfig.findFirst({
      where: { teamId },
      orderBy: [
        { isActive: 'desc' }, // Prefer active configs
        { createdAt: 'asc' }, // Then oldest (original) config
      ],
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
      orderBy: [
        { isActive: 'desc' }, // Prefer active configs
        { createdAt: 'asc' }, // Then oldest (original) config
      ],
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
      orderBy: [
        { isActive: 'desc' }, // Prefer active configs
        { createdAt: 'asc' }, // Then oldest (original) config
      ],
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

  // NEW: Get all standup configurations for a team
  async getTeamStandupConfigs(teamId: string, orgId: string): Promise<StandupConfigResponse[]> {
    this.logger.info('Getting all standup configurations for team', { teamId, orgId });

    const configs = await this.prisma.standupConfig.findMany({
      where: {
        teamId,
        team: { orgId },
      },
      include: {
        team: true,
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
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
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
        name: config.name,
        deliveryType: config.deliveryType,
        targetChannelId: config.targetChannelId || undefined,
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
        },
        memberParticipation,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      };
    });
  }

  // Time conflict validation method
  private async validateTimeConflicts(
    teamId: string,
    weekdays: number[],
    timeLocal: string,
    timezone: string,
    excludeConfigId?: string,
  ): Promise<void> {
    const existingConfigs = await this.prisma.standupConfig.findMany({
      where: {
        teamId,
        isActive: true,
        ...(excludeConfigId && { id: { not: excludeConfigId } }),
      },
      select: {
        id: true,
        name: true,
        weekdays: true,
        timeLocal: true,
        timezone: true,
      },
    });

    // Check for conflicts
    for (const existing of existingConfigs) {
      // Check if any weekdays overlap
      const hasOverlappingDays = weekdays.some((day) => existing.weekdays.includes(day));

      if (hasOverlappingDays) {
        // Check if times are the same (accounting for timezone differences)
        const isSameTime = existing.timeLocal === timeLocal && existing.timezone === timezone;

        if (isSameTime) {
          throw new ApiError(
            ErrorCode.STANDUP_CONFIG_ALREADY_EXISTS,
            `A standup configuration "${existing.name}" already exists at the same time (${timeLocal} ${timezone}) on overlapping days`,
            HttpStatus.CONFLICT,
          );
        }
      }
    }
  }
}
