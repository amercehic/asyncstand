import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ModernButton, Dropdown } from '@/components/ui';
import { CreateTeamModal } from '@/components/CreateTeamModal';
import { TeamSettingsModal } from '@/components/TeamSettingsModal';
import {
  Plus,
  Users,
  Hash,
  TrendingUp,
  Users2,
  MoreVertical,
  Eye,
  Settings,
  Calendar,
} from 'lucide-react';
import { useTeams } from '@/contexts';
import { toast } from 'sonner';
import type { Team } from '@/types';

export const TeamsPage = React.memo(() => {
  const { teams, isLoading, refreshTeams } = useTeams();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedTeamForSettings, setSelectedTeamForSettings] = useState<Team | null>(null);
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
  const teamsWithChannels = teams.filter(team => team.channel).length;
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
            <div className="bg-card rounded-xl p-6 border border-border">
              <div className="flex items-center gap-3 mb-3">
                <Users2 className="w-10 h-10 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{totalTeams}</p>
                  <p className="text-sm text-muted-foreground">Total Teams</p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl p-6 border border-border">
              <div className="flex items-center gap-3 mb-3">
                <Users className="w-10 h-10 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{totalMembers}</p>
                  <p className="text-sm text-muted-foreground">Total Members</p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl p-6 border border-border">
              <div className="flex items-center gap-3 mb-3">
                <Hash className="w-10 h-10 text-purple-600" />
                <div>
                  <p className="text-2xl font-bold">{teamsWithChannels}</p>
                  <p className="text-sm text-muted-foreground">With Slack</p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl p-6 border border-border">
              <div className="flex items-center gap-3 mb-3">
                <TrendingUp className="w-10 h-10 text-orange-600" />
                <div>
                  <p className="text-2xl font-bold">{averageMembersPerTeam}</p>
                  <p className="text-sm text-muted-foreground">Avg per Team</p>
                </div>
              </div>
            </div>
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
                        <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center">
                          <span className="text-white font-medium text-sm">
                            {team.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            {team.name}
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
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-green-500/10 rounded-md flex items-center justify-center">
                            <Hash className="w-3 h-3 text-green-600" />
                          </div>
                          <span className="text-sm font-medium">#{team.channel.name}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-muted rounded-md flex items-center justify-center">
                            <Hash className="w-3 h-3 text-muted-foreground" />
                          </div>
                          <span className="text-sm text-muted-foreground">Not connected</span>
                        </div>
                      )}
                    </div>

                    {/* Standups */}
                    <div className="col-span-2">
                      {team.standupConfig ? (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-medium text-green-700">Active</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {team.standupConfig.weekdays.length === 5 &&
                            team.standupConfig.weekdays.includes(1) &&
                            team.standupConfig.weekdays.includes(5)
                              ? 'Weekdays'
                              : `${team.standupConfig.weekdays.length} days`}
                            • {team.standupConfig.timeLocal}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">No standups</span>
                        </div>
                      )}
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
            className="bg-card rounded-xl p-12 border border-border text-center"
          >
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users2 className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-3">No Teams Yet</h3>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Get started by creating your first team or joining an existing one to begin
              collaborating on async standups.
            </p>
            <div className="flex gap-4 justify-center">
              <ModernButton
                variant="secondary"
                onClick={handleJoinTeam}
                data-testid="empty-join-team-button"
              >
                <Users className="w-4 h-4 mr-2" />
                Join Team
              </ModernButton>
              <ModernButton
                variant="primary"
                onClick={handleCreateTeam}
                data-testid="empty-create-team-button"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Team
              </ModernButton>
            </div>
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
