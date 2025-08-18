import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ModernButton, Tooltip } from '@/components/ui';
import {
  Settings,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Users,
  ChevronRight,
  Activity,
  Zap,
  Hash,
  Shield,
  Link2,
} from 'lucide-react';
import { toast } from '@/components/ui';
import { integrationsApi, type SlackIntegration } from '@/lib/api';
import { useAuth, useIntegrations } from '@/contexts';
import {
  SlackIcon,
  TeamsOutlineIcon,
  DiscordOutlineIcon,
} from '@/components/icons/IntegrationIcons';
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
  const [expandedScopes, setExpandedScopes] = useState<{ [key: string]: boolean }>({});

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

  const toggleScopeExpansion = (integrationId: string) => {
    setExpandedScopes(prev => ({
      ...prev,
      [integrationId]: !prev[integrationId],
    }));
  };

  const getIntegrationStatus = (integration: SlackIntegration) => {
    if (isIntegrationSyncing(integration.id)) {
      return 'syncing';
    }
    if (integration.tokenStatus !== 'ok') {
      return 'error';
    }
    if (integration.syncState?.errorMsg) {
      return 'warning';
    }
    return 'active';
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'active':
        return <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />;
      case 'syncing':
        return <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />;
      case 'warning':
        return <div className="w-2 h-2 bg-orange-500 rounded-full" />;
      case 'error':
        return <div className="w-2 h-2 bg-red-500 rounded-full" />;
      default:
        return <div className="w-2 h-2 bg-gray-500 rounded-full" />;
    }
  };

  const getHealthIndicator = (integration: SlackIntegration) => {
    const status = getIntegrationStatus(integration);
    switch (status) {
      case 'active':
        return { text: 'Healthy', color: 'text-green-600 dark:text-green-400' };
      case 'syncing':
        return { text: 'Syncing', color: 'text-yellow-600 dark:text-yellow-400' };
      case 'warning':
        return { text: 'Warning', color: 'text-orange-600 dark:text-orange-400' };
      case 'error':
        return { text: 'Error', color: 'text-red-600 dark:text-red-400' };
      default:
        return { text: 'Unknown', color: 'text-gray-600 dark:text-gray-400' };
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

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const renderScopes = (scopes: string[], integrationId: string) => {
    const isExpanded = expandedScopes[integrationId];
    const scopesToShow = isExpanded ? scopes : scopes.slice(0, 10);
    const remaining = scopes.length - 10;

    return (
      <div className="flex flex-wrap gap-1 items-center">
        {scopesToShow.map((scope, index) => (
          <span
            key={index}
            className="px-2 py-0.5 bg-muted/50 text-xs rounded-md text-muted-foreground"
          >
            {scope}
          </span>
        ))}
        {scopes.length > 10 && (
          <button
            onClick={e => {
              e.stopPropagation();
              toggleScopeExpansion(integrationId);
            }}
            className="text-xs text-primary hover:underline cursor-pointer"
          >
            {isExpanded ? 'Show less' : `+${remaining} more`}
          </button>
        )}
      </div>
    );
  };

  // Calculate sync counts
  const getSyncCounts = (integration: SlackIntegration) => {
    // These would ideally come from the backend
    // For now, we'll use placeholder values
    return {
      channels: integration.syncState?.lastChannelsSyncAt ? '12' : '0',
      users: integration.syncState?.lastUsersSyncAt ? '48' : '0',
    };
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

        {/* Available Platforms Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-card rounded-2xl p-6 sm:p-8 border border-border mb-8"
        >
          <h2 className="text-lg sm:text-xl font-semibold mb-2">Available Platforms</h2>
          <p className="text-muted-foreground mb-6 text-sm">
            Workspace tools you can connect to AsyncStand.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Slack Card */}
            <motion.div
              whileHover={{ y: -2 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className={`bg-card rounded-xl border border-border p-4 relative overflow-hidden transition-all ${
                integrations.length > 0 ? '' : 'hover:bg-accent/5 cursor-pointer'
              }`}
              onClick={() =>
                integrations.length === 0 ? handleConnectIntegration('slack') : undefined
              }
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#4A154B] rounded-lg flex items-center justify-center">
                    <SlackIcon className="text-white" size={20} />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Slack</p>
                    <p className="text-xs text-muted-foreground">Team messaging</p>
                  </div>
                </div>
                {integrations.length > 0 && <CheckCircle2 className="w-4 h-4 text-green-500" />}
              </div>
              <div className="text-xs text-muted-foreground">
                {integrations.length > 0 ? 'Connected workspace' : 'Available to connect'}
              </div>
            </motion.div>

            {/* Microsoft Teams Card */}
            <Tooltip content="Microsoft Teams integration coming soon!" position="top">
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="bg-card rounded-xl border border-border p-4 relative overflow-hidden opacity-60 cursor-not-allowed"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                      <TeamsOutlineIcon className="text-gray-400" size={20} />
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">Microsoft Teams</p>
                      <p className="text-xs text-muted-foreground">Coming soon</p>
                    </div>
                  </div>
                  <Clock className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="text-xs text-muted-foreground">Not available yet</div>
              </motion.div>
            </Tooltip>

            {/* Discord Card */}
            <Tooltip content="Discord integration coming soon!" position="top">
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="bg-card rounded-xl border border-border p-4 relative overflow-hidden opacity-60 cursor-not-allowed"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                      <DiscordOutlineIcon className="text-gray-400" size={20} />
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">Discord</p>
                      <p className="text-xs text-muted-foreground">Coming soon</p>
                    </div>
                  </div>
                  <Clock className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="text-xs text-muted-foreground">Not available yet</div>
              </motion.div>
            </Tooltip>
          </div>
        </motion.div>

        {/* Connected Integrations Section */}
        {integrations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold mb-1">Connected Integrations</h2>
                <p className="text-sm text-muted-foreground">
                  Manage your active workspace connections
                </p>
              </div>
              <div className="px-4 py-1.5 bg-green-50 border border-green-200 rounded-full">
                <span className="text-sm font-semibold text-green-700">
                  {integrations.length} Active
                </span>
              </div>
            </div>

            {integrations.map((integration, index) => {
              const status = getIntegrationStatus(integration);
              const healthIndicator = getHealthIndicator(integration);
              const syncCounts = getSyncCounts(integration);
              const lastSync =
                integration.syncState?.lastUsersSyncAt || integration.syncState?.lastChannelsSyncAt;

              return (
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
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-semibold">{integration.externalTeamId}</h3>
                          <div className="flex items-center gap-2">
                            {getStatusDot(status)}
                            <span className={`text-sm font-medium ${healthIndicator.color}`}>
                              {healthIndicator.text}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Connected {formatDate(integration.installedAt)}
                        </p>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-2">
                      <Tooltip content="Sync Now" position="bottom">
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
                            className={`w-4 h-4 ${isIntegrationSyncing(integration.id) ? 'animate-spin' : ''}`}
                          />
                        </ModernButton>
                      </Tooltip>

                      <Tooltip content="Settings" position="bottom">
                        <ModernButton
                          variant="ghost"
                          size="sm"
                          onClick={e => {
                            e.stopPropagation();
                            handleViewIntegration(integration);
                          }}
                        >
                          <Settings className="w-4 h-4" />
                        </ModernButton>
                      </Tooltip>

                      <Tooltip content="Disconnect" position="bottom">
                        <ModernButton
                          variant="ghost"
                          size="sm"
                          onClick={e => {
                            e.stopPropagation();
                            handleDisconnectClick(integration);
                          }}
                          data-testid={`disconnect-${integration.id}`}
                        >
                          <Link2 className="w-4 h-4 text-red-500" />
                        </ModernButton>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Health Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Last Sync</p>
                        <p className="text-sm font-medium">
                          {lastSync ? formatTimeAgo(lastSync) : 'Never'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Channels</p>
                        <p className="text-sm font-medium">{syncCounts.channels} synced</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Users</p>
                        <p className="text-sm font-medium">{syncCounts.users} synced</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Status</p>
                        <p className="text-sm font-medium capitalize">
                          {integration.tokenStatus === 'ok' ? 'Connected' : integration.tokenStatus}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Permissions/Scopes */}
                  <div className="border-t border-border pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Permissions</span>
                    </div>
                    {renderScopes(integration.scopes, integration.id)}
                  </div>

                  {/* Error Message */}
                  {integration.syncState?.errorMsg && (
                    <div className="mt-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <span className="text-sm text-red-700 dark:text-red-300">
                          {integration.syncState.errorMsg}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* View Details Button */}
                  <div className="mt-4 flex justify-end">
                    <ModernButton
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewIntegration(integration)}
                      className="gap-2"
                    >
                      View Details
                      <ChevronRight className="w-4 h-4" />
                    </ModernButton>
                  </div>
                </motion.div>
              );
            })}
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
