import { Injectable, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { LoggerService } from '@/common/logger.service';
import { RedisService } from '@/common/redis.service';
import { IntegrationPlatform, TokenStatus } from '@prisma/client';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { AuditActorType, AuditCategory, AuditSeverity, ResourceAction } from '@/common/audit/types';
import { SLACK_OAUTH_URLS } from 'shared';

interface SlackOauthResponse {
  ok: boolean;
  access_token: string;
  token_type: string;
  scope: string;
  bot_user_id: string;
  app_id: string;
  team: {
    id: string;
    name: string;
  };
  enterprise?: {
    id: string;
    name: string;
  };
  authed_user: {
    id: string;
    scope: string;
    access_token: string;
    token_type: string;
  };
  refresh_token?: string;
  expires_in?: number;
  error?: string;
}

@Injectable()
export class SlackOauthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
    private readonly redisService: RedisService,
    private readonly auditLogService: AuditLogService,
  ) {
    this.logger.setContext(SlackOauthService.name);
  }

  async exchangeCode(code: string, state: string, ipAddress: string): Promise<{ success: true }> {
    // Validate feature flag
    if (!this.configService.get<boolean>('slackOauthEnabled')) {
      throw new ApiError(ErrorCode.FORBIDDEN, 'Slack OAuth is not enabled', HttpStatus.FORBIDDEN);
    }

    // Validate state parameter
    const orgId = await this.redisService.validateStateToken(state);
    if (!orgId) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        'Invalid or expired state parameter',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Verify organization exists
    const organization = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!organization) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Organization not found', HttpStatus.NOT_FOUND);
    }

    try {
      // Exchange code for tokens
      const oauthResponse = await this.callSlackOauthAccess(code);

      // Check for existing integration (enforce unique constraint)
      const existingIntegration = await this.prisma.integration.findUnique({
        where: {
          orgId_platform_externalTeamId: {
            orgId,
            platform: IntegrationPlatform.slack,
            externalTeamId: oauthResponse.team.id,
          },
        },
      });

      if (existingIntegration) {
        throw new ApiError(
          ErrorCode.CONFLICT,
          'Slack workspace already connected to this organization',
          HttpStatus.CONFLICT,
        );
      }

      // Calculate expiration time
      const expiresAt = oauthResponse.expires_in
        ? new Date(Date.now() + oauthResponse.expires_in * 1000)
        : null;

      // Store integration with encrypted tokens
      const encryptKey = this.configService.get<string>('databaseEncryptKey');

      // Use database-level encryption if key is available
      if (encryptKey) {
        await this.prisma.$executeRaw`
          INSERT INTO "Integration" (
            id, "orgId", platform, "externalTeamId", "accessToken", "botToken", 
            "botUserId", "appId", "refreshToken", "expiresAt", "tokenStatus", scopes
          ) VALUES (
            gen_random_uuid(),
            ${orgId}::uuid,
            ${IntegrationPlatform.slack}::"IntegrationPlatform",
            ${oauthResponse.team.id},
            pgp_sym_encrypt(${oauthResponse.access_token}, ${encryptKey}),
            pgp_sym_encrypt(${oauthResponse.access_token}, ${encryptKey}),
            ${oauthResponse.bot_user_id},
            ${oauthResponse.app_id},
            ${oauthResponse.refresh_token ? `pgp_sym_encrypt('${oauthResponse.refresh_token}', '${encryptKey}')` : null},
            ${expiresAt},
            ${TokenStatus.ok}::"TokenStatus",
            ${oauthResponse.scope.split(',')}
          )
          RETURNING id
        `;
      } else {
        // Fallback to plaintext storage if no encryption key
        this.logger.warn('DATABASE_ENCRYPT_KEY not set, storing tokens in plaintext');
        await this.prisma.integration.create({
          data: {
            orgId,
            platform: IntegrationPlatform.slack,
            externalTeamId: oauthResponse.team.id,
            accessToken: oauthResponse.access_token,
            botToken: oauthResponse.access_token,
            botUserId: oauthResponse.bot_user_id,
            appId: oauthResponse.app_id,
            refreshToken: oauthResponse.refresh_token,
            expiresAt,
            tokenStatus: TokenStatus.ok,
            scopes: oauthResponse.scope.split(','),
          },
        });
      }

      // Get the created integration for audit logging
      const integration = await this.prisma.integration.findUnique({
        where: {
          orgId_platform_externalTeamId: {
            orgId,
            platform: IntegrationPlatform.slack,
            externalTeamId: oauthResponse.team.id,
          },
        },
      });

      // Log successful installation
      await this.auditLogService.log({
        action: 'integration.slack.installed',
        orgId,
        actorType: AuditActorType.SYSTEM,
        category: AuditCategory.SYSTEM,
        severity: AuditSeverity.MEDIUM,
        requestData: {
          method: 'GET',
          path: '/slack/oauth/callback',
          ipAddress,
          body: {
            teamId: oauthResponse.team.id,
            teamName: oauthResponse.team.name,
            appId: oauthResponse.app_id,
            botUserId: oauthResponse.bot_user_id,
            scopes: oauthResponse.scope.split(','),
          },
        },
        resources: [
          {
            type: 'integration',
            id: integration.id,
            action: ResourceAction.CREATED,
          },
        ],
      });

      return { success: true };
    } catch (error) {
      // Log failed installation
      await this.auditLogService.log({
        action: 'integration.slack.install_failed',
        orgId,
        actorType: AuditActorType.SYSTEM,
        category: AuditCategory.SYSTEM,
        severity: AuditSeverity.HIGH,
        requestData: {
          method: 'GET',
          path: '/slack/oauth/callback',
          ipAddress,
          body: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        },
      });

      throw error;
    }
  }

  private async callSlackOauthAccess(code: string): Promise<SlackOauthResponse> {
    const clientId = this.configService.get<string>('slackClientId');
    const clientSecret = this.configService.get<string>('slackClientSecret');

    if (!clientId || !clientSecret) {
      throw new ApiError(
        ErrorCode.CONFIGURATION_ERROR,
        'Slack OAuth credentials not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const response = await fetch(SLACK_OAUTH_URLS.ACCESS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    if (!response.ok) {
      this.logger.error(`Slack OAuth API error: ${response.status} ${response.statusText}`);
      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        'Failed to exchange code with Slack',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const data = (await response.json()) as SlackOauthResponse;

    if (!data.ok) {
      this.logger.error(`Slack OAuth exchange failed: ${data.error}`);
      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        `Slack OAuth error: ${data.error}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return data;
  }

  async getDecryptedToken(
    integrationId: string,
    tokenType: 'access' | 'bot' | 'refresh',
  ): Promise<string | null> {
    const encryptKey = this.configService.get<string>('databaseEncryptKey');

    if (!encryptKey) {
      // Fallback to plaintext tokens
      const integration = await this.prisma.integration.findUnique({
        where: { id: integrationId },
        select: {
          accessToken: tokenType === 'access',
          botToken: tokenType === 'bot',
          refreshToken: tokenType === 'refresh',
        },
      });

      if (!integration) return null;

      switch (tokenType) {
        case 'access':
          return integration.accessToken;
        case 'bot':
          return integration.botToken;
        case 'refresh':
          return integration.refreshToken;
        default:
          return null;
      }
    }

    // Decrypt from database using $queryRawUnsafe to avoid parameter binding issues
    let query: string;
    if (tokenType === 'access') {
      query = `
        SELECT pgp_sym_decrypt("accessToken"::bytea, $1) as decrypted
        FROM "Integration" 
        WHERE id = '${integrationId}'
      `;
    } else if (tokenType === 'bot') {
      query = `
        SELECT pgp_sym_decrypt("botToken"::bytea, $1) as decrypted
        FROM "Integration" 
        WHERE id = '${integrationId}'
      `;
    } else {
      query = `
        SELECT pgp_sym_decrypt("refreshToken"::bytea, $1) as decrypted
        FROM "Integration" 
        WHERE id = '${integrationId}'
      `;
    }

    const result = await this.prisma.$queryRawUnsafe<Array<{ decrypted: string | null }>>(
      query,
      encryptKey,
    );

    return result[0]?.decrypted || null;
  }
}
