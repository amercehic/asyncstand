import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  HttpStatus,
  ParseUUIDPipe,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '@/auth/guards/roles.guard';
import { CurrentOrg } from '@/auth/decorators/current-org.decorator';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { PrismaService } from '@/prisma/prisma.service';
import { SlackApiService } from '@/integrations/slack/slack-api.service';
import { SlackMessagingService } from '@/integrations/slack/slack-messaging.service';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { LoggerService } from '@/common/logger.service';
import { Audit } from '@/common/audit/audit.decorator';
import { AuditCategory, AuditSeverity } from '@/common/audit/types';
import { OrgRole } from '@prisma/client';
import {
  SwaggerListSlackIntegrations,
  SwaggerTriggerSlackSync,
  SwaggerRemoveSlackIntegration,
} from '@/swagger/slack-integration.swagger';

interface AuthenticatedUser {
  userId: string;
  orgId: string;
  role: string;
}

interface SlackIntegrationListResponse {
  id: string;
  externalTeamId: string;
  tokenStatus: string;
  scopes: string[];
  installedAt: string;
  syncState?: {
    lastUsersSyncAt?: string;
    lastChannelsSyncAt?: string;
    errorMsg?: string;
    userCount?: number;
    channelCount?: number;
  };
}

interface SlackSyncResponse {
  success: boolean;
  usersAdded: number;
  usersUpdated: number;
  channelsAdded: number;
  channelsUpdated: number;
  errors: string[];
}

