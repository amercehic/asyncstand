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
    const frontendUrl = this.configService.get<string>('frontendUrl') || 'http://localhost:3000';
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>AsyncStand - Installation Complete</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
          <style>
            :root {
              --bg-main: #0f1117;
              --bg-surface: #1c1f26;
              --text-main: #f9fafb;
              --text-dim: #9ca3af;
              --primary-start: #6366f1;
              --primary-end: #8b5cf6;
              --secondary: #10b981;
              --border: rgba(255, 255, 255, 0.12);
            }
            
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
              background: var(--bg-main);
              color: var(--text-main);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 1rem;
              overflow: hidden;
            }
            
            .container {
              background: var(--bg-surface);
              border: 1px solid var(--border);
              border-radius: 24px;
              padding: 3rem 2rem;
              text-align: center;
              max-width: 480px;
              width: 100%;
              backdrop-filter: blur(12px);
              box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
              animation: slideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            
            @keyframes slideIn {
              from {
                opacity: 0;
                transform: translateY(30px) scale(0.95);
              }
              to {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
            
            .success-icon {
              width: 80px;
              height: 80px;
              background: linear-gradient(135deg, var(--secondary), #059669);
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 2rem;
              animation: bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) 0.2s both;
            }
            
            @keyframes bounceIn {
              from {
                opacity: 0;
                transform: scale(0);
              }
              to {
                opacity: 1;
                transform: scale(1);
              }
            }
            
            .checkmark {
              width: 28px;
              height: 28px;
              stroke: white;
              stroke-width: 3;
              stroke-linecap: round;
              stroke-linejoin: round;
              fill: none;
              animation: drawCheck 0.8s ease-in-out 0.4s both;
              stroke-dasharray: 30;
              stroke-dashoffset: 30;
            }
            
            @keyframes drawCheck {
              to {
                stroke-dashoffset: 0;
              }
            }
            
            h1 {
              font-size: 2rem;
              font-weight: 700;
              margin-bottom: 1rem;
              background: linear-gradient(135deg, var(--text-main), var(--text-dim));
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
              animation: fadeInUp 0.5s ease-out 0.3s both;
            }
            
            .subtitle {
              font-size: 1.125rem;
              color: var(--text-dim);
              margin-bottom: 2rem;
              line-height: 1.6;
              animation: fadeInUp 0.5s ease-out 0.4s both;
            }
            
            .close-note {
              font-size: 0.875rem;
              color: var(--text-dim);
              opacity: 0.7;
              animation: fadeInUp 0.5s ease-out 0.5s both;
            }
            
            @keyframes fadeInUp {
              from {
                opacity: 0;
                transform: translateY(20px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
            
            .pulse-dot {
              display: inline-block;
              width: 4px;
              height: 4px;
              background: var(--secondary);
              border-radius: 50%;
              margin: 0 2px;
              animation: pulse 1.4s infinite ease-in-out both;
            }
            
            .pulse-dot:nth-child(1) { animation-delay: -0.32s; }
            .pulse-dot:nth-child(2) { animation-delay: -0.16s; }
            .pulse-dot:nth-child(3) { animation-delay: 0s; }
            
            @keyframes pulse {
              0%, 80%, 100% { 
                transform: scale(0);
                opacity: 0.5;
              }
              40% { 
                transform: scale(1);
                opacity: 1;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">
              <svg class="checkmark" viewBox="0 0 24 24">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
            <h1>Installation Complete!</h1>
            <p class="subtitle">AsyncStand has been successfully connected to your Slack workspace.</p>
            <p class="close-note">
              This window will close automatically
              <span class="pulse-dot"></span>
              <span class="pulse-dot"></span>
              <span class="pulse-dot"></span>
            </p>
          </div>
          <script>
            console.log('[OAuth Callback] Page loaded');
            console.log('[OAuth Callback] Window opener exists:', !!window.opener);
            console.log('[OAuth Callback] Target origin:', '${frontendUrl}');
            
            // Notify parent window of success
            if (window.opener) {
              try {
                const message = {
                  type: 'slack-oauth-callback',
                  success: true,
                  message: 'Integration completed successfully'
                };
                console.log('[OAuth Callback] Sending message:', message);
                // Use wildcard to ensure delivery regardless of exact dev/prod origin; parent filters it
                window.opener.postMessage(message, '*');
                console.log('[OAuth Callback] Message sent successfully');
              } catch (error) {
                console.error('[OAuth Callback] Error sending message:', error);
              }
            } else {
              console.error('[OAuth Callback] No window.opener found!');
            }
            
            // Auto-close the window after 2.5 seconds
            setTimeout(() => {
              console.log('[OAuth Callback] Closing window');
              if (window.opener) {
                window.close();
              }
            }, 2500);
          </script>
        </body>
      </html>
    `;

    res.status(HttpStatus.OK).type('text/html').send(html);
  }

  private renderErrorPage(res: Response, message: string): void {
    const frontendUrl = this.configService.get<string>('frontendUrl') || 'http://localhost:3000';
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>AsyncStand - Installation Failed</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet>
          <style>
            :root {
              --bg-main: #0f1117;
              --bg-surface: #1c1f26;
              --text-main: #f9fafb;
              --text-dim: #9ca3af;
              --error: #ef4444;
              --border: rgba(255, 255, 255, 0.12);
            }
            
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
              background: var(--bg-main);
              color: var(--text-main);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 1rem;
              overflow: hidden;
            }
            
            .container {
              background: var(--bg-surface);
              border: 1px solid var(--border);
              border-radius: 24px;
              padding: 3rem 2rem;
              text-align: center;
              max-width: 480px;
              width: 100%;
              backdrop-filter: blur(12px);
              box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
              animation: slideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            
            @keyframes slideIn {
              from {
                opacity: 0;
                transform: translateY(30px) scale(0.95);
              }
              to {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
            
            .error-icon {
              width: 80px;
              height: 80px;
              background: linear-gradient(135deg, var(--error), #dc2626);
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 2rem;
              animation: shakeIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) 0.2s both;
            }
            
            @keyframes shakeIn {
              0% {
                opacity: 0;
                transform: scale(0) rotate(-10deg);
              }
              50% {
                transform: scale(1.1) rotate(5deg);
              }
              100% {
                opacity: 1;
                transform: scale(1) rotate(0deg);
              }
            }
            
            .error-x {
              width: 28px;
              height: 28px;
              stroke: white;
              stroke-width: 3;
              stroke-linecap: round;
              stroke-linejoin: round;
              fill: none;
              animation: drawX 0.8s ease-in-out 0.4s both;
              stroke-dasharray: 20;
              stroke-dashoffset: 20;
            }
            
            @keyframes drawX {
              to {
                stroke-dashoffset: 0;
              }
            }
            
            h1 {
              font-size: 2rem;
              font-weight: 700;
              margin-bottom: 1rem;
              background: linear-gradient(135deg, var(--text-main), var(--text-dim));
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
              animation: fadeInUp 0.5s ease-out 0.3s both;
            }
            
            .subtitle {
              font-size: 1.125rem;
              color: var(--text-dim);
              margin-bottom: 1.5rem;
              line-height: 1.6;
              animation: fadeInUp 0.5s ease-out 0.4s both;
            }
            
            .close-note {
              font-size: 0.875rem;
              color: var(--text-dim);
              opacity: 0.7;
              animation: fadeInUp 0.5s ease-out 0.5s both;
            }
            
            @keyframes fadeInUp {
              from {
                opacity: 0;
                transform: translateY(20px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
            
            .pulse-dot {
              display: inline-block;
              width: 4px;
              height: 4px;
              background: var(--error);
              border-radius: 50%;
              margin: 0 2px;
              animation: pulse 1.4s infinite ease-in-out both;
            }
            
            .pulse-dot:nth-child(1) { animation-delay: -0.32s; }
            .pulse-dot:nth-child(2) { animation-delay: -0.16s; }
            .pulse-dot:nth-child(3) { animation-delay: 0s; }
            
            @keyframes pulse {
              0%, 80%, 100% { 
                transform: scale(0);
                opacity: 0.5;
              }
              40% { 
                transform: scale(1);
                opacity: 1;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error-icon">
              <svg class="error-x" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </div>
            <h1>Installation Failed</h1>
            <p class="subtitle">${message}</p>
            <p class="close-note">
              Please try again or contact support if the problem persists
              <span class="pulse-dot"></span>
              <span class="pulse-dot"></span>
              <span class="pulse-dot"></span>
            </p>
          </div>
          <script>
            console.log('[OAuth Error Callback] Page loaded');
            console.log('[OAuth Error Callback] Window opener exists:', !!window.opener);
            console.log('[OAuth Error Callback] Target origin:', '${frontendUrl}');
            
            // Notify parent window of error
            if (window.opener) {
              try {
                const message = {
                  type: 'slack-oauth-callback',
                  success: false,
                  message: '${message.replace(/'/g, "\\'")}'
                };
                console.log('[OAuth Error Callback] Sending message:', message);
                // Use wildcard to ensure delivery regardless of exact dev/prod origin; parent filters it
                window.opener.postMessage(message, '*');
                console.log('[OAuth Error Callback] Message sent successfully');
              } catch (error) {
                console.error('[OAuth Error Callback] Error sending message:', error);
              }
            } else {
              console.error('[OAuth Error Callback] No window.opener found!');
            }
            
            // Auto-close the window after 5 seconds
            setTimeout(() => {
              console.log('[OAuth Error Callback] Closing window');
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
