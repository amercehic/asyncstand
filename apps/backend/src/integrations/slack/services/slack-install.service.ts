import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { IntegrationPlatform, TokenStatus } from '@prisma/client';
import { LoggerService } from '@/common/logger.service';

interface SlackInstallationData {
  teamId: string;
  teamName: string;
  botToken: string;
  botUserId: string;
  appId: string;
  installerUserId: string;
  orgId?: string; // Optional: for dashboard-initiated OAuth
}

interface ConnectionResult {
  success: boolean;
  error?: string;
}

interface ConnectionStatus {
  connected: boolean;
  orgId?: string;
}

@Injectable()
export class SlackInstallService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(SlackInstallService.name);
  }

  async handleInstallation(data: SlackInstallationData): Promise<void> {
    this.logger.info(`Installing bot for Slack team: ${data.teamName} (${data.teamId})`);

    // Create or update integration
    await this.prisma.integration.upsert({
      where: {
        platform_externalTeamId: {
          platform: IntegrationPlatform.slack,
          externalTeamId: data.teamId,
        },
      },
      create: {
        // Create new installation
        platform: IntegrationPlatform.slack,
        externalTeamId: data.teamId,
        botToken: data.botToken,
        botUserId: data.botUserId,
        appId: data.appId,
        accessToken: data.botToken, // For compatibility
        tokenStatus: TokenStatus.ok,
        scopes: ['chat:write', 'channels:read', 'users:read'], // Default scopes
        installedByUserId: null, // Will be set when linked to org
        orgId: data.orgId || null, // Link immediately if orgId provided
      },
      update: {
        // Update existing installation
        botToken: data.botToken,
        botUserId: data.botUserId,
        appId: data.appId,
        accessToken: data.botToken,
        tokenStatus: TokenStatus.ok,
        // Update orgId if provided, otherwise keep existing
        orgId: data.orgId || undefined,
      },
    });

    this.logger.info(
      `Successfully installed bot for team ${data.teamId}${data.orgId ? ` and linked to org ${data.orgId}` : ''}`,
    );

    // Send welcome message to the installer
    await this.sendWelcomeMessage(data.botToken, data.installerUserId, !!data.orgId);
  }

  /**
   * Link an installed Slack workspace to an AsyncStand organization
   */
  async linkToOrganization(teamId: string, orgId: string): Promise<ConnectionResult> {
    try {
      // Verify organization exists
      const organization = await this.prisma.organization.findUnique({
        where: { id: orgId },
      });

      if (!organization) {
        return {
          success: false,
          error: 'Organization not found. Please check the organization ID.',
        };
      }

      // Check if integration exists
      const integration = await this.prisma.integration.findUnique({
        where: {
          platform_externalTeamId: {
            platform: IntegrationPlatform.slack,
            externalTeamId: teamId,
          },
        },
      });

      if (!integration) {
        return {
          success: false,
          error: 'Bot not installed in this workspace. Please install the bot first.',
        };
      }

      if (integration.orgId && integration.orgId !== orgId) {
        return {
          success: false,
          error:
            'This workspace is already connected to a different organization. Use /disconnect first.',
        };
      }

      // Link the integration to the organization
      await this.prisma.integration.update({
        where: {
          platform_externalTeamId: {
            platform: IntegrationPlatform.slack,
            externalTeamId: teamId,
          },
        },
        data: {
          orgId,
        },
      });

      this.logger.info(`Linked Slack team ${teamId} to organization ${orgId}`);
      return { success: true };
    } catch (error) {
      this.logger.error(
        `Failed to link team ${teamId} to org ${orgId}:`,
        error as Record<string, unknown>,
      );
      return {
        success: false,
        error: 'Database error occurred while linking workspace.',
      };
    }
  }

  /**
   * Unlink Slack workspace from AsyncStand organization
   */
  async unlinkFromOrganization(teamId: string): Promise<void> {
    await this.prisma.integration.updateMany({
      where: {
        platform: IntegrationPlatform.slack,
        externalTeamId: teamId,
      },
      data: {
        orgId: null,
      },
    });

    this.logger.info(`Unlinked Slack team ${teamId} from organization`);
  }

  /**
   * Get connection status for a Slack workspace
   */
  async getConnectionStatus(teamId: string): Promise<ConnectionStatus> {
    const integration = await this.prisma.integration.findUnique({
      where: {
        platform_externalTeamId: {
          platform: IntegrationPlatform.slack,
          externalTeamId: teamId,
        },
      },
      select: {
        orgId: true,
      },
    });

    if (!integration) {
      return { connected: false };
    }

    return {
      connected: !!integration.orgId,
      orgId: integration.orgId || undefined,
    };
  }

  /**
   * Send welcome message to user who installed the bot
   */
  private async sendWelcomeMessage(
    botToken: string,
    userId: string,
    isLinked = false,
  ): Promise<void> {
    try {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: userId, // DM the installer
          text: isLinked
            ? '🎉 AsyncStand connected successfully!'
            : '🎉 AsyncStand bot installed successfully!',
          blocks: isLinked
            ? [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: '🎉 *AsyncStand connected successfully!*',
                  },
                },
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: 'Your Slack workspace is now connected to your AsyncStand organization. The bot is ready to help with your team standups!',
                  },
                },
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: 'Available commands:\\n• `/asyncstand-status` - Check connection status\\n• `/asyncstand-disconnect` - Unlink from organization',
                  },
                },
              ]
            : [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: '🎉 *AsyncStand bot installed successfully!*',
                  },
                },
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: 'To start using AsyncStand for your team standups, connect this workspace to your AsyncStand organization:',
                  },
                },
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: '```/asyncstand-connect your-organization-id```',
                  },
                },
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: 'Other commands:\\n• `/asyncstand-status` - Check connection status\\n• `/asyncstand-disconnect` - Unlink from organization',
                  },
                },
              ],
        }),
      });

      if (!response.ok) {
        this.logger.warn(`Failed to send welcome message: ${response.statusText}`);
      }
    } catch (error) {
      this.logger.warn('Failed to send welcome message:', error as Record<string, unknown>);
    }
  }
}
