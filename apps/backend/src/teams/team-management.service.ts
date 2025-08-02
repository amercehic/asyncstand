import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { SlackApiService } from '@/integrations/slack/slack-api.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { LoggerService } from '@/common/logger.service';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { AuditActorType, AuditCategory, AuditSeverity, ResourceAction } from '@/common/audit/types';
import { CreateTeamDto } from '@/teams/dto/create-team.dto';
import { UpdateTeamDto } from '@/teams/dto/update-team.dto';
import {
  TeamListResponse,
  TeamDetailsResponse,
  AvailableChannelsResponse,
  AvailableMembersResponse,
  ChannelValidationResponse,
} from '@/teams/types/team-management.types';

@Injectable()
export class TeamManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly slackApiService: SlackApiService,
    private readonly auditLogService: AuditLogService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(TeamManagementService.name);
  }

  async createTeam(
    orgId: string,
    createdByUserId: string,
    data: CreateTeamDto,
  ): Promise<{ id: string }> {
    this.logger.info('Creating new team', { orgId, createdByUserId, teamName: data.name });

    // Validate integration belongs to organization
    const integration = await this.prisma.integration.findUnique({
      where: { id: data.integrationId },
    });

    if (!integration || integration.orgId !== orgId) {
      throw new ApiError(
        ErrorCode.NOT_FOUND,
        'Integration not found or does not belong to organization',
        HttpStatus.NOT_FOUND,
      );
    }

    // Check if team name already exists in organization
    const existingTeam = await this.prisma.team.findFirst({
      where: {
        orgId,
        name: data.name,
      },
    });

    if (existingTeam) {
      throw new ApiError(
        ErrorCode.CONFLICT,
        'Team name already exists in organization',
        HttpStatus.CONFLICT,
      );
    }

    // Check if channel is already assigned to another team
    const existingChannelAssignment = await this.prisma.team.findFirst({
      where: {
        integrationId: data.integrationId,
        channelId: data.channelId,
      },
    });

    if (existingChannelAssignment) {
      throw new ApiError(
        ErrorCode.CONFLICT,
        'Channel is already assigned to another team',
        HttpStatus.CONFLICT,
      );
    }

    // Validate channel access
    const channelValidation = await this.validateChannelAccess(data.channelId, data.integrationId);
    if (!channelValidation.valid) {
      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        channelValidation.error || 'Channel access validation failed',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const team = await this.prisma.team.create({
        data: {
          orgId,
          integrationId: data.integrationId,
          channelId: data.channelId,
          name: data.name,
          timezone: data.timezone,
          createdByUserId,
        },
      });

      await this.auditLogService.log({
        action: 'team.created',
        orgId,
        actorType: AuditActorType.USER,
        actorUserId: createdByUserId,
        category: AuditCategory.DATA_MODIFICATION,
        severity: AuditSeverity.MEDIUM,
        requestData: {
          method: 'POST',
          path: '/teams',
          ipAddress: '127.0.0.1',
          body: data,
        },
        resources: [
          {
            type: 'team',
            id: team.id,
            action: ResourceAction.CREATED,
          },
        ],
      });

      this.logger.info('Team created successfully', { teamId: team.id, orgId });

      return { id: team.id };
    } catch (error) {
      this.logger.error('Failed to create team', {
        error: error instanceof Error ? error.message : 'Unknown error',
        orgId,
        data,
      });
      throw error;
    }
  }

  async updateTeam(teamId: string, orgId: string, data: UpdateTeamDto): Promise<void> {
    this.logger.info('Updating team', { teamId, orgId });

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team || team.orgId !== orgId) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Team not found', HttpStatus.NOT_FOUND);
    }

    // If name is being updated, check for conflicts
    if (data.name && data.name !== team.name) {
      const existingTeam = await this.prisma.team.findFirst({
        where: {
          orgId,
          name: data.name,
          id: { not: teamId },
        },
      });

      if (existingTeam) {
        throw new ApiError(
          ErrorCode.CONFLICT,
          'Team name already exists in organization',
          HttpStatus.CONFLICT,
        );
      }
    }

    // If channel is being updated, validate it
    if (data.channelId && data.channelId !== team.channelId) {
      const existingChannelAssignment = await this.prisma.team.findFirst({
        where: {
          integrationId: data.integrationId || team.integrationId,
          channelId: data.channelId,
          id: { not: teamId },
        },
      });

      if (existingChannelAssignment) {
        throw new ApiError(
          ErrorCode.CONFLICT,
          'Channel is already assigned to another team',
          HttpStatus.CONFLICT,
        );
      }

      const channelValidation = await this.validateChannelAccess(
        data.channelId,
        data.integrationId || team.integrationId,
      );
      if (!channelValidation.valid) {
        throw new ApiError(
          ErrorCode.EXTERNAL_SERVICE_ERROR,
          channelValidation.error || 'Channel access validation failed',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    await this.prisma.team.update({
      where: { id: teamId },
      data,
    });

    this.logger.info('Team updated successfully', { teamId, orgId });
  }

  async deleteTeam(teamId: string, orgId: string): Promise<void> {
    this.logger.info('Deleting team', { teamId, orgId });

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: true,
        configs: true,
        instances: true,
      },
    });

    if (!team || team.orgId !== orgId) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Team not found', HttpStatus.NOT_FOUND);
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // Delete standup instances and related data
        for (const instance of team.instances) {
          await tx.answer.deleteMany({
            where: { standupInstanceId: instance.id },
          });

          await tx.participationSnapshot.deleteMany({
            where: { standupInstanceId: instance.id },
          });

          await tx.standupDigestPost.deleteMany({
            where: { standupInstanceId: instance.id },
          });
        }

        await tx.standupInstance.deleteMany({
          where: { teamId },
        });

        // Delete standup configs and memberships
        for (const config of team.configs) {
          await tx.standupConfigMember.deleteMany({
            where: { standupConfigId: config.id },
          });
        }

        await tx.standupConfig.deleteMany({
          where: { teamId },
        });

        // Delete team members
        await tx.teamMember.deleteMany({
          where: { teamId },
        });

        // Delete the team
        await tx.team.delete({
          where: { id: teamId },
        });
      });

      this.logger.info('Team deleted successfully', { teamId, orgId });
    } catch (error) {
      this.logger.error('Failed to delete team', {
        error: error instanceof Error ? error.message : 'Unknown error',
        teamId,
        orgId,
      });
      throw error;
    }
  }

  async listTeams(orgId: string): Promise<TeamListResponse> {
    this.logger.info('Listing teams', { orgId });

    const teams = await this.prisma.team.findMany({
      where: { orgId },
      include: {
        _count: {
          select: { members: true },
        },
        configs: {
          select: { id: true },
          take: 1,
        },
        createdBy: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get channel names from Slack
    const teamsWithChannelNames = await Promise.all(
      teams.map(async (team) => {
        let channelName = team.channelId;
        try {
          // TODO: Implement channel name lookup via Slack API
          // For now, use the channelId as fallback
          channelName = team.channelId;
        } catch {
          this.logger.warn('Failed to get channel name', {
            teamId: team.id,
            channelId: team.channelId,
          });
        }

        return {
          id: team.id,
          name: team.name,
          channelName,
          memberCount: team._count.members,
          hasStandupConfig: team.configs.length > 0,
          createdAt: team.createdAt,
          createdBy: {
            name: team.createdBy?.name || 'System',
          },
        };
      }),
    );

    return { teams: teamsWithChannelNames };
  }

  async getTeamDetails(teamId: string, orgId: string): Promise<TeamDetailsResponse> {
    this.logger.info('Getting team details', { teamId, orgId });

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        integration: {
          select: { externalTeamId: true },
        },
        members: {
          include: {
            addedBy: {
              select: { name: true },
            },
          },
          orderBy: { addedAt: 'desc' },
        },
        configs: {
          select: {
            id: true,
            questions: true,
            weekdays: true,
            timeLocal: true,
            reminderMinutesBefore: true,
          },
          take: 1,
        },
        createdBy: {
          select: { name: true },
        },
      },
    });

    if (!team || team.orgId !== orgId) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Team not found', HttpStatus.NOT_FOUND);
    }

    // TODO: Get channel name from Slack API
    const channelName = team.channelId;

    return {
      id: team.id,
      name: team.name,
      timezone: team.timezone,
      integration: {
        teamName: team.integration.externalTeamId,
      },
      channel: {
        id: team.channelId,
        name: channelName,
      },
      members: team.members.map((member) => ({
        id: member.id,
        name: member.name || 'Unknown',
        platformUserId: member.platformUserId || '',
        addedAt: member.addedAt,
        addedBy: member.addedBy ? { name: member.addedBy.name } : null,
      })),
      standupConfig: team.configs[0] || undefined,
      createdAt: team.createdAt,
      createdBy: team.createdBy ? { name: team.createdBy.name } : null,
    };
  }

  async validateChannelAccess(
    channelId: string,
    integrationId: string,
  ): Promise<ChannelValidationResponse> {
    try {
      // Use Slack API to validate channel access - need to access private method
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (this.slackApiService as any).callSlackApi(
        integrationId,
        'conversations.info',
        { channel: channelId },
      );

      return {
        valid: true,
        channelName: response.channel?.name || channelId,
      };
    } catch (error) {
      this.logger.warn('Channel validation failed', {
        channelId,
        integrationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        valid: false,
        error: 'Bot does not have access to this channel or channel does not exist',
      };
    }
  }

  async getAvailableChannels(orgId: string): Promise<AvailableChannelsResponse> {
    this.logger.info('Getting available channels', { orgId });

    // Get all integrations for the organization
    const integrations = await this.prisma.integration.findMany({
      where: {
        orgId,
        platform: 'slack',
        tokenStatus: 'ok',
      },
    });

    if (integrations.length === 0) {
      return { channels: [] };
    }

    // Get assigned channels
    const assignedChannels = await this.prisma.team.findMany({
      where: { orgId },
      select: {
        channelId: true,
        name: true,
        integrationId: true,
      },
    });

    const assignedChannelMap = new Map(
      assignedChannels.map((team) => [`${team.integrationId}-${team.channelId}`, team.name]),
    );

    // Get channels from each integration
    const allChannels = [];
    for (const integration of integrations) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await (this.slackApiService as any).callSlackApi(
          integration.id,
          'conversations.list',
          { types: 'public_channel', limit: 100 },
        );

        for (const channel of response.channels || []) {
          if (channel.is_channel && !channel.is_archived && channel.is_member) {
            const key = `${integration.id}-${channel.id}`;
            const isAssigned = assignedChannelMap.has(key);

            allChannels.push({
              id: channel.id,
              name: channel.name,
              isAssigned,
              assignedTeamName: isAssigned ? assignedChannelMap.get(key) : undefined,
            });
          }
        }
      } catch (error) {
        this.logger.warn('Failed to get channels from integration', {
          integrationId: integration.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { channels: allChannels };
  }

  async addTeamMember(teamId: string, memberId: string, addedByUserId: string): Promise<void> {
    this.logger.info('Adding team member', { teamId, memberId, addedByUserId });

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Team not found', HttpStatus.NOT_FOUND);
    }

    const member = await this.prisma.teamMember.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Team member not found', HttpStatus.NOT_FOUND);
    }

    // Check if member is already in the team
    const existingMembership = await this.prisma.teamMember.findFirst({
      where: {
        teamId,
        OR: [{ platformUserId: member.platformUserId }, { userId: member.userId }],
      },
    });

    if (existingMembership) {
      throw new ApiError(ErrorCode.CONFLICT, 'Member is already in this team', HttpStatus.CONFLICT);
    }

    // Create new team membership
    await this.prisma.teamMember.create({
      data: {
        teamId,
        platformUserId: member.platformUserId,
        userId: member.userId,
        name: member.name,
        addedByUserId,
      },
    });

    this.logger.info('Team member added successfully', { teamId, memberId });
  }

  async removeTeamMember(teamId: string, memberId: string): Promise<void> {
    this.logger.info('Removing team member', { teamId, memberId });

    const membership = await this.prisma.teamMember.findFirst({
      where: {
        teamId,
        id: memberId,
      },
    });

    if (!membership) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Team membership not found', HttpStatus.NOT_FOUND);
    }

    await this.prisma.teamMember.delete({
      where: { id: memberId },
    });

    this.logger.info('Team member removed successfully', { teamId, memberId });
  }

  async getTeamMembers(teamId: string) {
    const members = await this.prisma.teamMember.findMany({
      where: { teamId },
      include: {
        addedBy: {
          select: { name: true },
        },
      },
      orderBy: { addedAt: 'desc' },
    });

    return members.map((member) => ({
      id: member.id,
      name: member.name || 'Unknown',
      platformUserId: member.platformUserId || '',
      addedAt: member.addedAt,
      addedBy: member.addedBy ? { name: member.addedBy.name } : null,
    }));
  }

  async getAvailableMembers(orgId: string): Promise<AvailableMembersResponse> {
    this.logger.info('Getting available members', { orgId });

    // Get all unique team members from teams in this organization
    const teams = await this.prisma.team.findMany({
      where: { orgId },
      include: {
        members: {
          select: {
            id: true,
            name: true,
            platformUserId: true,
            userId: true,
          },
        },
      },
    });

    // Flatten and deduplicate members by platformUserId
    const memberMap = new Map();
    for (const team of teams) {
      for (const member of team.members) {
        const key = member.platformUserId || member.userId;
        if (!memberMap.has(key)) {
          memberMap.set(key, {
            id: member.id,
            name: member.name || 'Unknown',
            platformUserId: member.platformUserId || '',
            inTeamCount: 1,
          });
        } else {
          const existing = memberMap.get(key);
          existing.inTeamCount++;
        }
      }
    }

    return { members: Array.from(memberMap.values()) };
  }
}
