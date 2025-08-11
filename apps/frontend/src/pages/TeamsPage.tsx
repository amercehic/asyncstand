import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ModernButton } from '@/components/ui';
import { CreateTeamModal } from '@/components/CreateTeamModal';
import { Plus, Users, Settings, Calendar, ArrowRight } from 'lucide-react';
import { useTeams } from '@/contexts';

export const TeamsPage = React.memo(() => {
  const { teams, isLoading, refreshTeams } = useTeams();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
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

  const handleJoinTeam = () => {
    toast.info('Join team functionality - Coming soon!');
  };

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

        {/* Teams Grid */}
        {teams.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {teams.map((team, index) => (
              <motion.div
                key={team.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
                className="bg-card rounded-2xl p-6 border border-border hover:shadow-lg transition-all duration-300 group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-primary to-primary/80 rounded-xl flex items-center justify-center">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{team.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {team.members.length} member{team.members.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <ModernButton
                    variant="ghost"
                    size="sm"
                    onClick={() => toast.info('Team settings - Coming soon!')}
                    data-testid={`team-settings-${team.id}`}
                  >
                    <Settings className="w-4 h-4" />
                  </ModernButton>
                </div>

                {team.description && (
                  <p className="text-muted-foreground mb-4 text-sm">{team.description}</p>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {team.members.slice(0, 3).map((member, memberIndex) => (
                      <div
                        key={member.id}
                        className="w-8 h-8 bg-gradient-to-r from-primary to-primary/80 rounded-full border-2 border-card flex items-center justify-center"
                        style={{ zIndex: team.members.length - memberIndex }}
                      >
                        <span className="text-white font-medium text-xs">
                          {member.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    ))}
                    {team.members.length > 3 && (
                      <div className="w-8 h-8 bg-muted rounded-full border-2 border-card flex items-center justify-center">
                        <span className="text-muted-foreground font-medium text-xs">
                          +{team.members.length - 3}
                        </span>
                      </div>
                    )}
                  </div>

                  <Link to={`/teams/${team.id}`}>
                    <ModernButton
                      variant="ghost"
                      size="sm"
                      className="group-hover:bg-primary/10"
                      data-testid={`view-team-${team.id}`}
                    >
                      View
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </ModernButton>
                  </Link>
                </div>
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
            <Users className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
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

        {/* Quick Stats */}
        {teams.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8"
          >
            <div className="bg-card rounded-2xl p-6 border border-border">
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-5 h-5 text-primary" />
                <span className="font-medium">Total Teams</span>
              </div>
              <p className="text-2xl font-bold text-primary">{teams.length}</p>
            </div>
            <div className="bg-card rounded-2xl p-6 border border-border">
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-5 h-5 text-primary" />
                <span className="font-medium">Total Members</span>
              </div>
              <p className="text-2xl font-bold text-primary">
                {teams.reduce((acc, team) => acc + team.members.length, 0)}
              </p>
            </div>
            <div className="bg-card rounded-2xl p-6 border border-border">
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="w-5 h-5 text-primary" />
                <span className="font-medium">Active Standups</span>
              </div>
              <p className="text-2xl font-bold text-primary">0</p>
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
    </div>
  );
});
