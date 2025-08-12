import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ModernButton } from '@/components/ui';
import { ArrowLeft, Settings, Plus, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { teamsApi, standupsApi } from '@/lib/api';
import type { Team, StandupConfig, StandupInstance } from '@/types';
import type { AxiosError } from 'axios';
import { TeamSettingsModal } from '@/components/TeamSettingsModal';
import { ActiveStandupsList } from '@/components/ActiveStandupsList';

export const TeamDetailPage = React.memo(() => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [standups, setStandups] = useState<StandupConfig[]>([]);
  const [recentInstances, setRecentInstances] = useState<StandupInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTeamSettingsOpen, setIsTeamSettingsOpen] = useState(false);

  useEffect(() => {
    const fetchTeamData = async () => {
      if (!teamId) return;

      try {
        setIsLoading(true);

        // Fetch team details first
        const teamData = await teamsApi.getTeam(teamId);

        // Then try to fetch standups, but handle case where config doesn't exist yet
        let standupsData: StandupConfig[] = [];
        try {
          standupsData = await standupsApi.getTeamStandups(teamId);
        } catch (standupsError: unknown) {
          // If standup config doesn't exist, that's okay - show empty state
          const axiosError = standupsError as AxiosError;
          const errorData = axiosError?.response?.data as
            | { code?: string; detail?: string }
            | undefined;

          if (
            axiosError?.response?.status === 404 ||
            errorData?.code === 'STANDUP_CONFIG_NOT_FOUND' ||
            (errorData?.detail && errorData.detail.includes('STANDUP_CONFIG_NOT_FOUND'))
          ) {
            console.log('No standup config found for team, showing empty state');
          } else {
            console.error('Error fetching standups:', standupsError);
            toast.error('Failed to load standup configurations');
          }
        }

        setTeam(teamData);
        setStandups(standupsData);

        // Fetch recent instances for all standups
        if (standupsData.length > 0) {
          const instancePromises = standupsData.map(standup =>
            standupsApi.getStandupInstances(standup.id).catch(() => [])
          );

          const allInstances = await Promise.all(instancePromises);
          const flatInstances = allInstances.flat();

          // Sort by date and take most recent
          const sortedInstances = flatInstances
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 5);

          setRecentInstances(sortedInstances);
        }
      } catch (error: unknown) {
        console.error('Error fetching team data:', error);
        if ((error as AxiosError)?.response?.status === 404) {
          toast.error('Team not found');
        } else {
          toast.error('Failed to load team data');
        }
        setTeam(null);
        setStandups([]);
        setRecentInstances([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTeamData();
  }, [teamId]);

  const handleTeamSettingsSuccess = async () => {
    // Refetch team data after successful update
    if (teamId) {
      try {
        const teamData = await teamsApi.getTeam(teamId);
        setTeam(teamData);
      } catch (error) {
        console.error('Error refreshing team data:', error);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading team details...</p>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Team Not Found</h1>
          <p className="text-muted-foreground mb-6">The team you're looking for doesn't exist.</p>
          <Link to="/teams">
            <ModernButton variant="primary">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Teams
            </ModernButton>
          </Link>
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: StandupInstance['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'active':
        return <Clock className="w-4 h-4 text-blue-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

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
          <div className="flex items-center gap-4">
            <Link to="/teams">
              <ModernButton variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4" />
              </ModernButton>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">{team.name}</h1>
              <p className="text-muted-foreground text-lg">
                {team.members.length} member{team.members.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <ModernButton
              variant="secondary"
              onClick={() => setIsTeamSettingsOpen(true)}
              data-testid="team-settings-button"
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </ModernButton>
            <Link to={`/teams/${teamId}/standups/create`}>
              <ModernButton variant="primary" data-testid="create-standup-button">
                <Plus className="w-4 h-4 mr-2" />
                New Standup
              </ModernButton>
            </Link>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Team Description */}
            {team.description && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="bg-card rounded-2xl p-6 border border-border"
              >
                <h2 className="text-xl font-semibold mb-4">About</h2>
                <p className="text-muted-foreground">{team.description}</p>
              </motion.div>
            )}

            {/* Team Integration Info */}
            {team.channel && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.15 }}
                className="bg-card rounded-2xl p-6 border border-border"
              >
                <h2 className="text-xl font-semibold mb-4">Integration</h2>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">#</span>
                  </div>
                  <div>
                    <p className="font-medium">#{team.channel.name}</p>
                    <p className="text-sm text-muted-foreground">Slack channel</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Active Standups */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <ActiveStandupsList teamId={teamId} showHeader={true} showCreateButton={true} />
            </motion.div>

            {/* Recent Activity */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="bg-card rounded-2xl p-6 border border-border"
            >
              <h2 className="text-xl font-semibold mb-6">Recent Activity</h2>

              {recentInstances.length > 0 ? (
                <div className="space-y-3">
                  {recentInstances.map(instance => {
                    const standup = standups.find(s => s.id === instance.configId);
                    return (
                      <div
                        key={instance.id}
                        className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/standups/${instance.id}`)}
                      >
                        {getStatusIcon(instance.status)}
                        <div className="flex-1">
                          <p className="font-medium">{standup?.name || 'Unknown Standup'}</p>
                          <p className="text-sm text-muted-foreground">
                            {instance.responses.length}/{instance.participants.length} responses •{' '}
                            {instance.date}
                          </p>
                        </div>
                        <span
                          className={`text-xs px-2 py-1 rounded-full capitalize ${
                            instance.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : instance.status === 'active'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {instance.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No recent activity</p>
                </div>
              )}
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Team Members */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="bg-card rounded-2xl p-6 border border-border"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Team Members</h3>
                <ModernButton
                  variant="outline"
                  size="sm"
                  onClick={() => toast.info('Invite members - Coming soon!')}
                >
                  <Plus className="w-4 h-4" />
                </ModernButton>
              </div>

              <div className="space-y-3">
                {team.members.map(member => (
                  <div key={member.id} className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-primary to-primary/80 rounded-full flex items-center justify-center">
                      <span className="text-white font-medium text-sm">
                        {member.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{member.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{member.email}</p>
                    </div>
                    {member.role === 'admin' && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                        Admin
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Quick Stats */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-card rounded-2xl p-6 border border-border"
            >
              <h3 className="text-lg font-semibold mb-6">Team Stats</h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Active Standups</span>
                  <span className="font-semibold">{standups.filter(s => s.isActive).length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">This Week</span>
                  <span className="font-semibold">{recentInstances.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Completion Rate</span>
                  <span className="font-semibold text-green-600">85%</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Team Settings Modal */}
      {team && (
        <TeamSettingsModal
          isOpen={isTeamSettingsOpen}
          onClose={() => setIsTeamSettingsOpen(false)}
          onSuccess={handleTeamSettingsSuccess}
          team={team}
        />
      )}
    </div>
  );
});
