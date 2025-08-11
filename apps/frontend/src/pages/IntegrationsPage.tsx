import React from 'react';
import { motion } from 'framer-motion';
import { ModernButton, Tooltip } from '@/components/ui';
import {
  Settings,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Users,
  MessageSquare,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { type SlackIntegration } from '@/lib/api';
import { startSlackOAuth } from '@/utils/slack-oauth';
import { useAuth, useIntegrations } from '@/contexts';
import { SlackIcon, TeamsIcon, DiscordIcon } from '@/components/icons/IntegrationIcons';

export const IntegrationsPage = React.memo(() => {
  const { user } = useAuth();
  const {
    integrations,
    isLoading,
    syncIntegration,
    removeIntegration,
    isIntegrationSyncing,
    refreshIntegrations,
  } = useIntegrations();

  const handleConnectIntegration = async (platform: 'slack' | 'teams' | 'discord' = 'slack') => {
    if (!user?.orgId) {
      toast.error(
        'No organization found. Please ensure you are logged in with a valid organization.'
      );
      return;
    }

    switch (platform) {
      case 'slack':
        try {
          await startSlackOAuth({
            orgId: user.orgId,
            onSuccess: () => {
              toast.success('Slack workspace connected successfully!');
              refreshIntegrations();
            },
            onError: error => {
              toast.error(error);
            },
          });
        } catch (error) {
          console.error('Error during Slack OAuth:', error);
          toast.error('Failed to initiate Slack connection');
        }
        break;
      case 'teams':
        // Don't show toast here, handled by tooltip
        break;
      case 'discord':
        // Don't show toast here, handled by tooltip
        break;
      default:
        toast.error('Unsupported integration platform');
    }
  };

  const handleSync = async (integrationId: string) => {
    await syncIntegration(integrationId);
  };

  const handleDisconnect = async (integrationId: string, teamName: string) => {
    await removeIntegration(integrationId, teamName);
  };

  const getStatusIcon = (status: SlackIntegration['tokenStatus']) => {
    switch (status) {
      case 'ok':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'expired':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'revoked':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
    }
  };

  const getStatusText = (status: SlackIntegration['tokenStatus']) => {
    switch (status) {
      case 'ok':
        return 'Connected';
      case 'expired':
        return 'Token Expired';
      case 'revoked':
        return 'Access Revoked';
      default:
        return 'Error';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading integrations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-3xl font-bold mb-2">Integrations</h1>
            <p className="text-muted-foreground text-lg">
              Connect your workspace tools to AsyncStand for seamless standup management.
            </p>
          </div>
        </motion.div>

        {/* Integrations List */}
        {integrations.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="space-y-6"
          >
            {integrations.map((integration, index) => (
              <motion.div
                key={integration.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
                className="bg-card rounded-2xl p-6 border border-border hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-[#4A154B] to-[#350d36] rounded-xl flex items-center justify-center">
                      <SlackIcon className="text-white" size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold">{integration.externalTeamId}</h3>
                        {getStatusIcon(integration.tokenStatus)}
                        <span className="text-sm font-medium text-muted-foreground">
                          {getStatusText(integration.tokenStatus)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Connected {formatDate(integration.installedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <ModernButton
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSync(integration.id)}
                      disabled={
                        isIntegrationSyncing(integration.id) || integration.tokenStatus !== 'ok'
                      }
                      data-testid={`sync-${integration.id}`}
                    >
                      <RefreshCw
                        className={`w-4 h-4 mr-2 ${isIntegrationSyncing(integration.id) ? 'animate-spin' : ''}`}
                      />
                      Sync
                    </ModernButton>
                    <ModernButton
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDisconnect(integration.id, integration.externalTeamId)}
                      data-testid={`disconnect-${integration.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </ModernButton>
                  </div>
                </div>

                {/* Integration Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Scopes: {integration.scopes.join(', ')}
                    </span>
                  </div>
                  {integration.syncState?.lastUsersSyncAt && (
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Users synced: {formatDate(integration.syncState.lastUsersSyncAt)}
                      </span>
                    </div>
                  )}
                  {integration.syncState?.lastChannelsSyncAt && (
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Channels synced: {formatDate(integration.syncState.lastChannelsSyncAt)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Error Message */}
                {integration.syncState?.errorMsg && (
                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <span className="text-sm text-red-700 dark:text-red-300">
                        {integration.syncState.errorMsg}
                      </span>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="bg-card rounded-2xl p-12 border border-border text-center"
          >
            <div className="flex items-center justify-center gap-6 mb-8">
              <div className="w-20 h-20 bg-gradient-to-r from-[#4A154B] to-[#350d36] rounded-2xl flex items-center justify-center">
                <SlackIcon className="text-white" size={28} />
              </div>
              <div className="w-20 h-20 bg-gradient-to-r from-[#464EB8] to-[#6264A7] rounded-2xl flex items-center justify-center opacity-50">
                <TeamsIcon className="text-white" size={28} />
              </div>
              <div className="w-20 h-20 bg-gradient-to-r from-[#5865F2] to-[#7289DA] rounded-2xl flex items-center justify-center opacity-50">
                <DiscordIcon className="text-white" size={28} />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-4">Connect Your Workspace</h3>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto text-center">
              Choose your preferred communication platform to start managing async standups with
              your team.
            </p>
            <div className="flex flex-col items-center gap-4 max-w-sm mx-auto">
              <ModernButton
                variant="primary"
                size="lg"
                className="w-full bg-gradient-to-r from-[#4A154B] to-[#350d36] hover:from-[#4A154B]/90 hover:to-[#350d36]/90 text-white border-0"
                onClick={() => handleConnectIntegration('slack')}
                data-testid="empty-connect-slack-button"
              >
                <SlackIcon className="mr-3" size={20} />
                Connect Slack Workspace
              </ModernButton>

              <div className="flex items-center gap-3 w-full">
                <Tooltip content="Microsoft Teams integration coming soon!" position="top">
                  <ModernButton
                    variant="secondary"
                    size="lg"
                    className="flex-1 border-2 border-dashed border-gray-300 dark:border-gray-600 text-muted-foreground cursor-not-allowed opacity-60 whitespace-nowrap"
                    onClick={() => handleConnectIntegration('teams')}
                    data-testid="empty-connect-teams-button"
                    disabled
                  >
                    <TeamsIcon className="mr-3" size={20} />
                    Microsoft Teams
                  </ModernButton>
                </Tooltip>

                <Tooltip content="Discord integration coming soon!" position="top">
                  <ModernButton
                    variant="secondary"
                    size="lg"
                    className="flex-1 border-2 border-dashed border-gray-300 dark:border-gray-600 text-muted-foreground cursor-not-allowed opacity-60 whitespace-nowrap"
                    onClick={() => handleConnectIntegration('discord')}
                    data-testid="empty-connect-discord-button"
                    disabled
                  >
                    <DiscordIcon className="mr-3" size={20} />
                    Discord
                  </ModernButton>
                </Tooltip>
              </div>

              <p className="text-xs text-muted-foreground mt-4 text-center">
                <Zap className="w-4 h-4 inline mr-1" />
                More integrations coming soon
              </p>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
});
