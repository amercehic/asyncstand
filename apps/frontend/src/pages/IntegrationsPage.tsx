import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
} from 'lucide-react';
import { toast } from '@/components/ui';
import { integrationsApi, type SlackIntegration } from '@/lib/api';
import { useAuth, useIntegrations } from '@/contexts';
import { SlackIcon, TeamsIcon, DiscordIcon } from '@/components/icons/IntegrationIcons';
import { DeleteIntegrationModal } from '@/components/DeleteIntegrationModal';
import { IntegrationSuccessDialog } from '@/components/IntegrationSuccessDialog';

export const IntegrationsPage = React.memo(() => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    integrations,
    isLoading,
    syncIntegration,
    removeIntegration,
    isIntegrationSyncing,
    refreshIntegrations,
  } = useIntegrations();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [integrationToDelete, setIntegrationToDelete] = useState<SlackIntegration | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [successIntegration, setSuccessIntegration] = useState<{
    name: string;
    type: 'slack' | 'teams' | 'discord';
    workspaceName?: string;
    id?: string;
  } | null>(null);

  // Handle OAuth callback from URL parameters
  useEffect(() => {
    const status = searchParams.get('status');
    const message = searchParams.get('message');

    if (status === 'success') {
      // Clear URL params first
      setSearchParams({});

      // Refresh integrations and show success dialog
      refreshIntegrations().then(async () => {
        const latest = await integrationsApi.getSlackIntegrations();
        const newest = latest[0];

        if (newest) {
          setSuccessIntegration({
            name: 'Slack',
            type: 'slack',
            workspaceName: newest.externalTeamId,
            id: newest.id,
          });
          setShowSuccessDialog(true);

          // Automatically trigger sync after successful integration
          try {
            await syncIntegration(newest.id);
          } catch (error) {
            console.error('Auto-sync failed:', error);
            // Don't show toast error as the integration was successful
          }
        } else {
          toast.success('Integration connected successfully!');
        }
      });
    } else if (status === 'error') {
      // Clear URL params
      setSearchParams({});

      // Show error message
      const errorMessage = message ? decodeURIComponent(message) : 'Integration failed';
      toast.error(errorMessage);
    }
  }, [searchParams, setSearchParams, refreshIntegrations]);

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
          // Use NGROK_URL if available for OAuth flow, otherwise use relative URL
          const ngrokUrl = import.meta.env.VITE_NGROK_URL;
          const baseUrl = ngrokUrl || '';
          const oauthUrl = `${baseUrl}/slack/oauth/start?orgId=${user.orgId}`;

          // Navigate directly to OAuth URL instead of using popup
          window.location.href = oauthUrl;
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

  const handleDisconnectClick = (integration: SlackIntegration) => {
    setIntegrationToDelete(integration);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async (integrationId: string) => {
    await removeIntegration(integrationId);
    setShowDeleteModal(false);
    setIntegrationToDelete(null);
  };

  const handleSuccessDialogClose = () => {
    setShowSuccessDialog(false);
    setSuccessIntegration(null);
  };

  const handleConfigure = () => {
    if (successIntegration?.id) {
      navigate(`/integrations/${successIntegration.id}`);
    }
    handleSuccessDialogClose();
  };

  const handleViewIntegration = (integration: SlackIntegration) => {
    navigate(`/integrations/${integration.id}`);
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
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
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
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6"
        >
          <div>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="relative mb-2"
            >
              <motion.h1
                className="text-2xl sm:text-4xl font-bold text-foreground relative z-10"
                initial={{ y: 10 }}
                animate={{ y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                <span className="relative inline-block">
                  <span className="bg-gradient-to-r from-foreground via-blue-600/80 to-foreground bg-clip-text text-transparent font-extrabold">
                    Integrations
                  </span>

                  {/* Connection icon effects */}
                  <motion.div
                    className="absolute -top-1 -right-6 w-3 h-3 border-2 border-blue-400 rounded-full"
                    animate={{
                      scale: [1, 1.2, 1],
                      rotate: [0, 90, 180, 270, 360],
                    }}
                    transition={{
                      duration: 3,
                      delay: 1,
                      repeat: Infinity,
                      repeatDelay: 2,
                    }}
                  ></motion.div>
                  <motion.div
                    className="absolute top-1 -right-2 w-1 h-1 bg-cyan-400 rounded-full"
                    animate={{
                      opacity: [0, 1, 0],
                      scale: [0, 1, 0],
                    }}
                    transition={{
                      duration: 2,
                      delay: 1.5,
                      repeat: Infinity,
                      repeatDelay: 3,
                    }}
                  ></motion.div>
                </span>
              </motion.h1>
            </motion.div>
            <motion.p
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-muted-foreground text-base sm:text-lg"
            >
              Connect your workspace tools to AsyncStand for seamless standup management.
            </motion.p>
          </div>
        </motion.div>

        {/* Connection Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-card rounded-2xl p-6 sm:p-8 border border-border mb-8"
        >
          <h2 className="text-lg sm:text-xl font-semibold mb-4">Available Platforms</h2>
          <p className="text-muted-foreground mb-6">
            Connect your workspace tools to get started with async standups.
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            {integrations.length > 0 ? (
              <ModernButton
                variant="secondary"
                size="lg"
                className="border-2 border-green-500 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300 cursor-default"
                disabled
              >
                <SlackIcon className="mr-3" size={20} />
                Slack Already Connected
              </ModernButton>
            ) : (
              <ModernButton
                variant="primary"
                size="lg"
                className="bg-gradient-to-r from-[#4A154B] to-[#350d36] hover:from-[#4A154B]/90 hover:to-[#350d36]/90 text-white border-0"
                onClick={() => handleConnectIntegration('slack')}
              >
                <SlackIcon className="mr-3" size={20} />
                Connect Slack Workspace
              </ModernButton>
            )}

            <Tooltip content="Microsoft Teams integration coming soon!" position="top">
              <ModernButton
                variant="secondary"
                size="lg"
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 text-muted-foreground cursor-not-allowed opacity-60"
                onClick={() => handleConnectIntegration('teams')}
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
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 text-muted-foreground cursor-not-allowed opacity-60"
                onClick={() => handleConnectIntegration('discord')}
                disabled
              >
                <DiscordIcon className="mr-3" size={20} />
                Discord
              </ModernButton>
            </Tooltip>
          </div>
        </motion.div>

        {/* Integrations List */}
        {integrations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-6"
          >
            {integrations.map((integration, index) => (
              <motion.div
                key={integration.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
                className="bg-card rounded-2xl p-6 border border-border hover:shadow-lg transition-all duration-300 cursor-pointer"
                onClick={() => handleViewIntegration(integration)}
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
                      onClick={e => {
                        e.stopPropagation();
                        handleSync(integration.id);
                      }}
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
                      onClick={e => {
                        e.stopPropagation();
                        handleDisconnectClick(integration);
                      }}
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
        )}

        {integrations.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="bg-card rounded-2xl p-12 border border-border text-center"
          >
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
              <Settings className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-3">No Integrations Connected</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Use the connection buttons above to integrate with your workspace tools and start
              managing async standups.
            </p>
          </motion.div>
        )}

        {/* Delete Integration Modal */}
        <DeleteIntegrationModal
          integration={integrationToDelete}
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setIntegrationToDelete(null);
          }}
          onConfirm={handleDeleteConfirm}
        />

        {/* Success Dialog */}
        {successIntegration && (
          <IntegrationSuccessDialog
            isOpen={showSuccessDialog}
            onClose={handleSuccessDialogClose}
            onConfigure={successIntegration.id ? handleConfigure : undefined}
            integration={successIntegration}
          />
        )}
      </main>
    </div>
  );
});
