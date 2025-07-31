import { Controller, Get, Query, Redirect, Param } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SlackInstallService } from '@/integrations/slack/services/slack-install.service';
import { LoggerService } from '@/common/logger.service';

interface SlackOAuthTokenResponse {
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
  authed_user: {
    id: string;
  };
  error?: string;
}

@Controller('slack/oauth')
export class SlackOAuthController {
  constructor(
    private readonly configService: ConfigService,
    private readonly slackInstallService: SlackInstallService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(SlackOAuthController.name);
  }

  /**
   * Initiate OAuth flow from AsyncStand dashboard
   * GET /slack/oauth/connect/:orgId
   */
  @Get('connect/:orgId')
  @Redirect()
  async initiateOAuth(@Param('orgId') orgId: string) {
    this.logger.info(`Initiating OAuth for organization: ${orgId}`);

    const clientId = this.configService.get<string>('slackClientId');
    const baseUrl = this.configService.get<string>('frontendUrl');
    const redirectUri = `${baseUrl}/slack/oauth/callback`;

    // Include orgId in state parameter for automatic linking after OAuth
    const state = Buffer.from(JSON.stringify({ orgId, timestamp: Date.now() })).toString('base64');

    const scopes = [
      'chat:write',
      'channels:read',
      'channels:history',
      'users:read',
      'commands',
      'app_mentions:read',
      'im:history',
      'groups:history',
    ].join(',');

    const oauthUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    return { url: oauthUrl };
  }

  /**
   * Handle OAuth callback and automatically link to organization
   * GET /slack/oauth/callback
   */
  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error?: string,
  ) {
    if (error) {
      this.logger.error(`OAuth error: ${error}`);
      return {
        success: false,
        error: 'OAuth authorization failed',
        redirectUrl: `${this.configService.get<string>('frontendUrl')}/integrations?error=oauth_failed`,
      };
    }

    if (!code || !state) {
      this.logger.error('Missing code or state parameter');
      return {
        success: false,
        error: 'Invalid OAuth callback',
        redirectUrl: `${this.configService.get<string>('frontendUrl')}/integrations?error=invalid_callback`,
      };
    }

    try {
      // Decode state to get orgId
      const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
      const { orgId } = decodedState;

      this.logger.info(`Processing OAuth callback for organization: ${orgId}`);

      const baseUrl = this.configService.get<string>('frontendUrl');

      // Exchange code for tokens
      const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.configService.get<string>('slackClientId')!,
          client_secret: this.configService.get<string>('slackClientSecret')!,
          code,
          redirect_uri: `${baseUrl}/slack/oauth/callback`,
        }),
      });

      const tokenData = (await tokenResponse.json()) as SlackOAuthTokenResponse;

      if (!tokenData.ok) {
        this.logger.error(
          'Token exchange failed:',
          tokenData as unknown as Record<string, unknown>,
        );
        return {
          success: false,
          error: tokenData.error || 'Token exchange failed',
          redirectUrl: `${this.configService.get<string>('frontendUrl')}/integrations?error=token_failed`,
        };
      }

      // Install and automatically link to organization
      await this.slackInstallService.handleInstallation({
        teamId: tokenData.team.id,
        teamName: tokenData.team.name,
        botToken: tokenData.access_token,
        botUserId: tokenData.bot_user_id,
        appId: tokenData.app_id,
        installerUserId: tokenData.authed_user.id,
        orgId, // Automatically link to the organization
      });

      this.logger.info(
        `Successfully connected Slack workspace ${tokenData.team.name} to organization ${orgId}`,
      );

      return {
        success: true,
        message: `Successfully connected Slack workspace "${tokenData.team.name}" to your organization`,
        redirectUrl: `${this.configService.get<string>('frontendUrl')}/integrations?success=slack_connected&team=${encodeURIComponent(tokenData.team.name)}`,
      };
    } catch (error) {
      this.logger.error('OAuth callback failed:', error as Record<string, unknown>);
      return {
        success: false,
        error: 'Failed to process OAuth callback',
        redirectUrl: `${this.configService.get<string>('frontendUrl')}/integrations?error=processing_failed`,
      };
    }
  }
}
