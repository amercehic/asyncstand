import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ModernButton } from '@/components/ui';
import {
  ArrowLeft,
  Settings,
  Users,
  MessageSquare,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Hash,
  User,
  RefreshCw,
  Trash2,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { teamsApi, standupsApi } from '@/lib/api';
import { useIntegrations } from '@/contexts';
import type { SlackIntegration, ActiveStandup } from '@/lib/api';
import type { AvailableChannelsResponse, AvailableMembersResponse } from '@/types/backend';
import { SlackIcon } from '@/components/icons/IntegrationIcons';

export const IntegrationDetailsPage = React.memo(() => {
  const { integrationId } = useParams<{ integrationId: string }>();
  const navigate = useNavigate();
  const { integrations, syncIntegration, removeIntegration, isIntegrationSyncing } =
    useIntegrations();

  const [integration, setIntegration] = useState<SlackIntegration | null>(null);
  const [channels, setChannels] = useState<AvailableChannelsResponse['channels']>([]);
  const [members, setMembers] = useState<AvailableMembersResponse['members']>([]);
  const [activeStandups, setActiveStandups] = useState<ActiveStandup[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'channels' | 'members' | 'standups'>(
    'overview'
  );

  // Find the integration from context
  useEffect(() => {
    if (!integrationId) return;

    const foundIntegration = integrations.find(int => int.id === integrationId);
    if (foundIntegration) {
      setIntegration(foundIntegration);
    } else if (integrations.length > 0) {
      // Integration not found and integrations are loaded
      toast.error('Integration not found');
      navigate('/integrations');
    }
  }, [integrationId, integrations, navigate]);

  // Load channels and members when page loads
  useEffect(() => {
    const loadIntegrationData = async () => {
      if (!integration) return;

      setIsLoadingData(true);
      try {
        const [channelsData, membersData, activeStandupsData] = await Promise.all([
          teamsApi.getAvailableChannels(),
          teamsApi.getAvailableMembers(),
          standupsApi.getActiveStandups(),
        ]);
        setChannels(channelsData.channels);
        setMembers(membersData.members);
        setActiveStandups(activeStandupsData);
      } catch (error) {
        console.error('Error loading integration data:', error);
        toast.error('Failed to load integration details');
      } finally {
        setIsLoadingData(false);
      }
    };

    loadIntegrationData();
  }, [integration]);

  const handleSync = async () => {
    if (!integration) return;
    await syncIntegration(integration.id);
  };

  const handleDisconnect = async () => {
    if (!integration) return;
    await removeIntegration(integration.id, integration.externalTeamId);
    navigate('/integrations');
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
      hour12: false,
    });
  };

  if (!integration) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading integration...</p>
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
          className="flex items-center gap-4 mb-8"
        >
          <Link to="/integrations">
            <ModernButton variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </ModernButton>
          </Link>

          <div className="flex items-center gap-3 flex-1">
            <div className="w-12 h-12 bg-gradient-to-r from-[#4A154B] to-[#350d36] rounded-xl flex items-center justify-center">
              <SlackIcon className="text-white" size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-3xl font-bold">{integration.externalTeamId}</h1>
                {getStatusIcon(integration.tokenStatus)}
                <span className="text-sm font-medium text-muted-foreground">
                  {getStatusText(integration.tokenStatus)}
                </span>
              </div>
              <p className="text-muted-foreground text-lg">
                Connected {formatDate(integration.installedAt)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ModernButton
              variant="secondary"
              onClick={handleSync}
              disabled={isIntegrationSyncing(integration.id) || integration.tokenStatus !== 'ok'}
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${isIntegrationSyncing(integration.id) ? 'animate-spin' : ''}`}
              />
              Sync
            </ModernButton>
            <ModernButton
              variant="ghost"
              onClick={handleDisconnect}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Disconnect
            </ModernButton>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex gap-1 mb-8 p-1 bg-muted rounded-lg w-fit"
        >
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'overview'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('channels')}
            className={`px-6 py-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'channels'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <MessageSquare className="w-4 h-4 inline mr-2" />
            Channels ({channels.length})
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`px-6 py-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'members'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Members ({members.length})
          </button>
          <button
            onClick={() => setActiveTab('standups')}
            className={`px-6 py-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'standups'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Calendar className="w-4 h-4 inline mr-2" />
            Active Standups ({activeStandups.length})
          </button>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-card rounded-2xl border border-border p-8"
        >
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Scopes */}
              <div>
                <h2 className="text-2xl font-semibold mb-6">Permissions & Scopes</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {integration.scopes.map((scope, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg border border-border"
                    >
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      <span className="font-medium">{scope.replace(/:/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sync Information */}
              <div>
                <h2 className="text-2xl font-semibold mb-6">Synchronization Status</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {integration.syncState?.lastUsersSyncAt && (
                    <div className="flex items-center gap-4 p-6 bg-muted/50 rounded-lg">
                      <Users className="w-8 h-8 text-muted-foreground" />
                      <div>
                        <p className="text-lg font-semibold">Users Last Synced</p>
                        <p className="text-muted-foreground">
                          {formatDate(integration.syncState.lastUsersSyncAt)}
                        </p>
                      </div>
                    </div>
                  )}
                  {integration.syncState?.lastChannelsSyncAt && (
                    <div className="flex items-center gap-4 p-6 bg-muted/50 rounded-lg">
                      <MessageSquare className="w-8 h-8 text-muted-foreground" />
                      <div>
                        <p className="text-lg font-semibold">Channels Last Synced</p>
                        <p className="text-muted-foreground">
                          {formatDate(integration.syncState.lastChannelsSyncAt)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {integration.syncState?.errorMsg && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <AlertTriangle className="w-6 h-6 text-red-500" />
                    <h3 className="text-lg font-semibold text-red-700 dark:text-red-300">
                      Sync Error
                    </h3>
                  </div>
                  <p className="text-red-700 dark:text-red-300">{integration.syncState.errorMsg}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'channels' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold">Available Channels</h2>
                <p className="text-muted-foreground">{channels.length} channels found</p>
              </div>

              {isLoadingData ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {channels.map(channel => (
                    <div
                      key={channel.id}
                      className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border"
                    >
                      <div className="flex items-center gap-3">
                        <Hash className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">#{channel.name}</p>
                          {channel.assignedTeamName && (
                            <p className="text-xs text-muted-foreground">
                              Assigned to: {channel.assignedTeamName}
                            </p>
                          )}
                        </div>
                      </div>
                      <div>
                        {channel.isAssigned ? (
                          <span className="text-xs bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-2 py-1 rounded">
                            In Use
                          </span>
                        ) : (
                          <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">
                            Available
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'members' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold">Integration Members</h2>
                <p className="text-muted-foreground">{members.length} members found</p>
              </div>

              {isLoadingData ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {members.map(member => (
                    <div
                      key={member.id}
                      className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg border border-border"
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-sm text-muted-foreground">
                          In {member.inTeamCount} team{member.inTeamCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'standups' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold">Active Standups</h2>
                <p className="text-muted-foreground">{activeStandups.length} active standups</p>
              </div>

              {isLoadingData ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
              ) : activeStandups.length > 0 ? (
                <div className="space-y-4">
                  {activeStandups.map(standup => (
                    <div
                      key={standup.id}
                      className="p-6 bg-muted/50 rounded-lg border border-border hover:shadow-md transition-all cursor-pointer"
                      onClick={() => {
                        // Navigate to standup details
                        navigate(`/standups/${standup.id}`);
                      }}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                              <Calendar className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold">{standup.teamName}</h3>
                              <p className="text-sm text-muted-foreground">
                                {formatDate(standup.targetDate)} at {standup.timeLocal}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-3 py-1 text-xs font-medium rounded-full ${
                              standup.state === 'collecting'
                                ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
                                : standup.state === 'completed'
                                  ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                            }`}
                          >
                            {standup.state === 'collecting'
                              ? 'Collecting Responses'
                              : standup.state === 'completed'
                                ? 'Completed'
                                : standup.state}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {standup.respondedMembers}/{standup.totalMembers} responded
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {standup.responseRate}% response rate
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">{standup.timezone}</span>
                        </div>
                      </div>

                      <div className="border-t border-border pt-4">
                        <p className="text-sm text-muted-foreground mb-2">Questions:</p>
                        <div className="space-y-1">
                          {standup.questions.slice(0, 2).map((question, index) => (
                            <p key={index} className="text-sm text-foreground">
                              {index + 1}. {question}
                            </p>
                          ))}
                          {standup.questions.length > 2 && (
                            <p className="text-sm text-muted-foreground">
                              +{standup.questions.length - 2} more questions
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Active Standups</h3>
                  <p className="text-muted-foreground">
                    There are no active standups for this integration at the moment.
                  </p>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
});

IntegrationDetailsPage.displayName = 'IntegrationDetailsPage';
