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
        slackChannelId: data.channelId,
      },
    });

    if (existingChannelAssignment) {
      throw new ApiError(
        ErrorCode.CONFLICT,
        'Channel is already assigned to another team',
        HttpStatus.CONFLICT,
      );
    }

    // Find the channel record in our database
    const channel = await this.prisma.channel.findUnique({
      where: {
        integrationId_channelId: {
          integrationId: data.integrationId,
          channelId: data.channelId,
        },
      },
    });

    if (!channel) {
      throw new ApiError(
        ErrorCode.NOT_FOUND,
        'Channel not found. Please sync the workspace first.',
        HttpStatus.NOT_FOUND,
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
          channelId: channel.id,
          slackChannelId: data.channelId,
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
    if (data.channelId && data.channelId !== team.slackChannelId) {
      const existingChannelAssignment = await this.prisma.team.findFirst({
        where: {
          integrationId: data.integrationId || team.integrationId,
          slackChannelId: data.channelId,
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

      // Find the new channel record
      const newChannel = await this.prisma.channel.findUnique({
        where: {
          integrationId_channelId: {
            integrationId: data.integrationId || team.integrationId,
            channelId: data.channelId,
          },
        },
      });

      if (!newChannel) {
        throw new ApiError(
          ErrorCode.NOT_FOUND,
          'Channel not found. Please sync the workspace first.',
          HttpStatus.NOT_FOUND,
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

      // Update with new channel reference
      const updateData = {
        ...data,
        channelId: newChannel.id,
        slackChannelId: data.channelId,
      };
      delete updateData.channelId; // Remove the Slack channel ID from update data

      await this.prisma.team.update({
        where: { id: teamId },
        data: {
          ...updateData,
          channelId: newChannel.id,
          slackChannelId: data.channelId,
        },
      });
    } else {
      await this.prisma.team.update({
        where: { id: teamId },
        data: {
          name: data.name,
          timezone: data.timezone,
          // Don't update channel-related fields if channel isn't changing
        },
      });
    }

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

    // Get all channels from database that belong to organization's integrations
    const channels = await this.prisma.channel.findMany({
      where: {
        integration: {
          orgId,
          platform: 'slack',
          tokenStatus: 'ok',
        },
        isArchived: false, // Only show non-archived channels
      },
      include: {
        teams: {
          select: {
            name: true,
          },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    });

    return {
      channels: channels.map((channel) => ({
        id: channel.channelId, // Return Slack channel ID for team creation
        name: channel.name,
        isAssigned: channel.teams.length > 0,
        assignedTeamName: channel.teams[0]?.name,
      })),
    };
  }

  async addTeamMember(teamId: string, slackUserId: string, addedByUserId: string): Promise<void> {
    this.logger.info('Adding team member', { teamId, slackUserId, addedByUserId });

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { integration: true },
    });

    if (!team) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Team not found', HttpStatus.NOT_FOUND);
    }

    // Get user info from Slack API
    let userName = 'Unknown';
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userResponse = await (this.slackApiService as any).callSlackApi(
        team.integrationId,
        'users.info',
        { user: slackUserId },
      );

      if (userResponse.user) {
        userName =
          userResponse.user.profile.display_name ||
          userResponse.user.profile.real_name ||
          userResponse.user.name ||
          'Unknown';
      }
    } catch (error) {
      this.logger.warn('Failed to get user info from Slack', {
        slackUserId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Check if member is already in the team
    const existingMembership = await this.prisma.teamMember.findFirst({
      where: {
        teamId,
        platformUserId: slackUserId,
      },
    });

    if (existingMembership) {
      throw new ApiError(ErrorCode.CONFLICT, 'Member is already in this team', HttpStatus.CONFLICT);
    }

    // Create new team membership
    await this.prisma.teamMember.create({
      data: {
        teamId,
        platformUserId: slackUserId,
        name: userName,
        addedByUserId,
      },
    });

    this.logger.info('Team member added successfully', { teamId, slackUserId });
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

    // Get all Slack integrations for this organization
    const integrations = await this.prisma.integration.findMany({
      where: {
        orgId,
        platform: 'slack',
        tokenStatus: 'ok',
      },
    });

    this.logger.info('Found integrations', {
      count: integrations.length,
      integrations: integrations.map((i) => ({ id: i.id, tokenStatus: i.tokenStatus })),
    });

    const memberMap = new Map();

    // Fetch users from each Slack integration
    for (const integration of integrations) {
      this.logger.info('Fetching users from integration', { integrationId: integration.id });
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await (this.slackApiService as any).callSlackApi(
          integration.id,
          'users.list',
          { limit: 200 },
        );

        this.logger.info('Slack API response received', {
          integrationId: integration.id,
          memberCount: response.members?.length || 0,
          hasMembers: !!response.members,
        });

        for (const user of response.members || []) {
          if (user.deleted || user.is_bot || user.is_app_user) {
            continue;
          }

          const key = user.id;
          if (!memberMap.has(key)) {
            // Count how many teams this user is currently in
            const teamCount = await this.prisma.teamMember.count({
              where: {
                platformUserId: user.id,
                team: {
                  orgId,
                },
              },
            });

            memberMap.set(key, {
              id: user.id, // Use Slack user ID as the ID for now
              name: user.profile.display_name || user.profile.real_name || user.name || 'Unknown',
              platformUserId: user.id,
              inTeamCount: teamCount,
            });
          }
        }
      } catch (error) {
        this.logger.error('Failed to get users from integration', {
          integrationId: integration.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorStack: error instanceof Error ? error.stack : undefined,
        });
      }
    }

    const result = Array.from(memberMap.values());
    this.logger.info('Returning available members', { count: result.length });
    return { members: result };
  }

  async getChannelsList(orgId: string): Promise<{
    channels: Array<{
      id: string;
      name: string;
      topic?: string;
      purpose?: string;
      isPrivate: boolean;
      isArchived: boolean;
      memberCount?: number;
      isAssigned: boolean;
      assignedTeamName?: string;
      lastSyncAt?: Date;
    }>;
  }> {
    this.logger.info('Getting channels list', { orgId });

    // Get all channels for organization's integrations
    const channels = await this.prisma.channel.findMany({
      where: {
        integration: {
          orgId,
          platform: 'slack',
        },
      },
      include: {
        teams: {
          select: {
            name: true,
          },
          take: 1,
        },
      },
      orderBy: [{ isArchived: 'asc' }, { name: 'asc' }],
    });

    return {
      channels: channels.map((channel) => ({
        id: channel.id,
        name: channel.name,
        topic: channel.topic,
        purpose: channel.purpose,
        isPrivate: channel.isPrivate,
        isArchived: channel.isArchived,
        memberCount: channel.memberCount,
        isAssigned: channel.teams.length > 0,
        assignedTeamName: channel.teams[0]?.name,
        lastSyncAt: channel.lastSyncAt,
      })),
    };
  }
}
