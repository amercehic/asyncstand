import { Controller, Get, Post, Delete, Param, UseGuards, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '@/auth/guards/roles.guard';
import { CurrentOrg } from '@/auth/decorators/current-org.decorator';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { PrismaService } from '@/prisma/prisma.service';
import { SlackApiService } from '@/integrations/slack/slack-api.service';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { LoggerService } from '@/common/logger.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { AuditActorType, AuditCategory, AuditSeverity, ResourceAction } from '@/common/audit/types';
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
    private readonly logger: LoggerService,
    private readonly auditLogService: AuditLogService,
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
          }
        : undefined,
    }));
  }

  @Post(':id/sync')
  @Roles(OrgRole.admin, OrgRole.owner)
  @SwaggerTriggerSlackSync()
  async triggerSync(
    @Param('id') integrationId: string,
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

    try {
      const result = await this.slackApiService.syncWorkspaceData(integrationId);

      await this.auditLogService.log({
        action: 'integration.slack.manual_sync_triggered',
        orgId,
        actorType: AuditActorType.USER,
        actorUserId: user.userId,
        category: AuditCategory.SYSTEM,
        severity: AuditSeverity.MEDIUM,
        requestData: {
          method: 'POST',
          path: `/slack/integrations/${integrationId}/sync`,
          ipAddress: '127.0.0.1',
          body: { integrationId },
        },
        resources: [
          {
            type: 'integration',
            id: integrationId,
            action: ResourceAction.UPDATED,
          },
        ],
      });

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      await this.auditLogService.log({
        action: 'integration.slack.manual_sync_failed',
        orgId,
        actorType: AuditActorType.USER,
        actorUserId: user.userId,
        category: AuditCategory.SYSTEM,
        severity: AuditSeverity.HIGH,
        requestData: {
          method: 'POST',
          path: `/slack/integrations/${integrationId}/sync`,
          ipAddress: '127.0.0.1',
          body: { integrationId, error: error instanceof Error ? error.message : 'Unknown error' },
        },
        resources: [
          {
            type: 'integration',
            id: integrationId,
            action: ResourceAction.UPDATED,
          },
        ],
      });

      throw error;
    }
  }

  @Delete(':id')
  @Roles(OrgRole.admin, OrgRole.owner)
  @SwaggerRemoveSlackIntegration()
  async removeIntegration(
    @Param('id') integrationId: string,
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

    try {
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

      await this.auditLogService.log({
        action: 'integration.slack.removed',
        orgId,
        actorType: AuditActorType.USER,
        actorUserId: user.userId,
        category: AuditCategory.SYSTEM,
        severity: AuditSeverity.HIGH,
        requestData: {
          method: 'DELETE',
          path: `/slack/integrations/${integrationId}`,
          ipAddress: '127.0.0.1',
          body: { integrationId },
        },
        resources: [
          {
            type: 'integration',
            id: integrationId,
            action: ResourceAction.DELETED,
          },
        ],
      });

      this.logger.info('Slack integration removed successfully', { integrationId, orgId });

      return { success: true };
    } catch (error) {
      await this.auditLogService.log({
        action: 'integration.slack.remove_failed',
        orgId,
        actorType: AuditActorType.USER,
        actorUserId: user.userId,
        category: AuditCategory.SYSTEM,
        severity: AuditSeverity.HIGH,
        requestData: {
          method: 'DELETE',
          path: `/slack/integrations/${integrationId}`,
          ipAddress: '127.0.0.1',
          body: { integrationId, error: error instanceof Error ? error.message : 'Unknown error' },
        },
        resources: [
          {
            type: 'integration',
            id: integrationId,
            action: ResourceAction.DELETED,
          },
        ],
      });

      this.logger.error('Failed to remove Slack integration', {
        integrationId,
        orgId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }
}
