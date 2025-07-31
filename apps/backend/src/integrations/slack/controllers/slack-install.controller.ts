import { Controller, Post, Body } from '@nestjs/common';
import { SlackInstallService } from '@/integrations/slack/services/slack-install.service';
import { LoggerService } from '@/common/logger.service';

interface SlackInstallationPayload {
  team: {
    id: string;
    name: string;
  };
  bot_user_id: string;
  bot_access_token: string;
  app_id: string;
  authed_user: {
    id: string;
  };
}

@Controller('slack')
export class SlackInstallController {
  constructor(
    private readonly slackInstallService: SlackInstallService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(SlackInstallController.name);
  }

  /**
   * Handle direct Slack app installation
   * Called by Slack when someone installs your app from the Slack App Directory
   */
  @Post('install')
  async handleInstallation(@Body() payload: SlackInstallationPayload) {
    this.logger.info(`Handling installation for team ${payload.team.id}`);

    try {
      await this.slackInstallService.handleInstallation({
        teamId: payload.team.id,
        teamName: payload.team.name,
        botToken: payload.bot_access_token,
        botUserId: payload.bot_user_id,
        appId: payload.app_id,
        installerUserId: payload.authed_user.id,
      });

      return {
        success: true,
        message: 'Bot installed successfully! Use /connect command to link to your organization.',
      };
    } catch (error) {
      this.logger.error(
        `Installation failed for team ${payload.team.id}:`,
        error as Record<string, unknown>,
      );
      return {
        success: false,
        error: 'Installation failed',
      };
    }
  }
}
