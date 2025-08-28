import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ModernButton, ConfirmationModal, Dropdown } from '@/components/ui';
import {
  ArrowLeft,
  Settings,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  UserPlus,
  Users,
  Trash2,
  Building2,
  Calendar,
  Activity,
  BarChart3,
  MoreVertical,
  Edit,
  Archive,
} from 'lucide-react';
import { toast } from '@/components/ui';
import { teamsApi, standupsApi } from '@/lib/api';
import type { Team, StandupConfig, StandupInstance } from '@/types';
import type { AxiosError } from 'axios';
import { TeamSettingsModal } from '@/components/TeamSettingsModal';
import { ActiveStandupsList } from '@/components/ActiveStandupsList';
import { TeamMemberAssignmentModal } from '@/components/TeamMemberAssignmentModal';
import { useTeams } from '@/contexts';

type TabType = 'overview' | 'members' | 'standups' | 'settings';

export const TeamDetailPage = React.memo(() => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { deleteTeam, getTeamByIdFromCache } = useTeams();
  const [team, setTeam] = useState<Team | null>(null);
  const [standups, setStandups] = useState<StandupConfig[]>([]);
  const [recentInstances, setRecentInstances] = useState<StandupInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTeamSettingsOpen, setIsTeamSettingsOpen] = useState(false);
  const [isMemberAssignmentOpen, setIsMemberAssignmentOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<Team['members'][0] | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const tabFromUrl = searchParams.get('tab') as TabType;
    return tabFromUrl && ['overview', 'members', 'standups', 'settings'].includes(tabFromUrl)
      ? tabFromUrl
      : 'overview';
  });
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);

  const handleTabChange = useCallback(
    (tab: TabType) => {
      setActiveTab(tab);
      // Update URL to reflect current tab
      const newSearchParams = new URLSearchParams(searchParams);
      if (tab === 'overview') {
        // Remove tab param for overview since it's the default
        newSearchParams.delete('tab');
      } else {
        newSearchParams.set('tab', tab);
      }
      setSearchParams(newSearchParams);
    },
    [searchParams, setSearchParams]
  );

  // Function to fetch only standups data (for refreshing after deletion)
  const fetchStandupsOnly = useCallback(async () => {
    if (!teamId) return;

    try {
      const [standupsData, instancesData] = await Promise.all([
        standupsApi.getTeamStandups(teamId),
        standupsApi.getStandupInstances(teamId),
      ]);
      setStandups(standupsData);
      setRecentInstances(instancesData.slice(0, 10));
    } catch (error) {
      console.error('Error fetching standups:', error);
    }
  }, [teamId]);

  // Function to fetch all data
  const fetchData = useCallback(async () => {
    if (!teamId || isDeleted) return;

    // Try to get team from cache first for faster loading (basic info only)
    const cachedTeam = getTeamByIdFromCache(teamId);
    if (cachedTeam) {
      setTeam(cachedTeam);
      setIsLoading(false); // Show basic team info immediately from cache
    } else {
      setIsLoading(true);
    }

    try {
      // Always fetch full team details in background (includes members and standups)
      const [teamData, standupsData, instancesData] = await Promise.all([
        teamsApi.getTeam(teamId), // Full team details with members
        standupsApi.getTeamStandups(teamId),
        standupsApi.getStandupInstances(teamId),
      ]);

      // Update with complete team data (will show members)
      setTeam(teamData);
      setStandups(standupsData);
      setRecentInstances(instancesData.slice(0, 10));
    } catch (error) {
      console.error('Error fetching team data:', error);
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) {
        // Don't show error toast if we're already on teams page (might be from navigation after deletion)
        if (window.location.pathname !== '/teams') {
          toast.error('Team not found');
        }
        navigate('/teams', { replace: true });
      } else {
        toast.error('Failed to load team data');
      }
    } finally {
      setIsLoading(false);
    }
  }, [teamId, navigate, getTeamByIdFromCache, isDeleted]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activeStandups = useMemo(() => standups.filter(s => s.isActive), [standups]);

  const teamStats = useMemo(() => {
    const totalInstances = recentInstances.length;
    const completedInstances = recentInstances.filter(i => i.status === 'completed').length;
    const completionRate =
      totalInstances > 0 ? Math.round((completedInstances / totalInstances) * 100) : 0;

    return {
      totalMembers: team?.members.length || 0,
      activeCount: activeStandups.length,
      completionRate,
      hasChannelStandups: activeStandups.some(s => s.deliveryType === 'channel'),
      healthScore: Math.min(
        100,
        completionRate + (activeStandups.length > 0 ? 30 : 0) + (team?.members.length || 0) * 5
      ),
    };
  }, [team, activeStandups, recentInstances]);

  const handleTeamUpdate = async () => {
    console.log('handleTeamUpdate called - refreshing team data');
    await fetchData();
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove || !team) return;

    setIsRemovingMember(true);
    try {
      await teamsApi.removeUser(team.id, memberToRemove.id);
      await fetchData();
      toast.success('Member removed successfully');
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

  const handleDeleteTeam = async () => {
    if (!team || deleteConfirmationText !== team.name) {
      toast.error('Please type the team name exactly to confirm deletion');
      return;
    }

    setIsDeleting(true);
    try {
      await deleteTeam(team.id, true);
      setIsDeleted(true); // Mark as deleted to prevent further API calls
      // Toast already shown by TeamsContext
      navigate('/teams', { replace: true });
    } catch (error) {
      console.error('Error deleting team:', error);
      // Don't show toast here, TeamsContext will handle the error toast
      setIsDeleting(false);
    }
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

  // Tab component data
  const tabs = [
    { id: 'overview' as TabType, label: 'Overview', icon: BarChart3 },
    { id: 'members' as TabType, label: 'Members', icon: Users },
    { id: 'standups' as TabType, label: 'Standups', icon: Calendar },
    { id: 'settings' as TabType, label: 'Settings', icon: Settings },
  ];

  if (isLoading || !team) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading team...</p>
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
          {/* Back button */}
          <button
            onClick={() => navigate('/teams')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Teams
          </button>

          {/* Team header */}
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 flex-shrink-0"
              >
                <Building2 className="w-8 h-8 text-white" />
              </motion.div>
              <div className="min-w-0 flex-1">
                <h1 className="text-3xl font-bold mb-1 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent break-words">
                  {team.name}
                </h1>
                {team.description && (
                  <p className="text-muted-foreground mb-2">{team.description}</p>
                )}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{team.members.length} members</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>Created {new Date(team.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action menu */}
            <div className="flex-shrink-0">
              <Dropdown
                trigger={
                  <ModernButton variant="outline" className="gap-2">
                    <MoreVertical className="w-4 h-4" />
                    Actions
                  </ModernButton>
                }
                items={[
                  {
                    label: 'Edit Team',
                    icon: Edit,
                    onClick: () => setIsTeamSettingsOpen(true),
                  },
                  {
                    label: 'Archive Team',
                    icon: Archive,
                    onClick: () => toast.info('Archive team coming soon!'),
                    className: 'text-orange-600',
                  },
                ]}
              />
            </div>
          </div>

          {/* Tab navigation */}
          <div className="border-b border-border">
            <nav className="flex space-x-8">
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </motion.div>

        {/* Tab content */}
        <div className="mt-6">
          {activeTab === 'overview' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              {/* Team Statistics - Modern Glass Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500/10 via-blue-600/5 to-transparent backdrop-blur-xl border border-blue-500/20 p-6"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl" />
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                        <Users className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground font-medium">Team Members</p>
                        <p className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-blue-600 bg-clip-text text-transparent">
                          {teamStats.totalMembers}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                      Active members
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-600/5 to-transparent backdrop-blur-xl border border-emerald-500/20 p-6"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
                        <Calendar className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground font-medium">Active Standups</p>
                        <p className="text-3xl font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 bg-clip-text text-transparent">
                          {teamStats.activeCount}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      Running now
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500/10 via-purple-600/5 to-transparent backdrop-blur-xl border border-purple-500/20 p-6"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl" />
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/25">
                        <Activity className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground font-medium">Completion Rate</p>
                        <p className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-purple-600 bg-clip-text text-transparent">
                          {teamStats.completionRate}%
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                      Last 30 days
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Quick Actions - Modern Gradient Buttons */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setIsMemberAssignmentOpen(true)}
                    className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 backdrop-blur-sm border border-border/50 p-4 text-left transition-all hover:border-blue-500/50"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-blue-600/0 group-hover:from-blue-500/10 group-hover:to-blue-600/10 transition-all duration-300" />
                    <div className="relative flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500/10 group-hover:bg-blue-500/20 rounded-lg flex items-center justify-center transition-all">
                        <UserPlus className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Manage Members</p>
                        <p className="text-xs text-muted-foreground">Add or remove team members</p>
                      </div>
                    </div>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(`/teams/${teamId}/standups/wizard`)}
                    className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 backdrop-blur-sm border border-border/50 p-4 text-left transition-all hover:border-emerald-500/50"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-emerald-600/0 group-hover:from-emerald-500/10 group-hover:to-emerald-600/10 transition-all duration-300" />
                    <div className="relative flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-500/10 group-hover:bg-emerald-500/20 rounded-lg flex items-center justify-center transition-all">
                        <Plus className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Create Standup</p>
                        <p className="text-xs text-muted-foreground">Start a new standup routine</p>
                      </div>
                    </div>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleTabChange('settings')}
                    className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-600/5 backdrop-blur-sm border border-border/50 p-4 text-left transition-all hover:border-purple-500/50"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-purple-600/0 group-hover:from-purple-500/10 group-hover:to-purple-600/10 transition-all duration-300" />
                    <div className="relative flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-500/10 group-hover:bg-purple-500/20 rounded-lg flex items-center justify-center transition-all">
                        <Settings className="w-5 h-5 text-purple-500" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Team Settings</p>
                        <p className="text-xs text-muted-foreground">Configure team preferences</p>
                      </div>
                    </div>
                  </motion.button>
                </div>
              </div>

              {/* Recent Activity - Modern Timeline */}
              {recentInstances.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-6 top-8 bottom-0 w-px bg-gradient-to-b from-border via-border to-transparent" />

                    <div className="space-y-4">
                      {recentInstances.slice(0, 5).map((instance, index) => {
                        const standupConfig = standups.find(s => s.id === instance.configId);
                        const isCompleted = instance.status === 'completed';
                        const isActive = instance.status === 'active';

                        return (
                          <motion.div
                            key={instance.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="relative flex items-center gap-4 group"
                          >
                            {/* Timeline node */}
                            <div className="relative z-10">
                              <div
                                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                                  isCompleted
                                    ? 'bg-gradient-to-br from-green-500/20 to-green-600/10 group-hover:from-green-500/30 group-hover:to-green-600/20'
                                    : isActive
                                      ? 'bg-gradient-to-br from-blue-500/20 to-blue-600/10 group-hover:from-blue-500/30 group-hover:to-blue-600/20'
                                      : 'bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 group-hover:from-yellow-500/30 group-hover:to-yellow-600/20'
                                }`}
                              >
                                {getStatusIcon(instance.status)}
                              </div>
                              {index === 0 && (
                                <div className="absolute inset-0 rounded-xl animate-ping bg-primary/20" />
                              )}
                            </div>

                            {/* Content card */}
                            <div className="flex-1 bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-4 transition-all group-hover:border-border group-hover:bg-card/80">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="font-medium text-sm flex items-center gap-2">
                                    {standupConfig?.name || 'Daily Standup'}
                                    {isActive && (
                                      <span className="px-2 py-0.5 text-xs bg-blue-500/10 text-blue-500 rounded-full font-medium">
                                        In Progress
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {new Date(instance.createdAt).toLocaleDateString('en-US', {
                                      weekday: 'short',
                                      month: 'short',
                                      day: 'numeric',
                                    })}{' '}
                                    at{' '}
                                    {new Date(instance.createdAt).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </p>
                                </div>
                                <div
                                  className={`text-xs px-3 py-1 rounded-full font-medium ${
                                    isCompleted
                                      ? 'bg-green-500/10 text-green-500'
                                      : isActive
                                        ? 'bg-blue-500/10 text-blue-500'
                                        : 'bg-yellow-500/10 text-yellow-500'
                                  }`}
                                >
                                  {instance.status}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>

                    {recentInstances.length > 5 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="mt-6 text-center"
                      >
                        <button
                          onClick={() => handleTabChange('standups')}
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                        >
                          View all activity
                          <ArrowLeft className="w-4 h-4 rotate-180" />
                        </button>
                      </motion.div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'members' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold">Team Members ({team.members.length})</h3>
                  <ModernButton onClick={() => setIsMemberAssignmentOpen(true)} className="gap-2">
                    <UserPlus className="w-4 h-4" />
                    Manage Members
                  </ModernButton>
                </div>

                <div className="space-y-4">
                  {team.members.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No team members yet</p>
                      <p className="text-xs mt-1">Click "Manage Members" to add team members</p>
                    </div>
                  ) : (
                    team.members.map(member => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center">
                            <span className="text-white font-medium text-sm">
                              {member.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{member.name}</p>
                            <p className="text-sm text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium capitalize">
                            {member.role}
                          </span>
                          <ModernButton
                            variant="ghost"
                            size="sm"
                            onClick={() => setMemberToRemove(member)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </ModernButton>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'standups' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <ActiveStandupsList teamId={teamId!} onStandupsChange={fetchStandupsOnly} from={`/teams/${teamId}`} />
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="space-y-6">
                <div className="bg-card border border-border rounded-xl p-6">
                  <h3 className="text-lg font-semibold mb-4">Team Preferences</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Notification Settings</p>
                        <p className="text-sm text-muted-foreground">
                          Configure team notifications
                        </p>
                      </div>
                      <ModernButton
                        variant="outline"
                        onClick={() => toast.info('Coming soon!')}
                        className="w-24"
                      >
                        Configure
                      </ModernButton>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Access Control</p>
                        <p className="text-sm text-muted-foreground">Manage team permissions</p>
                      </div>
                      <ModernButton
                        variant="outline"
                        onClick={() => toast.info('Coming soon!')}
                        className="w-24"
                      >
                        Manage
                      </ModernButton>
                    </div>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-6">
                  <h3 className="text-lg font-semibold mb-4">Danger Zone</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Archive Team</p>
                        <p className="text-sm text-muted-foreground">
                          Archive this team and all its data
                        </p>
                      </div>
                      <ModernButton
                        variant="outline"
                        onClick={() => toast.info('Archive team coming soon!')}
                        className="w-24 text-orange-600 border-orange-300 hover:bg-orange-600 hover:text-white hover:border-orange-600"
                      >
                        Archive
                      </ModernButton>
                    </div>

                    {!showDeleteConfirmation ? (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Delete Team</p>
                          <p className="text-sm text-muted-foreground">
                            Permanently delete this team and all its data
                          </p>
                        </div>
                        <ModernButton
                          variant="outline"
                          onClick={() => setShowDeleteConfirmation(true)}
                          disabled={isDeleting}
                          className="w-24 text-red-600 border-red-300 hover:bg-red-600 hover:text-white hover:border-red-600"
                        >
                          Delete
                        </ModernButton>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <p className="font-medium text-red-600 mb-2">Are you absolutely sure?</p>
                          <p className="text-sm text-muted-foreground mb-4">
                            This will permanently delete the{' '}
                            <span className="font-medium text-foreground">{team?.name}</span> team,
                            all of its standups, and remove all team members. This action cannot be
                            undone.
                          </p>
                          <p className="text-sm text-muted-foreground mb-3">
                            Please type{' '}
                            <span className="font-mono bg-muted px-1 py-0.5 rounded text-foreground">
                              {team?.name}
                            </span>{' '}
                            to confirm.
                          </p>
                        </div>
                        <input
                          type="text"
                          value={deleteConfirmationText}
                          onChange={e => setDeleteConfirmationText(e.target.value)}
                          placeholder="Type team name here"
                          className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                          disabled={isDeleting}
                        />
                        <div className="flex gap-3">
                          <ModernButton
                            variant="outline"
                            onClick={() => {
                              setShowDeleteConfirmation(false);
                              setDeleteConfirmationText('');
                            }}
                            disabled={isDeleting}
                          >
                            Cancel
                          </ModernButton>
                          <ModernButton
                            variant="destructive"
                            onClick={handleDeleteTeam}
                            disabled={isDeleting || deleteConfirmationText !== team?.name}
                          >
                            {isDeleting ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                                Deleting...
                              </>
                            ) : (
                              <>
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Team
                              </>
                            )}
                          </ModernButton>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Modals */}
        <TeamSettingsModal
          isOpen={isTeamSettingsOpen}
          onClose={() => setIsTeamSettingsOpen(false)}
          team={team}
          onSuccess={handleTeamUpdate}
        />

        <TeamMemberAssignmentModal
          isOpen={isMemberAssignmentOpen}
          onClose={() => setIsMemberAssignmentOpen(false)}
          team={team}
          onSuccess={handleTeamUpdate}
        />

        <ConfirmationModal
          isOpen={!!memberToRemove}
          onClose={handleCancelRemove}
          onConfirm={handleRemoveMember}
          title="Remove Team Member"
          description={`Are you sure you want to remove ${memberToRemove?.name} from the team? This action cannot be undone.`}
          confirmText="Remove Member"
          isLoading={isRemovingMember}
          variant="danger"
        />
      </main>
    </div>
  );
});