@ApiTags('Slack Integration')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('slack/integrations')
export class SlackIntegrationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly slackApiService: SlackApiService,
    private readonly slackMessaging: SlackMessagingService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(SlackIntegrationController.name);
  }

  @Get()
  @Roles(OrgRole.admin, OrgRole.owner)
  @SwaggerListSlackIntegrations()
  async listIntegrations(@CurrentOrg() orgId: string): Promise<SlackIntegrationListResponse[]> {
    this.logger.info('Listing Slack integrations', { orgId });

    const integrations = await this.prisma.integration.findMany({
      where: {
        orgId,
        platform: 'slack',
      },
      include: {
        syncState: true,
        channels: {
          where: {
            isArchived: false,
          },
        },
        integrationUsers: {
          where: {
            isDeleted: false,
            isBot: false,
          },
        },
      },
      orderBy: [{ id: 'desc' }],
    });

    return integrations.map((integration) => ({
      id: integration.id,
      externalTeamId: integration.externalTeamId,
      tokenStatus: integration.tokenStatus as string,
      scopes: integration.scopes,
      installedAt: new Date().toISOString(), // Integration doesn't have createdAt field
      syncState: integration.syncState
        ? {
            lastUsersSyncAt: integration.syncState.lastUsersSyncAt?.toISOString(),
            lastChannelsSyncAt: integration.syncState.lastChannelsSyncAt?.toISOString(),
            errorMsg: integration.syncState.errorMsg,
            userCount: integration.integrationUsers.length,
            channelCount: integration.channels.length,
          }
        : {
            userCount: integration.integrationUsers.length,
            channelCount: integration.channels.length,
          },
    }));
  }

  @Post(':id/sync')
  @Roles(OrgRole.admin, OrgRole.owner)
  @SwaggerTriggerSlackSync()
  @Audit({
    action: 'integration.slack.manual_sync_triggered',
    resourcesFromRequest: (req) => [{ type: 'integration', id: req.params.id, action: 'UPDATED' }],
    category: AuditCategory.SYSTEM,
    severity: AuditSeverity.MEDIUM,
  })
  async triggerSync(
    @Param('id', ParseUUIDPipe) integrationId: string,
    @CurrentOrg() orgId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SlackSyncResponse> {
    this.logger.info('Triggering manual Slack sync', { integrationId, orgId, userId: user.userId });

    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Integration not found', HttpStatus.NOT_FOUND);
    }

    if (integration.orgId !== orgId) {
      throw new ApiError(
        ErrorCode.FORBIDDEN,
        'Integration belongs to different organization',
        HttpStatus.FORBIDDEN,
      );
    }

    if (integration.platform !== 'slack') {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        'Integration is not a Slack integration',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (integration.tokenStatus !== 'ok') {
      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        'Integration token is not valid',
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await this.slackApiService.syncWorkspaceData(integrationId);

    return {
      success: true,
      ...result,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(OrgRole.admin, OrgRole.owner)
  @SwaggerRemoveSlackIntegration()
  @Audit({
    action: 'integration.slack.removed',
    resourcesFromRequest: (req) => [{ type: 'integration', id: req.params.id, action: 'DELETED' }],
    category: AuditCategory.SYSTEM,
    severity: AuditSeverity.HIGH,
  })
  async removeIntegration(
    @Param('id', ParseUUIDPipe) integrationId: string,
    @CurrentOrg() orgId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean }> {
    this.logger.info('Removing Slack integration', { integrationId, orgId, userId: user.userId });

    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId },
      include: {
        teams: {
          include: {
            members: true,
            configs: true,
            instances: true,
          },
        },
        syncState: true,
      },
    });

    if (!integration) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Integration not found', HttpStatus.NOT_FOUND);
    }

    if (integration.orgId !== orgId) {
      throw new ApiError(
        ErrorCode.FORBIDDEN,
        'Integration belongs to different organization',
        HttpStatus.FORBIDDEN,
      );
    }

    if (integration.platform !== 'slack') {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        'Integration is not a Slack integration',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (integration.syncState) {
        await tx.integrationSyncState.delete({
          where: { integrationId },
        });
      }

      for (const team of integration.teams) {
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
          where: { teamId: team.id },
        });

        for (const config of team.configs) {
          await tx.standupConfigMember.deleteMany({
            where: { standupConfigId: config.id },
          });
        }

        await tx.standupConfig.deleteMany({
          where: { teamId: team.id },
        });

        await tx.teamMember.deleteMany({
          where: { teamId: team.id },
        });
      }

      await tx.team.deleteMany({
        where: { integrationId },
      });

      await tx.tokenRefreshJob.deleteMany({
        where: { integrationId },
      });

      await tx.integration.delete({
        where: { id: integrationId },
      });
    });

    this.logger.info('Slack integration removed successfully', { integrationId, orgId });

    return { success: true };
  }

  @Post(':id/test-dm')
  async testDirectMessage(
    @Param('id') integrationId: string,
    @CurrentOrg() orgId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean; error?: string; details?: unknown }> {
    this.logger.info('Testing Slack DM capability', { integrationId, orgId, userId: user.userId });

    try {
      // Get integration
      const integration = await this.prisma.integration.findFirst({
        where: { id: integrationId, orgId },
        include: {
          teams: {
            include: {
              members: {
                where: { active: true },
                take: 1,
              },
            },
            take: 1,
          },
        },
      });

      if (!integration) {
        throw new ApiError(ErrorCode.NOT_FOUND, 'Integration not found', HttpStatus.NOT_FOUND);
      }

      const team = integration.teams[0];
      const member = team?.members[0];

      if (!member) {
        return {
          success: false,
          error: 'No active team members found',
        };
      }

      // Test sending a DM
      const result = await this.slackMessaging.sendDirectMessage(
        integrationId,
        member.platformUserId,
        `Test message from AsyncStand! If you see this, DMs are working correctly. 🎉\n\nMember: ${member.name}\nTeam: ${team.name}`,
      );

      return {
        success: result.ok,
        error: result.error,
        details: {
          memberId: member.id,
          memberName: member.name,
          platformUserId: member.platformUserId,
          teamName: team.name,
          messageTs: result.ts,
        },
      };
    } catch (error) {
      this.logger.error('Failed to test Slack DM', {
        integrationId,
        orgId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
