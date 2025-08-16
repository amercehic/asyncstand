import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ModernButton, ConfirmationModal } from '@/components/ui';
import {
  ArrowLeft,
  Settings,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  UserPlus,
  Users,
  Link2,
  Slack,
  Trash2,
  Building2,
  Calendar,
  Activity,
  TrendingUp,
  BarChart3,
  Target,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { toast } from '@/components/ui';
import { teamsApi, standupsApi } from '@/lib/api';
import type { Team, StandupConfig, StandupInstance } from '@/types';
import type { AxiosError } from 'axios';
import { TeamSettingsModal } from '@/components/TeamSettingsModal';
import { ActiveStandupsList } from '@/components/ActiveStandupsList';
import { TeamMemberAssignmentModal } from '@/components/TeamMemberAssignmentModal';

export const TeamDetailPage = React.memo(() => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [standups, setStandups] = useState<StandupConfig[]>([]);
  const [recentInstances, setRecentInstances] = useState<StandupInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTeamSettingsOpen, setIsTeamSettingsOpen] = useState(false);
  const [isMemberAssignmentOpen, setIsMemberAssignmentOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<Team['members'][0] | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);
  const [isSyncingMembers, setIsSyncingMembers] = useState(false);
  const [showStats, setShowStats] = useState(true);

  // Function to fetch only standups data (for refreshing after deletion)
  const fetchStandupsOnly = useCallback(async () => {
    if (!teamId) return;

    try {
      // Fetch only standups data
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
          // No standup config found for team, showing empty state
        } else {
          console.error('Error fetching standups:', standupsError);
          toast.error('Failed to load standup configurations');
        }
      }

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
      } else {
        // Clear recent instances if no standups exist
        setRecentInstances([]);
      }
    } catch (error: unknown) {
      console.error('Error fetching standups:', error);
      toast.error('Failed to refresh standups');
    }
  }, [teamId]);

  const fetchTeamData = useCallback(async () => {
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
          // No standup config found for team, showing empty state
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
  }, [teamId]);

  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  const activeStandups = standups.filter(s => s.isActive);
  const pausedStandups = standups.filter(s => !s.isActive);

  // Calculate team stats
  const teamStats = useMemo(() => {
    if (!team) return null;

    const totalStandups = standups.length;
    const activeCount = activeStandups.length;
    const pausedCount = pausedStandups.length;
    const hasChannelStandups = activeStandups.some(s => s.deliveryType === 'channel');
    const memberCount = team.members.length;

    // Calculate health score
    let healthScore = 50;
    if (activeCount > 0) healthScore += 30;
    if (hasChannelStandups) healthScore += 10;
    healthScore += Math.min(10, memberCount * 2);
    healthScore = Math.min(100, healthScore);

    // Calculate completion rate from recent instances
    const completionRate =
      recentInstances.length > 0
        ? Math.round(
            (recentInstances.filter(i => i.status === 'completed').length /
              recentInstances.length) *
              100
          )
        : 0;

    return {
      totalStandups,
      activeCount,
      pausedCount,
      hasChannelStandups,
      memberCount,
      healthScore,
      completionRate,
      recentActivity: recentInstances.length,
    };
  }, [team, standups, activeStandups, pausedStandups, recentInstances]);

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

  const handleTeamDeleted = () => {
    // Redirect to teams page after team deletion
    navigate('/teams');
  };

  const handleMemberAssignmentSuccess = async () => {
    // Refetch team data after member assignment changes
    if (teamId) {
      try {
        const previousMemberCount = team?.members?.length || 0;
        const teamData = await teamsApi.getTeam(teamId);
        setTeam(teamData);

        // Show rich toast notification for member additions
        const newMemberCount = teamData.members?.length || 0;
        if (newMemberCount > previousMemberCount) {
          const newMembers = teamData.members?.slice(-1) || []; // Get the last added member
          const newMember = newMembers[0];
          if (newMember) {
            toast.memberAdded(newMember.name, teamData.name);
          }
        }
      } catch (error) {
        console.error('Error refreshing team data:', error);
        toast.error('Failed to refresh team data');
      }
    }
  };

  const handleSyncMembers = async () => {
    if (!teamId) return;

    setIsSyncingMembers(true);
    try {
      const result = await teamsApi.syncTeamMembers(teamId);

      // Refresh team data to show synced members
      const teamData = await teamsApi.getTeam(teamId);
      setTeam(teamData);

      toast.success(
        `Successfully imported ${result.syncedCount} new member${result.syncedCount !== 1 ? 's' : ''} from Slack`,
        {
          richContent: {
            title: 'Members Imported',
            description: `${result.syncedCount} Slack users added to ${team?.name}`,
            metadata: 'Just now',
          },
        }
      );
    } catch (error) {
      console.error('Error syncing members:', error);
      toast.error('Failed to import members from Slack');
    } finally {
      setIsSyncingMembers(false);
    }
  };

  const getPlatformIcon = (platformUserId?: string) => {
    // For now, assume Slack - in the future this could be determined by platform prefix or integration type
    if (platformUserId) {
      return <Slack className="w-4 h-4 text-muted-foreground" />;
    }
    return <Link2 className="w-4 h-4 text-muted-foreground" />;
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove || !teamId) return;

    setIsRemovingMember(true);
    try {
      await teamsApi.removeUser(teamId, memberToRemove.id);

      // Refresh team data
      const teamData = await teamsApi.getTeam(teamId);
      setTeam(teamData);

      toast.success('Member removed successfully', {
        richContent: {
          title: 'Team Member Removed',
          description: `${memberToRemove.name} has been removed from ${team?.name}`,
          avatar: memberToRemove.name.charAt(0).toUpperCase(),
          metadata: 'Just now',
        },
      });
      setMemberToRemove(null);
    } catch (error) {
      console.error('Error removing team member:', error);
      toast.error('Failed to remove team member');
    } finally {
      setIsRemovingMember(false);
    }
  };

  const handleCancelRemove = () => {
    setMemberToRemove(null);
  };

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

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6"
        >
          <button
            onClick={() => navigate('/teams')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Teams
          </button>
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20"
              >
                <Building2 className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </motion.div>
              <div className="flex-1">
                <h1 className="text-2xl sm:text-4xl font-bold mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {team.name}
                </h1>
                {team.description && (
                  <p className="text-muted-foreground text-base sm:text-lg mb-3">
                    {team.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                  {activeStandups.some(s => s.deliveryType === 'channel') ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 bg-green-500 rounded flex items-center justify-center">
                        <Slack className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
                      </div>
                      <span className="text-xs sm:text-sm font-medium text-green-600">
                        Channel delivery
                      </span>
                    </div>
                  ) : activeStandups.some(s => s.deliveryType === 'direct_message') ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 bg-blue-500 rounded flex items-center justify-center">
                        <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
                      </div>
                      <span className="text-xs sm:text-sm font-medium text-blue-600">
                        Direct messages
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 bg-muted border border-dashed border-muted-foreground/30 rounded flex items-center justify-center">
                        <Link2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-muted-foreground" />
                      </div>
                      <span className="text-xs sm:text-sm text-muted-foreground">No standups</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Users className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
                    <span className="text-xs sm:text-sm text-muted-foreground">
                      {team.members.length} members
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
                    <span className="text-xs sm:text-sm text-muted-foreground">
                      {activeStandups.length} active standups
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <ModernButton
                variant="ghost"
                onClick={() => setShowStats(!showStats)}
                className="group flex-1 sm:flex-none"
                size="sm"
              >
                <BarChart3 className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                <span className="sm:inline">Stats</span>
              </ModernButton>
              <ModernButton
                variant="secondary"
                onClick={() => setIsTeamSettingsOpen(true)}
                className="group flex-1 sm:flex-none"
                size="sm"
              >
                <Settings className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform" />
                <span className="sm:inline">Settings</span>
              </ModernButton>
              <Link to={`/teams/${teamId}/standups/wizard`} className="flex-1 sm:flex-none">
                <ModernButton
                  variant="primary"
                  className="group shadow-lg shadow-primary/20 w-full"
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform" />
                  <span className="sm:inline">Create Standup</span>
                </ModernButton>
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Mobile Statistics - Show above main content */}
        <AnimatePresence>
          {showStats && teamStats && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="lg:hidden mb-6 overflow-hidden"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/30 rounded-xl p-4">
                <h3 className="text-lg font-semibold text-foreground mb-4 col-span-full">
                  Team Statistics
                </h3>

                {/* Team Health */}
                <div className="bg-card rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Team Health</span>
                    <span
                      className={`text-sm font-bold ${
                        teamStats.healthScore > 70
                          ? 'text-green-500'
                          : teamStats.healthScore > 40
                            ? 'text-yellow-500'
                            : 'text-red-500'
                      }`}
                    >
                      {teamStats.healthScore}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${teamStats.healthScore}%` }}
                      transition={{ duration: 1 }}
                      className={`h-full rounded-full ${
                        teamStats.healthScore > 70
                          ? 'bg-green-500'
                          : teamStats.healthScore > 40
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                      }`}
                    />
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="bg-card rounded-lg border border-border p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Members</span>
                      <span className="text-lg font-bold">{teamStats.memberCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total Standups</span>
                      <span className="text-lg font-bold">{teamStats.totalStandups}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Active</span>
                      <span className="text-lg font-bold text-green-500">
                        {teamStats.activeCount}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-6">
          {/* Desktop Statistics Sidebar */}
          <AnimatePresence>
            {showStats && teamStats && (
              <motion.aside
                initial={{ opacity: 0, x: -20, width: 0 }}
                animate={{ opacity: 1, x: 0, width: 280 }}
                exit={{ opacity: 0, x: -20, width: 0 }}
                transition={{ duration: 0.3 }}
                className="hidden lg:block"
              >
                <div className="sticky top-4 space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                    Team Overview
                  </h3>

                  {/* Team Health */}
                  <div className="bg-card rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Team Health</span>
                      <span
                        className={`text-sm font-bold ${
                          teamStats.healthScore > 70
                            ? 'text-green-500'
                            : teamStats.healthScore > 40
                              ? 'text-yellow-500'
                              : 'text-red-500'
                        }`}
                      >
                        {teamStats.healthScore}%
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${teamStats.healthScore}%` }}
                        transition={{ duration: 1 }}
                        className={`h-full rounded-full ${
                          teamStats.healthScore > 70
                            ? 'bg-green-500'
                            : teamStats.healthScore > 40
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="space-y-2">
                    <div className="bg-card rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Members</span>
                        <span className="text-lg font-bold">{teamStats.memberCount}</span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Total Standups</span>
                        <span className="text-lg font-bold">{teamStats.totalStandups}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Active</span>
                        <span className="text-lg font-bold text-green-500">
                          {teamStats.activeCount}
                        </span>
                      </div>
                    </div>

                    {/* Completion Rate */}
                    <div className="bg-card rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Completion Rate</span>
                        <span
                          className={`text-sm font-bold ${
                            teamStats.completionRate > 70
                              ? 'text-green-500'
                              : teamStats.completionRate > 40
                                ? 'text-yellow-500'
                                : 'text-red-500'
                          }`}
                        >
                          {teamStats.completionRate}%
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${teamStats.completionRate}%` }}
                          transition={{ duration: 1, delay: 0.2 }}
                          className={`h-full rounded-full ${
                            teamStats.completionRate > 70
                              ? 'bg-green-500'
                              : teamStats.completionRate > 40
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Delivery Status */}
                    <div className="bg-card rounded-lg border border-border p-3">
                      <div className="flex items-center gap-2 mb-2">
                        {teamStats.hasChannelStandups ? (
                          <>
                            <Slack className="w-4 h-4 text-green-500" />
                            <span className="text-sm font-medium">Channel Delivery</span>
                          </>
                        ) : teamStats.activeCount > 0 ? (
                          <>
                            <Users className="w-4 h-4 text-blue-500" />
                            <span className="text-sm font-medium">Direct Messages</span>
                          </>
                        ) : (
                          <>
                            <Link2 className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium">No Active Standups</span>
                          </>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {teamStats.activeCount} active standup
                        {teamStats.activeCount !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Activity Indicator */}
                    <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border border-primary/20 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Activity className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium text-primary">Activity Level</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map(level => (
                          <div
                            key={level}
                            className={`h-4 w-1 rounded-full ${
                              level <= Math.ceil(teamStats.healthScore / 20)
                                ? 'bg-primary'
                                : 'bg-primary/20'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

          {/* Main Content */}
          <div className="flex-1">
            {/* Stats Cards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
            >
              {/* Team Members Card */}
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="bg-blue-100/60 dark:bg-blue-950/20 rounded-2xl p-6 border-0 relative"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                </div>
                <div className="text-4xl font-bold text-gray-900 dark:text-white mb-1">
                  {team.members.length}
                </div>
                <div className="text-gray-600 dark:text-gray-400 font-medium">Team Members</div>
              </motion.div>

              {/* Active Standups Card */}
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="bg-green-100/60 dark:bg-green-950/20 rounded-2xl p-6 border-0 relative"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-white" />
                  </div>
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                </div>
                <div className="text-4xl font-bold text-gray-900 dark:text-white mb-1">
                  {activeStandups.length}
                </div>
                <div className="text-gray-600 dark:text-gray-400 font-medium">Active Standups</div>
              </motion.div>

              {/* Delivery Method Card */}
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="bg-blue-100/60 dark:bg-blue-950/20 rounded-2xl p-6 border-0 relative"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center">
                    {activeStandups.some(s => s.deliveryType === 'channel') ? (
                      <Slack className="w-6 h-6 text-white" />
                    ) : activeStandups.length > 0 ? (
                      <Users className="w-6 h-6 text-white" />
                    ) : (
                      <Link2 className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {activeStandups.some(s => s.deliveryType === 'channel')
                    ? 'Channel'
                    : activeStandups.length > 0
                      ? 'Direct Message'
                      : 'No Standups'}
                </div>
                <div className="text-gray-600 dark:text-gray-400 font-medium">
                  {activeStandups.some(s => s.deliveryType === 'channel')
                    ? 'Slack channel delivery'
                    : activeStandups.length > 0
                      ? 'Direct message delivery'
                      : 'Create your first standup'}
                </div>
              </motion.div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main Content Area */}
              <div className="lg:col-span-2 space-y-8">
                {/* Active Standups */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  <ActiveStandupsList
                    teamId={teamId}
                    showHeader={true}
                    showCreateButton={false}
                    onStandupsChange={fetchStandupsOnly}
                  />
                </motion.div>

                {/* Recent Activity */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="bg-card rounded-xl border border-border p-6"
                >
                  <h2 className="text-xl font-semibold mb-6">Recent Activity</h2>

                  {recentInstances.length > 0 ? (
                    <div className="space-y-3">
                      {recentInstances.map(instance => {
                        const standup = standups.find(s => s.id === instance.configId);
                        return (
                          <motion.div
                            key={instance.id}
                            whileHover={{ x: 4 }}
                            className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/50 transition-all cursor-pointer group"
                            onClick={() => navigate(`/standups/${instance.id}`)}
                          >
                            {getStatusIcon(instance.status)}
                            <div className="flex-1">
                              <p className="font-medium group-hover:text-primary transition-colors">
                                {standup?.name || 'Unknown Standup'}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {instance.responses.length}/{instance.participants.length} responses
                                • {instance.date}
                              </p>
                            </div>
                            <span
                              className={`text-xs px-2 py-1 rounded-full capitalize ${
                                instance.status === 'completed'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                  : instance.status === 'active'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                              }`}
                            >
                              {instance.status}
                            </span>
                            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </motion.div>
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
                  className="bg-card rounded-xl border border-border p-6"
                >
                  <div className="mb-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold mb-1">Team Members</h3>
                        <span className="text-sm text-muted-foreground">
                          {team.members.length} member{team.members.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <ModernButton
                        variant="outline"
                        size="sm"
                        onClick={handleSyncMembers}
                        disabled={isSyncingMembers}
                        isLoading={isSyncingMembers}
                        title="Import members from Slack workspace"
                        className="w-full"
                      >
                        <Users className="w-4 h-4 mr-1" />
                        Import from Slack
                      </ModernButton>
                      <ModernButton
                        variant="outline"
                        size="sm"
                        onClick={() => setIsMemberAssignmentOpen(true)}
                        title="Manually assign specific members"
                        className="w-full"
                      >
                        <UserPlus className="w-4 h-4 mr-1" />
                        Manage Members
                      </ModernButton>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {team.members.length > 0 ? (
                      team.members.map(member => (
                        <motion.div
                          key={member.id}
                          whileHover={{ x: 2 }}
                          className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-all group"
                        >
                          <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-medium text-sm">
                              {member.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium truncate">{member.name}</p>
                              {getPlatformIcon()}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {member.email || 'Team member'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {member.role === 'admin' && (
                              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                                Admin
                              </span>
                            )}
                            <ModernButton
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-500/70 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors border border-red-200/50 hover:border-red-300 dark:border-red-800/30 dark:hover:border-red-700/50 rounded-md"
                              onClick={() => setMemberToRemove(member)}
                              title="Remove member from team"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </ModernButton>
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <h4 className="text-lg font-medium mb-2">No team members</h4>
                        <p className="text-muted-foreground mb-4">
                          Get started by assigning platform members
                        </p>
                        <ModernButton
                          variant="primary"
                          size="sm"
                          onClick={() => setIsMemberAssignmentOpen(true)}
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          Assign Members
                        </ModernButton>
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Quick Actions */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20 p-6"
                >
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-primary" />
                    Quick Actions
                  </h3>
                  <div className="space-y-2">
                    <Link to={`/teams/${teamId}/standups/wizard`} className="block">
                      <ModernButton variant="outline" className="w-full justify-start">
                        <Plus className="w-4 h-4 mr-2" />
                        Create New Standup
                      </ModernButton>
                    </Link>
                    <ModernButton
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() =>
                        toast.info('Export feature coming soon!', {
                          action: {
                            label: 'Request feature',
                            onClick: () => toast.info('Feature request noted!'),
                          },
                        })
                      }
                    >
                      <Target className="w-4 h-4 mr-2" />
                      Export Team Report
                    </ModernButton>
                    <ModernButton
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() =>
                        toast.info('Analytics feature coming soon!', {
                          action: {
                            label: 'Preview demo',
                            onClick: () => toast.info('Demo coming soon!'),
                          },
                        })
                      }
                    >
                      <TrendingUp className="w-4 h-4 mr-2" />
                      View Analytics
                    </ModernButton>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Team Settings Modal */}
      {team && (
        <TeamSettingsModal
          isOpen={isTeamSettingsOpen}
          onClose={() => setIsTeamSettingsOpen(false)}
          onSuccess={handleTeamSettingsSuccess}
          onTeamDeleted={handleTeamDeleted}
          team={team}
        />
      )}

      {/* Team Member Assignment Modal */}
      {team && (
        <TeamMemberAssignmentModal
          isOpen={isMemberAssignmentOpen}
          onClose={() => setIsMemberAssignmentOpen(false)}
          onSuccess={handleMemberAssignmentSuccess}
          team={team}
        />
      )}

      {/* Remove Member Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!memberToRemove}
        onClose={handleCancelRemove}
        onConfirm={handleRemoveMember}
        title="Remove Team Member"
        description={
          memberToRemove
            ? `Are you sure you want to remove ${memberToRemove.name} from ${team?.name}? They will lose access to all team standups and data.`
            : ''
        }
        confirmText="Remove Member"
        cancelText="Cancel"
        isLoading={isRemovingMember}
        loadingText="Removing..."
        variant="danger"
        icon={React.memo(({ className }: { className?: string }) => (
          <motion.div
            animate={{
              rotate: [0, -10, 10, -10, 10, 0],
              scale: [1, 1.1, 1, 1.1, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatDelay: 1,
              ease: 'easeInOut',
            }}
          >
            <Trash2 className={className} />
          </motion.div>
        ))}
      />
    </div>
  );
});
