import { Controller, Get, Query, Res, Req, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { SlackOauthService } from '@/integrations/slack/slack-oauth.service';
import { SlackOauthCallbackDto } from '@/integrations/slack/dto/oauth-callback.dto';
import { ApiError } from '@/common/api-error';
import { LoggerService } from '@/common/logger.service';
import { RedisService } from '@/common/redis.service';
import { ConfigService } from '@nestjs/config';
import { SLACK_OAUTH_URLS } from 'shared';
import {
  SwaggerSlackOAuthStart,
  SwaggerSlackOAuthCallback,
} from '@/swagger/slack-integration.swagger';
import { Audit } from '@/common/audit/audit.decorator';
import { getClientIp } from '@/common/http/ip.util';
import { AuditCategory, AuditSeverity } from '@/common/audit/types';

@ApiTags('Slack OAuth')
@Controller('slack/oauth')
export class SlackOauthController {
  constructor(
    private readonly slackOauthService: SlackOauthService,
    private readonly logger: LoggerService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.logger.setContext(SlackOauthController.name);
    
    // Debug: Log the frontend URL configuration at startup
    const frontendUrl = this.configService.get<string>('frontendUrl');
    this.logger.debug(`SlackOauthController initialized with frontendUrl: ${frontendUrl}`);
  }

  @Get('start')
  @SwaggerSlackOAuthStart()
  async start(@Query('orgId') orgId: string, @Res() res: Response): Promise<void> {
    if (!orgId) {
      res.status(HttpStatus.BAD_REQUEST).json({ error: 'orgId query parameter is required' });
      return;
    }

    const clientId = this.configService.get<string>('slackClientId');
    const oauthEnabled = this.configService.get<boolean>('slackOauthEnabled');

    this.logger.debug(`OAuth config check - clientId: ${clientId}, oauthEnabled: ${oauthEnabled}`);

    if (!clientId) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Slack OAuth not configured' });
      return;
    }

    // Generate state token
    const state = await this.redisService.generateStateToken(orgId);

    // Build OAuth URL - using v2 OAuth flow
    const oauthUrl = new URL(SLACK_OAUTH_URLS.AUTHORIZE);
    oauthUrl.searchParams.set('client_id', clientId);
    // User scopes for the installing user
    oauthUrl.searchParams.set('user_scope', 'identity.basic');
    // Bot scopes for the bot token
    oauthUrl.searchParams.set('scope', 'channels:read,groups:read,users:read,chat:write');
    oauthUrl.searchParams.set('state', state);
    // Use backend URL for OAuth callback since the callback endpoint is on the backend
    const backendUrl =
      this.configService.get<string>('ngrokUrl') ||
      this.configService.get<string>('appUrl') ||
      'http://localhost:3001';
    oauthUrl.searchParams.set('redirect_uri', `${backendUrl}/slack/oauth/callback`);

    // Redirect to Slack
    res.redirect(oauthUrl.toString());
  }

  @Get('callback')
  @SwaggerSlackOAuthCallback()
  @Audit({
    action: 'integration.slack.oauth_callback',
    category: AuditCategory.INTEGRATION,
    severity: AuditSeverity.MEDIUM,
  })
  async callback(
    @Query() query: SlackOauthCallbackDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const ipAddress = getClientIp(req);

    try {
      // Handle OAuth error from Slack
      if (query.error) {
        this.logger.error(`Slack OAuth error: ${query.error} - ${query.error_description}`);
        const frontendUrl =
          this.configService.get<string>('frontendUrl') || 'http://localhost:3000';
        const errorMessage =
          query.error === 'access_denied'
            ? 'OAuth was cancelled by user'
            : 'OAuth was denied or failed';
        return res.redirect(
          `${frontendUrl}/integrations?status=error&message=${encodeURIComponent(errorMessage)}`,
        );
      }

      // Ensure we have a code to exchange
      if (!query.code) {
        this.logger.error('OAuth callback missing authorization code');
        const frontendUrl =
          this.configService.get<string>('frontendUrl') || 'http://localhost:3000';
        const errorMessage = 'Invalid OAuth callback - missing authorization code';
        return res.redirect(
          `${frontendUrl}/integrations?status=error&message=${encodeURIComponent(errorMessage)}`,
        );
      }

      // Exchange code for tokens
      await this.slackOauthService.exchangeCode(query.code, query.state, ipAddress);

      // Redirect to frontend with success status
      const frontendUrl = this.configService.get<string>('frontendUrl') || 'http://localhost:3000';
      this.logger.debug(`OAuth success redirect URL: ${frontendUrl}/integrations?status=success`);
      return res.redirect(`${frontendUrl}/integrations?status=success`);
    } catch (error) {
      this.logger.error('OAuth callback error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      const frontendUrl = this.configService.get<string>('frontendUrl') || 'http://localhost:3000';
      this.logger.debug(`OAuth error redirect URL: ${frontendUrl}/integrations?status=error`);

      if (error instanceof ApiError) {
        let errorMessage: string;

        if (error.getStatus() === HttpStatus.CONFLICT) {
          errorMessage = 'This Slack workspace is already connected to your organization';
        } else if (error.getStatus() === HttpStatus.BAD_REQUEST) {
          errorMessage = 'Invalid or expired authorization request';
        } else {
          errorMessage = error.message || 'Invalid or expired authorization request';
        }

        return res.redirect(
          `${frontendUrl}/integrations?status=error&message=${encodeURIComponent(errorMessage)}`,
        );
      }

      // Redirect to frontend with error status
      const errorMessage = 'An unexpected error occurred during installation';
      this.logger.debug(`OAuth unexpected error redirect URL: ${frontendUrl}/integrations?status=error`);
      return res.redirect(
        `${frontendUrl}/integrations?status=error&message=${encodeURIComponent(errorMessage)}`,
      );
    }
  }
}
