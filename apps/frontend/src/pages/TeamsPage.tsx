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
  ChevronRight,
  Building2,
  Link2,
  Calendar,
  Slack,
  UserCheck,
  Sparkles,
} from 'lucide-react';
import { useTeams } from '@/contexts';
import { toast } from 'sonner';
import type { Team, Standup } from '@/types';
import { standupsApi } from '@/lib/api';

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
            <motion.h1
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl font-bold mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent"
            >
              Your Teams
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-muted-foreground text-lg"
            >
              Manage your teams and collaborate on async standups.
            </motion.p>
          </div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex gap-3"
          >
            <ModernButton
              variant="secondary"
              onClick={handleJoinTeam}
              data-testid="join-team-button"
              className="group"
            >
              <Users className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
              Join Team
            </ModernButton>
            <ModernButton
              variant="primary"
              onClick={handleCreateTeam}
              data-testid="create-team-button"
              className="group shadow-lg shadow-primary/20"
            >
              <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform" />
              Create Team
            </ModernButton>
          </motion.div>
        </motion.div>

        {/* Statistics Dashboard - Modern & Beautiful */}
        {teams.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
          >
            <motion.div
              whileHover={{ y: -2, scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 rounded-lg p-4 border border-blue-200/60 dark:border-blue-800/40 shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/20 transition-shadow group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                </div>
                <p className="text-2xl font-bold text-foreground mb-0.5">{totalTeams}</p>
                <p className="text-xs text-muted-foreground font-medium">Active Teams</p>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ y: -2, scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20 rounded-lg p-4 border border-emerald-200/60 dark:border-emerald-800/40 shadow-md shadow-emerald-500/10 hover:shadow-lg hover:shadow-emerald-500/20 transition-shadow group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                </div>
                <p className="text-2xl font-bold text-foreground mb-0.5">{totalMembers}</p>
                <p className="text-xs text-muted-foreground font-medium">Team Members</p>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ y: -2, scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 rounded-lg p-4 border border-purple-200/60 dark:border-purple-800/40 shadow-md shadow-purple-500/10 hover:shadow-lg hover:shadow-purple-500/20 transition-shadow group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md group-hover:scale-105 transition-transform relative">
                    <Link2 className="w-5 h-5 text-white" />
                    {teamsWithIntegrations > 0 && (
                      <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border border-white dark:border-background" />
                    )}
                  </div>
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" />
                </div>
                <p className="text-2xl font-bold text-foreground mb-0.5">{teamsWithIntegrations}</p>
                <p className="text-xs text-muted-foreground font-medium">With Integration</p>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ y: -2, scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/30 dark:to-orange-900/20 rounded-lg p-4 border border-orange-200/60 dark:border-orange-800/40 shadow-md shadow-orange-500/10 hover:shadow-lg hover:shadow-orange-500/20 transition-shadow group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-orange-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                </div>
                <p className="text-2xl font-bold text-foreground mb-0.5">{averageMembersPerTeam}</p>
                <p className="text-xs text-muted-foreground font-medium">Avg Team Size</p>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Teams Table */}
        {teams.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-card rounded-lg border border-border overflow-visible"
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
                  className="px-6 py-4 hover:bg-muted/30 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/teams/${team.id}`)}
                >
                  <div className="grid grid-cols-12 gap-4 items-center">
                    {/* Team Name & Description */}
                    <div className="col-span-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-white" />
                          </div>
                          {(teamStandups[team.id] || []).some(s => s.isActive) && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background animate-pulse" />
                          )}
                        </div>
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
                              className="w-6 h-6 bg-primary rounded-full border-2 border-card flex items-center justify-center"
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
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                            <Slack className="w-4 h-4 text-white" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">
                              #{team.channel.name}
                            </span>
                            <span className="text-xs text-green-600">Connected</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-muted border border-dashed border-muted-foreground/30 rounded-lg flex items-center justify-center">
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
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                                <Calendar className="w-4 h-4 text-white" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-foreground">
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
                          return (
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center">
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
                          return (
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-muted border border-dashed border-muted-foreground/20 rounded-lg flex items-center justify-center">
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
                              onClick={e => e.stopPropagation()}
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="bg-gradient-to-br from-card to-card/80 rounded-xl p-12 border border-border/50 text-center relative overflow-hidden shadow-lg"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 opacity-50" />
            <motion.div
              animate={{
                y: [0, -8, 0],
                scale: [1, 1.02, 1],
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
