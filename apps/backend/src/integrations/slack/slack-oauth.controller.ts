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
    oauthUrl.searchParams.set(
      'redirect_uri',
      `${this.configService.get<string>('frontendUrl')}/slack/oauth/callback`,
    );

    // Redirect to Slack
    res.redirect(oauthUrl.toString());
  }

  @Get('callback')
  @SwaggerSlackOAuthCallback()
  async callback(
    @Query() query: SlackOauthCallbackDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

    try {
      // Handle OAuth error from Slack
      if (query.error) {
        this.logger.error(`Slack OAuth error: ${query.error}`);
        return this.renderErrorPage(res, 'OAuth was denied or failed');
      }

      // Exchange code for tokens
      await this.slackOauthService.exchangeCode(query.code, query.state, ipAddress);

      // TODO: Replace HTML rendering with frontend redirect approach
      // Step 1: Instead of rendering HTML here, redirect to frontend with success status:
      // res.redirect(`${this.configService.get<string>('frontendUrl')}/integrations/slack?status=success`);
      // This maintains separation of concerns and allows frontend to handle UI consistently
      // Return success page that auto-closes the modal
      return this.renderSuccessPage(res);
    } catch (error) {
      this.logger.error('OAuth callback error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof ApiError) {
        if (error.getStatus() === HttpStatus.CONFLICT) {
          return this.renderErrorPage(
            res,
            'This Slack workspace is already connected to your organization',
          );
        }
        if (error.getStatus() === HttpStatus.BAD_REQUEST) {
          return this.renderErrorPage(res, 'Invalid or expired authorization request');
        }
        // Handle other ApiError cases with their specific messages
        return this.renderErrorPage(
          res,
          error.message || 'Invalid or expired authorization request',
        );
      }

      // TODO: Replace with frontend redirect for error handling
      // res.redirect(`${this.configService.get<string>('frontendUrl')}/integrations/slack?status=error&message=${encodeURIComponent('An unexpected error occurred during installation')}`);
      return this.renderErrorPage(res, 'An unexpected error occurred during installation');
    }
  }

  private renderSuccessPage(res: Response): void {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>AsyncStand - Installation Complete</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background-color: #f8f9fa;
            }
            .container {
              text-align: center;
              padding: 2rem;
              background: white;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              max-width: 400px;
            }
            .success-icon {
              color: #28a745;
              font-size: 3rem;
              margin-bottom: 1rem;
            }
            h1 {
              color: #2c3e50;
              margin-bottom: 1rem;
              font-size: 1.5rem;
            }
            p {
              color: #6c757d;
              margin-bottom: 1.5rem;
            }
            .close-note {
              font-size: 0.9rem;
              color: #adb5bd;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✓</div>
            <h1>Installation Complete!</h1>
            <p>AsyncStand has been successfully installed to your Slack workspace.</p>
            <p class="close-note">This window will close automatically...</p>
          </div>
          <script>
            // Auto-close the window after 2 seconds
            setTimeout(() => {
              if (window.opener) {
                window.close();
              }
            }, 2000);
          </script>
        </body>
      </html>
    `;

    res.status(HttpStatus.OK).type('text/html').send(html);
  }

  private renderErrorPage(res: Response, message: string): void {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>AsyncStand - Installation Failed</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background-color: #f8f9fa;
            }
            .container {
              text-align: center;
              padding: 2rem;
              background: white;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              max-width: 400px;
            }
            .error-icon {
              color: #dc3545;
              font-size: 3rem;
              margin-bottom: 1rem;
            }
            h1 {
              color: #2c3e50;
              margin-bottom: 1rem;
              font-size: 1.5rem;
            }
            p {
              color: #6c757d;
              margin-bottom: 1.5rem;
            }
            .close-note {
              font-size: 0.9rem;
              color: #adb5bd;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error-icon">✗</div>
            <h1>Installation Failed</h1>
            <p>${message}</p>
            <p class="close-note">Please try again or contact support if the problem persists.</p>
          </div>
          <script>
            // Auto-close the window after 5 seconds
            setTimeout(() => {
              if (window.opener) {
                window.close();
              }
            }, 5000);
          </script>
        </body>
      </html>
    `;

    res.status(HttpStatus.BAD_REQUEST).type('text/html').send(html);
  }
}
