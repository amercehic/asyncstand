import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { LoggerService } from '@/common/logger.service';
import { SlackOauthService } from '@/integrations/slack/slack-oauth.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { AuditActorType, AuditCategory, AuditSeverity, ResourceAction } from '@/common/audit/types';
import {
  SlackUsersListResponse,
  SlackConversationsListResponse,
  SlackSyncResult,
} from '@/integrations/slack/types/slack-api.types';

@Injectable()
export class SlackApiService {
  private readonly baseUrl = 'https://slack.com/api';

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly slackOauthService: SlackOauthService,
    private readonly auditLogService: AuditLogService,
  ) {
    this.logger.setContext(SlackApiService.name);
  }

  async syncWorkspaceData(integrationId: string): Promise<SlackSyncResult> {
    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId },
      include: { org: true },
    });

    if (!integration) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Integration not found', HttpStatus.NOT_FOUND);
    }

    if (integration.platform !== 'slack') {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        'Integration is not a Slack integration',
        HttpStatus.BAD_REQUEST,
      );
    }

    const result: SlackSyncResult = {
      usersAdded: 0,
      usersUpdated: 0,
      channelsAdded: 0,
      channelsUpdated: 0,
      errors: [],
    };

    try {
      await this.updateSyncState(integrationId, {
        lastUsersSyncAt: null,
        lastChannelsSyncAt: null,
        errorMsg: null,
      });

      const usersResult = await this.syncUsers(integrationId);
      result.usersAdded = usersResult.added;
      result.usersUpdated = usersResult.updated;
      result.errors.push(...usersResult.errors);

      const channelsResult = await this.syncChannels(integrationId);
      result.channelsAdded = channelsResult.added;
      result.channelsUpdated = channelsResult.updated;
      result.errors.push(...channelsResult.errors);

      await this.updateSyncState(integrationId, {
        lastUsersSyncAt: new Date(),
        lastChannelsSyncAt: new Date(),
        errorMsg: result.errors.length > 0 ? result.errors.join('; ') : null,
      });

      await this.auditLogService.log({
        action: 'integration.slack.sync_completed',
        orgId: integration.orgId,
        actorType: AuditActorType.SYSTEM,
        category: AuditCategory.SYSTEM,
        severity: result.errors.length > 0 ? AuditSeverity.MEDIUM : AuditSeverity.LOW,
        requestData: {
          method: 'POST',
          path: '/slack/sync',
          ipAddress: '127.0.0.1',
          body: { integrationId, result },
        },
        resources: [
          {
            type: 'integration',
            id: integrationId,
            action: ResourceAction.UPDATED,
          },
        ],
      });

      this.logger.info('Slack workspace sync completed', {
        integrationId,
        result,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(errorMessage);

      await this.updateSyncState(integrationId, {
        errorMsg: errorMessage,
      });

      await this.auditLogService.log({
        action: 'integration.slack.sync_failed',
        orgId: integration.orgId,
        actorType: AuditActorType.SYSTEM,
        category: AuditCategory.SYSTEM,
        severity: AuditSeverity.HIGH,
        requestData: {
          method: 'POST',
          path: '/slack/sync',
          ipAddress: '127.0.0.1',
          body: { integrationId, error: errorMessage },
        },
        resources: [
          {
            type: 'integration',
            id: integrationId,
            action: ResourceAction.UPDATED,
          },
        ],
      });

      this.logger.error('Slack workspace sync failed', {
        integrationId,
        error: errorMessage,
      });

      throw error;
    }
  }

  private async syncUsers(
    integrationId: string,
  ): Promise<{ added: number; updated: number; errors: string[] }> {
    const result = { added: 0, updated: 0, errors: [] };
    let cursor: string | undefined;

    do {
      try {
        const response = await this.callSlackApi<SlackUsersListResponse>(
          integrationId,
          'users.list',
          cursor ? { cursor } : {},
        );

        for (const user of response.members) {
          if (user.deleted || user.is_bot || user.is_app_user) {
            continue;
          }

          try {
            const team = await this.ensureTeamExists(integrationId);

            const existingMember = await this.prisma.teamMember.findFirst({
              where: {
                teamId: team.id,
                platformUserId: user.id,
              },
            });

            const memberData = {
              name: user.profile.display_name || user.profile.real_name || user.name,
              active: true,
            };

            if (existingMember) {
              await this.prisma.teamMember.update({
                where: { id: existingMember.id },
                data: memberData,
              });
              result.updated++;
            } else {
              await this.prisma.teamMember.create({
                data: {
                  teamId: team.id,
                  platformUserId: user.id,
                  ...memberData,
                },
              });
              result.added++;
            }
          } catch (error) {
            const errorMessage = `Failed to sync user ${user.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            result.errors.push(errorMessage);
            this.logger.warn(errorMessage, { integrationId, userId: user.id });
          }
        }

        cursor = response.response_metadata?.next_cursor;
      } catch (error) {
        const errorMessage = `Failed to fetch users: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMessage);
        this.logger.error(errorMessage, { integrationId });
        break;
      }
    } while (cursor);

    return result;
  }

  private async syncChannels(
    integrationId: string,
  ): Promise<{ added: number; updated: number; errors: string[] }> {
    const result = { added: 0, updated: 0, errors: [] };
    let cursor: string | undefined;

    do {
      try {
        const response = await this.callSlackApi<SlackConversationsListResponse>(
          integrationId,
          'conversations.list',
          {
            types: 'public_channel',
            ...(cursor ? { cursor } : {}),
          },
        );

        for (const channel of response.channels) {
          if (
            !channel.is_channel ||
            channel.is_private ||
            channel.is_archived ||
            !channel.is_member
          ) {
            continue;
          }

          try {
            const integration = await this.prisma.integration.findUnique({
              where: { id: integrationId },
            });

            const existingTeam = await this.prisma.team.findFirst({
              where: {
                integrationId,
                channelId: channel.id,
              },
            });

            const teamData = {
              name: channel.name,
              timezone: 'UTC',
            };

            if (existingTeam) {
              await this.prisma.team.update({
                where: { id: existingTeam.id },
                data: teamData,
              });
              result.updated++;
            } else {
              await this.prisma.team.create({
                data: {
                  orgId: integration.orgId,
                  integrationId,
                  channelId: channel.id,
                  ...teamData,
                },
              });
              result.added++;
            }
          } catch (error) {
            const errorMessage = `Failed to sync channel ${channel.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            result.errors.push(errorMessage);
            this.logger.warn(errorMessage, { integrationId, channelId: channel.id });
          }
        }

        cursor = response.response_metadata?.next_cursor;
      } catch (error) {
        const errorMessage = `Failed to fetch channels: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMessage);
        this.logger.error(errorMessage, { integrationId });
        break;
      }
    } while (cursor);

    return result;
  }

  private async ensureTeamExists(integrationId: string): Promise<{ id: string }> {
    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId },
    });

    let team = await this.prisma.team.findFirst({
      where: {
        integrationId,
        channelId: null,
      },
    });

    if (!team) {
      team = await this.prisma.team.create({
        data: {
          orgId: integration.orgId,
          integrationId,
          channelId: null,
          name: 'Slack Workspace Members',
          timezone: 'UTC',
        },
      });
    }

    return team;
  }

  private async callSlackApi<T>(
    integrationId: string,
    endpoint: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    const botToken = await this.slackOauthService.getDecryptedToken(integrationId, 'bot');

    if (!botToken) {
      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        'Bot token not found or could not be decrypted',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const url = new URL(`${this.baseUrl}/${endpoint}`);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      this.logger.error(`Slack API HTTP error: ${response.status} ${response.statusText}`, {
        integrationId,
        endpoint,
        status: response.status,
      });

      if (response.status === 429) {
        throw new ApiError(
          ErrorCode.EXTERNAL_SERVICE_ERROR,
          'Slack API rate limit exceeded',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        `Slack API error: ${response.status} ${response.statusText}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    const data = (await response.json()) as T & { ok: boolean; error?: string };

    if (!data.ok) {
      this.logger.error(`Slack API business logic error: ${data.error}`, {
        integrationId,
        endpoint,
        error: data.error,
      });

      if (data.error === 'invalid_auth' || data.error === 'token_revoked') {
        await this.prisma.integration.update({
          where: { id: integrationId },
          data: { tokenStatus: 'revoked' },
        });

        throw new ApiError(
          ErrorCode.EXTERNAL_SERVICE_ERROR,
          'Slack token is invalid or revoked',
          HttpStatus.UNAUTHORIZED,
        );
      }

      if (data.error === 'ratelimited') {
        throw new ApiError(
          ErrorCode.EXTERNAL_SERVICE_ERROR,
          'Slack API rate limit exceeded',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        `Slack API error: ${data.error}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return data;
  }

  private async updateSyncState(
    integrationId: string,
    updates: {
      lastUsersSyncAt?: Date | null;
      lastChannelsSyncAt?: Date | null;
      errorMsg?: string | null;
    },
  ): Promise<void> {
    await this.prisma.integrationSyncState.upsert({
      where: { integrationId },
      create: {
        integrationId,
        ...updates,
      },
      update: updates,
    });
  }
}
