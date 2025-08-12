import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ModernButton, Dropdown } from '@/components/ui';
import { CreateTeamModal } from '@/components/CreateTeamModal';
import { TeamSettingsModal } from '@/components/TeamSettingsModal';
import {
  Plus,
  Users,
  MoreVertical,
  Eye,
  Settings,
  Calendar,
  Sparkles,
  Building2,
  UserCheck,
  Activity,
  Shield,
  Award,
  Target,
  Rocket,
  ChevronRight,
  CheckCircle2,
  Link2,
  Globe,
  MessageCircle,
} from 'lucide-react';
import { useTeams } from '@/contexts';
import { toast } from 'sonner';
import type { Team, Standup } from '@/types';
import { standupsApi } from '@/lib/api';

// Helper function to get platform icon based on integration type
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getPlatformIcon = (team: Team) => {
  // TODO: When platform field is added to Team type, use it to return specific icons:
  // if (team.integration?.platform === 'slack') return Slack;
  // if (team.integration?.platform === 'teams') return Users;
  // if (team.integration?.platform === 'discord') return MessageCircle;

  // For now, return a generic communication icon for all integrations
  return MessageCircle;
};

export const TeamsPage = React.memo(() => {
  const { teams, isLoading, refreshTeams } = useTeams();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedTeamForSettings, setSelectedTeamForSettings] = useState<Team | null>(null);
  const [teamStandups, setTeamStandups] = useState<Record<string, Standup[]>>({});
  const location = useLocation();
  const navigate = useNavigate();

  // Auto-open create modal if query param present: ?create=1
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const shouldOpen = searchParams.get('create') === '1';
    if (shouldOpen) {
      setIsCreateModalOpen(true);
      // Clean the URL so refresh/back doesn't keep reopening
      navigate(location.pathname, { replace: true });
    }
  }, [location.search, location.pathname, navigate]);

  // Fetch standups for all teams
  useEffect(() => {
    const fetchAllStandups = async () => {
      if (teams.length === 0) return;

      const standupsMap: Record<string, Standup[]> = {};

      // Fetch standups for each team in parallel
      const promises = teams.map(async team => {
        try {
          const standups = await standupsApi.getTeamStandups(team.id);
          return { teamId: team.id, standups };
        } catch (error) {
          console.error(`Error fetching standups for team ${team.id}:`, error);
          return { teamId: team.id, standups: [] };
        }
      });

      const results = await Promise.all(promises);
      results.forEach(({ teamId, standups }) => {
        standupsMap[teamId] = standups;
      });

      setTeamStandups(standupsMap);
    };

    fetchAllStandups();
  }, [teams]);

  const handleCreateTeam = () => {
    setIsCreateModalOpen(true);
  };

  const handleCreateSuccess = async () => {
    // Refresh teams list after successful creation
    await refreshTeams();
  };

  const handleTeamSettings = (team: Team) => {
    setSelectedTeamForSettings(team);
    setIsSettingsModalOpen(true);
  };

  const handleSettingsSuccess = async () => {
    // Refresh teams list after successful update
    await refreshTeams();
  };

  const handleJoinTeam = () => {
    toast.info('Join team functionality - Coming soon!');
  };

  // Calculate statistics
  const totalTeams = teams.length;
  const totalMembers = teams.reduce((acc, team) => acc + team.members.length, 0);
  const teamsWithIntegrations = teams.filter(team => team.channel).length;
  const averageMembersPerTeam = totalTeams > 0 ? Math.round(totalMembers / totalTeams) : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading teams...</p>
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
            <h1 className="text-3xl font-bold mb-2">Your Teams</h1>
            <p className="text-muted-foreground text-lg">
              Manage your teams and collaborate on async standups.
            </p>
          </div>
          <div className="flex gap-3">
            <ModernButton
              variant="secondary"
              onClick={handleJoinTeam}
              data-testid="join-team-button"
            >
              <Users className="w-4 h-4 mr-2" />
              Join Team
            </ModernButton>
            <ModernButton
              variant="primary"
              onClick={handleCreateTeam}
              data-testid="create-team-button"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Team
            </ModernButton>
          </div>
        </motion.div>

        {/* Statistics Dashboard */}
        {teams.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
          >
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-blue-50/50 to-blue-100/30 dark:from-blue-950/20 dark:to-blue-900/10 rounded-xl p-6 border border-blue-200/50 dark:border-blue-800/30 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:shadow-xl group-hover:shadow-blue-500/30 transition-shadow">
                  <Building2 className="w-7 h-7 text-white" />
                </div>
                <div>
                  <motion.p
                    className="text-3xl font-bold text-foreground"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    {totalTeams}
                  </motion.p>
                  <p className="text-sm text-muted-foreground font-medium">Active Teams</p>
                </div>
                <Sparkles className="w-4 h-4 text-blue-500 absolute top-4 right-4 opacity-40" />
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-emerald-50/50 to-emerald-100/30 dark:from-emerald-950/20 dark:to-emerald-900/10 rounded-xl p-6 border border-emerald-200/50 dark:border-emerald-800/30 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/25 group-hover:shadow-xl group-hover:shadow-emerald-500/30 transition-shadow">
                  <UserCheck className="w-7 h-7 text-white" />
                </div>
                <div>
                  <motion.p
                    className="text-3xl font-bold text-foreground"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                  >
                    {totalMembers}
                  </motion.p>
                  <p className="text-sm text-muted-foreground font-medium">Team Members</p>
                </div>
                <Award className="w-4 h-4 text-emerald-500 absolute top-4 right-4 opacity-40" />
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-purple-50/50 to-purple-100/30 dark:from-purple-950/20 dark:to-purple-900/10 rounded-xl p-6 border border-purple-200/50 dark:border-purple-800/30 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/25 group-hover:shadow-xl group-hover:shadow-purple-500/30 transition-shadow relative">
                  <Link2 className="w-7 h-7 text-white" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-background animate-pulse" />
                </div>
                <div>
                  <motion.p
                    className="text-3xl font-bold text-foreground"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    {teamsWithIntegrations}
                  </motion.p>
                  <p className="text-sm text-muted-foreground font-medium">With Integration</p>
                </div>
                <Globe className="w-4 h-4 text-purple-500 absolute top-4 right-4 opacity-40" />
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-orange-50/50 to-orange-100/30 dark:from-orange-950/20 dark:to-orange-900/10 rounded-xl p-6 border border-orange-200/50 dark:border-orange-800/30 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-orange-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/25 group-hover:shadow-xl group-hover:shadow-orange-500/30 transition-shadow">
                  <Activity className="w-7 h-7 text-white" />
                </div>
                <div>
                  <motion.p
                    className="text-3xl font-bold text-foreground"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                  >
                    {averageMembersPerTeam}
                  </motion.p>
                  <p className="text-sm text-muted-foreground font-medium">Avg Size</p>
                </div>
                <Target className="w-4 h-4 text-orange-500 absolute top-4 right-4 opacity-40" />
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Teams Table/List */}
        {teams.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-card rounded-xl border border-border overflow-visible"
          >
            {/* Table Header */}
            <div className="px-6 py-4 border-b border-border bg-muted/30">
              <div className="grid grid-cols-12 gap-4 items-center text-sm font-medium text-muted-foreground">
                <div className="col-span-4">Team</div>
                <div className="col-span-2">Members</div>
                <div className="col-span-2">Integration</div>
                <div className="col-span-2">Standups</div>
                <div className="col-span-2 text-center">Actions</div>
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-border">
              {teams.map((team, index) => (
                <motion.div
                  key={team.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 + index * 0.05 }}
                  className="px-6 py-4 hover:bg-muted/20 transition-colors group cursor-pointer"
                  onClick={() => navigate(`/teams/${team.id}`)}
                >
                  <div className="grid grid-cols-12 gap-4 items-center">
                    {/* Team Name & Description */}
                    <div className="col-span-4">
                      <div className="flex items-center gap-3">
                        <motion.div
                          whileHover={{ rotate: [0, -5, 5, 0] }}
                          transition={{ duration: 0.3 }}
                          className="relative"
                        >
                          <div className="w-12 h-12 bg-gradient-to-br from-primary via-primary/90 to-primary/70 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 group-hover:shadow-xl group-hover:shadow-primary/30 transition-all">
                            <Shield className="w-6 h-6 text-white" />
                          </div>
                          {(teamStandups[team.id] || []).some(s => s.isActive) && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background animate-pulse" />
                          )}
                        </motion.div>
                        <div>
                          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                            {team.name}
                            <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </h3>
                          {team.description && (
                            <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                              {team.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Members */}
                    <div className="col-span-2">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-1">
                          {team.members.slice(0, 3).map((member, memberIndex) => (
                            <div
                              key={member.id}
                              className="w-6 h-6 bg-gradient-to-br from-primary to-primary/80 rounded-full border-2 border-card flex items-center justify-center"
                              style={{ zIndex: team.members.length - memberIndex }}
                            >
                              <span className="text-white font-medium text-xs">
                                {member.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          ))}
                          {team.members.length > 3 && (
                            <div className="w-6 h-6 bg-muted rounded-full border-2 border-card flex items-center justify-center">
                              <span className="text-muted-foreground font-medium text-xs">
                                +{team.members.length - 3}
                              </span>
                            </div>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">{team.members.length}</span>
                      </div>
                    </div>

                    {/* Integration */}
                    <div className="col-span-2">
                      {team.channel ? (
                        (() => {
                          const PlatformIcon = getPlatformIcon(team);
                          return (
                            <div className="flex items-center gap-2">
                              <motion.div whileHover={{ scale: 1.1 }} className="relative">
                                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center shadow-md shadow-purple-500/20">
                                  <PlatformIcon className="w-4 h-4 text-white" />
                                </div>
                                <div className="absolute -bottom-1 -right-1">
                                  <CheckCircle2 className="w-4 h-4 text-green-500 fill-green-500 bg-background rounded-full" />
                                </div>
                              </motion.div>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-foreground">
                                  #{team.channel.name}
                                </span>
                                <span className="text-xs text-green-600 flex items-center gap-1">
                                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                  Connected
                                </span>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-muted/50 border border-dashed border-muted-foreground/30 rounded-lg flex items-center justify-center">
                            <Link2 className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">No integration</span>
                            <span className="text-xs text-muted-foreground/70">Optional</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Standups */}
                    <div className="col-span-2">
                      {(() => {
                        const standups = teamStandups[team.id] || [];
                        const activeStandups = standups.filter(s => s.isActive);

                        if (activeStandups.length > 0) {
                          return (
                            <div className="flex items-center gap-3">
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                                className="relative"
                              >
                                <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center shadow-md shadow-green-500/20">
                                  <Rocket className="w-4 h-4 text-white" />
                                </div>
                                {activeStandups.length > 1 && (
                                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-background">
                                    {activeStandups.length}
                                  </div>
                                )}
                              </motion.div>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-foreground flex items-center gap-1">
                                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                  {activeStandups.length === 1
                                    ? 'Active'
                                    : `${activeStandups.length} Active`}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {standups.length === activeStandups.length
                                    ? `${standups.length} standup${standups.length > 1 ? 's' : ''}`
                                    : `${standups.length} total, ${activeStandups.length} active`}
                                </span>
                              </div>
                            </div>
                          );
                        } else if (standups.length > 0) {
                          // Has standups but none are active
                          return (
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-yellow-500/10 rounded-lg flex items-center justify-center">
                                <Calendar className="w-4 h-4 text-yellow-600" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm text-muted-foreground">
                                  {standups.length} Paused
                                </span>
                                <span className="text-xs text-muted-foreground/70">Activate →</span>
                              </div>
                            </div>
                          );
                        } else {
                          // No standups at all
                          return (
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-muted/30 rounded-lg flex items-center justify-center border border-dashed border-muted-foreground/20">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm text-muted-foreground">No standups</span>
                                <span className="text-xs text-muted-foreground/70">
                                  Configure →
                                </span>
                              </div>
                            </div>
                          );
                        }
                      })()}
                    </div>

                    {/* Actions */}
                    <div className="col-span-2">
                      <div className="flex items-center justify-center gap-2">
                        <ModernButton
                          variant="ghost"
                          size="sm"
                          onClick={e => {
                            e.stopPropagation();
                            navigate(`/teams/${team.id}`);
                          }}
                          data-testid={`view-team-${team.id}`}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </ModernButton>
                        <Dropdown
                          trigger={
                            <ModernButton
                              variant="ghost"
                              size="sm"
                              data-testid={`team-actions-${team.id}`}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </ModernButton>
                          }
                          items={[
                            {
                              label: 'Team Settings',
                              icon: Settings,
                              onClick: () => handleTeamSettings(team),
                            },
                            {
                              label: 'View Standups',
                              icon: Calendar,
                              onClick: () => navigate(`/teams/${team.id}`),
                            },
                            {
                              label: 'Create Standup',
                              icon: Plus,
                              onClick: () => navigate(`/teams/${team.id}/standups/create`),
                            },
                          ]}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="bg-gradient-to-br from-card to-card/50 rounded-2xl p-12 border border-border text-center relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 opacity-50" />
            <motion.div
              animate={{
                y: [0, -10, 0],
                rotate: [0, 5, 0],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                repeatType: 'reverse',
              }}
              className="relative z-10"
            >
              <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary/70 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary/20">
                <Building2 className="w-10 h-10 text-white" />
              </div>
            </motion.div>
            <h3 className="text-2xl font-bold mb-3 relative z-10">Start Your Journey</h3>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto relative z-10">
              Create your first team to unlock the power of async standups. Connect with Slack, set
              up daily check-ins, and boost team collaboration.
            </p>
            <div className="flex gap-4 justify-center relative z-10">
              <ModernButton
                variant="secondary"
                onClick={handleJoinTeam}
                data-testid="empty-join-team-button"
                className="group"
              >
                <UserCheck className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                Join Existing Team
              </ModernButton>
              <ModernButton
                variant="primary"
                onClick={handleCreateTeam}
                data-testid="empty-create-team-button"
                className="group shadow-lg shadow-primary/20"
              >
                <Sparkles className="w-4 h-4 mr-2 group-hover:rotate-12 transition-transform" />
                Create Your Team
              </ModernButton>
            </div>
            <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute -top-4 -left-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
          </motion.div>
        )}
      </main>

      {/* Create Team Modal */}
      <CreateTeamModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Team Settings Modal */}
      {selectedTeamForSettings && (
        <TeamSettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => {
            setIsSettingsModalOpen(false);
            setSelectedTeamForSettings(null);
          }}
          onSuccess={handleSettingsSuccess}
          team={selectedTeamForSettings}
        />
      )}
    </div>
  );
});
