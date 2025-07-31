import { Controller, Post, Body } from '@nestjs/common';
import { SlackInstallService } from '@/integrations/slack/services/slack-install.service';
import { LoggerService } from '@/common/logger.service';

interface SlackCommandPayload {
  token: string;
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  command: string;
  text: string;
  response_url: string;
  trigger_id: string;
}

@Controller('slack/commands')
export class SlackCommandsController {
  constructor(
    private readonly slackInstallService: SlackInstallService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(SlackCommandsController.name);
  }

  /**
   * Handle /connect slash command to link Slack team to AsyncStand organization
   */
  @Post('connect')
  async handleConnectCommand(@Body() payload: SlackCommandPayload) {
    this.logger.info(`Connect command from team ${payload.team_id}, user ${payload.user_id}`);

    const orgId = payload.text.trim();

    if (!orgId) {
      return {
        response_type: 'ephemeral',
        text: '❌ Please provide an organization ID. Usage: `/asyncstand-connect your-org-id`',
      };
    }

    try {
      const result = await this.slackInstallService.linkToOrganization(payload.team_id, orgId);

      if (result.success) {
        return {
          response_type: 'ephemeral',
          text: `✅ Successfully connected this Slack workspace to organization ${orgId}! AsyncStand is now active.`,
        };
      } else {
        return {
          response_type: 'ephemeral',
          text: `❌ ${result.error}`,
        };
      }
    } catch (error) {
      this.logger.error(`Connect command failed:`, error as Record<string, unknown>);
      return {
        response_type: 'ephemeral',
        text: '❌ Failed to connect to organization. Please try again or contact support.',
      };
    }
  }

  /**
   * Handle /disconnect slash command to unlink Slack team from AsyncStand organization
   */
  @Post('disconnect')
  async handleDisconnectCommand(@Body() payload: SlackCommandPayload) {
    this.logger.info(`Disconnect command from team ${payload.team_id}, user ${payload.user_id}`);

    try {
      await this.slackInstallService.unlinkFromOrganization(payload.team_id);

      return {
        response_type: 'ephemeral',
        text: '✅ Successfully disconnected this Slack workspace from AsyncStand.',
      };
    } catch (error) {
      this.logger.error(`Disconnect command failed:`, error as Record<string, unknown>);
      return {
        response_type: 'ephemeral',
        text: '❌ Failed to disconnect. Please try again or contact support.',
      };
    }
  }

  /**
   * Handle /status slash command to show connection status
   */
  @Post('status')
  async handleStatusCommand(@Body() payload: SlackCommandPayload) {
    this.logger.info(`Status command from team ${payload.team_id}, user ${payload.user_id}`);

    try {
      const status = await this.slackInstallService.getConnectionStatus(payload.team_id);

      if (status.connected) {
        return {
          response_type: 'ephemeral',
          text: `✅ Connected to organization: ${status.orgId}\\n🤖 Bot active and processing standups`,
        };
      } else {
        return {
          response_type: 'ephemeral',
          text: '❌ Not connected to any organization.\\nUse `/asyncstand-connect your-org-id` to link this workspace.',
        };
      }
    } catch (error) {
      this.logger.error(`Status command failed:`, error as Record<string, unknown>);
      return {
        response_type: 'ephemeral',
        text: '❌ Failed to check status. Please try again.',
      };
    }
  }
}
