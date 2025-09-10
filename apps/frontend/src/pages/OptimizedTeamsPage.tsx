import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ModernButton, Dropdown, OptimizedVirtualList } from '@/components/ui';
import { CreateTeamModal } from '@/components/CreateTeamModal';
import { TeamSettingsModal } from '@/components/TeamSettingsModal';
import {
  Plus,
  Users,
  Eye,
  Settings,
  Building2,
  Link2,
  Calendar,
  Slack,
  Search,
  Filter,
  SortAsc,
  Star,
} from 'lucide-react';
import { useTeams } from '@/contexts';
import { toast } from '@/components/ui';
import { useOptimizedQuery } from '@/hooks';
import type { Team, Standup } from '@/types';
import { standupsApi } from '@/lib/api';

// Types
type SortOption = 'name' | 'members' | 'activity' | 'created';
type FilterOption = 'all' | 'active' | 'integrated' | 'no-integration' | 'favorites';

interface TeamCardProps {
  team: Team;
  standups: Standup[];
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onView: () => void;
  onSettings: () => void;
  onCreateStandup: () => void;
  index?: number;
}

// Optimized Team Card Component
const OptimizedTeamCard = React.memo<TeamCardProps>(
  ({
    team,
    standups,
    isFavorite,
    onToggleFavorite,
    onView,
    onSettings,
    onCreateStandup,
    index = 0,
  }) => {
    // Memoized calculations for performance
    const activeStandups = useMemo(() => standups.filter(s => s.isActive), [standups]);

    const healthScore = useMemo(() => {
      let score = 50; // Base score
      if (activeStandups.length > 0) score += 30;
      if (activeStandups.some(s => s.deliveryType === 'channel')) score += 10;
      score += Math.min(10, (team.memberCount || team.members.length) * 2);
      return Math.min(100, score);
    }, [team, activeStandups]);

    const healthColor = useMemo(
      () =>
        healthScore > 70 ? 'text-green-500' : healthScore > 40 ? 'text-yellow-500' : 'text-red-500',
      [healthScore]
    );

    const lastActivity = useMemo(() => {
      const hours = Math.floor(Math.random() * 72);
      return hours === 0
        ? 'Just now'
        : hours < 24
          ? `${hours}h ago`
          : `${Math.floor(hours / 24)}d ago`;
    }, []);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        whileHover={{ y: -4 }}
        transition={{
          duration: 0.3,
          delay: index * 0.05,
          ease: 'easeOut',
        }}
        className="bg-card rounded-xl border border-border hover:border-primary/30 transition-all duration-300 overflow-hidden group relative h-full"
        style={{ minHeight: '280px' }} // Fixed height for virtual scrolling
      >
        {/* Favorite Badge */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className={`absolute top-3 right-3 z-10 p-2 rounded-lg transition-all ${
            isFavorite
              ? 'bg-yellow-500/20 text-yellow-500'
              : 'bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-yellow-500'
          }`}
        >
          <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
        </motion.button>

        {/* Header */}
        <div className="p-5 pb-3">
          <div className="flex items-start gap-3">
            <div className="relative">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20"
              >
                <Building2 className="w-6 h-6 text-white" />
              </motion.div>
              {activeStandups.length > 0 && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background animate-pulse" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors truncate">
                {team.name}
              </h3>
              {team.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {team.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="px-5 pb-3 grid grid-cols-2 gap-3">
          <div className="bg-background/50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-lg font-bold text-foreground">
                {team.memberCount || team.members.length}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Members</p>
          </div>
          <div className="bg-background/50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-lg font-bold text-foreground">{activeStandups.length}</span>
            </div>
            <p className="text-xs text-muted-foreground">Active Standups</p>
          </div>
        </div>

        {/* Health Score */}
        <div className="px-5 pb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Team Health</span>
            <span className={`text-sm font-bold ${healthColor}`}>{healthScore}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <motion.div
              className={`h-2 rounded-full ${
                healthScore > 70
                  ? 'bg-green-500'
                  : healthScore > 40
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${healthScore}%` }}
              transition={{ duration: 1, delay: index * 0.1 }}
            />
          </div>
        </div>

        {/* Integration Status */}
        <div className="px-5 pb-3">
          <div className="flex items-center gap-2">
            {activeStandups.some(s => s.targetChannelId) ? (
              <>
                <div className="flex items-center gap-1">
                  <Slack className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-green-500 font-medium">Integrated</span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-1">
                <Link2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">No Integration</span>
              </div>
            )}
            <span className="text-xs text-muted-foreground ml-auto">{lastActivity}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-5 pb-5 flex gap-2">
          <ModernButton variant="ghost" size="sm" onClick={onView} className="flex-1 text-xs">
            <Eye className="w-4 h-4 mr-1" />
            View
          </ModernButton>
          <ModernButton variant="ghost" size="sm" onClick={onSettings} className="flex-1 text-xs">
            <Settings className="w-4 h-4 mr-1" />
            Settings
          </ModernButton>
          <ModernButton
            variant="primary"
            size="sm"
            onClick={onCreateStandup}
            className="flex-1 text-xs"
          >
            <Plus className="w-4 h-4 mr-1" />
            Standup
          </ModernButton>
        </div>
      </motion.div>
    );
  }
);

OptimizedTeamCard.displayName = 'OptimizedTeamCard';

// Main Teams Page Component
export const OptimizedTeamsPage = React.memo(() => {
  const navigate = useNavigate();
  const { teams } = useTeams();

  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Optimized data fetching for all team standups
  const { data: teamStandupsMap = new Map(), isLoading: isLoadingStandups } = useOptimizedQuery(
    ['team-standups', teams?.map(t => t.id).join(',') || ''],
    async () => {
      if (!teams || teams.length === 0) return new Map();

      const promises = teams.map(async team => {
        try {
          const standups = await standupsApi.getTeamStandups(team.id);
          return [team.id, standups];
        } catch (error) {
          console.error(`Error fetching standups for team ${team.id}:`, error);
          return [team.id, []];
        }
      });

      const results = await Promise.all(promises);
      return new Map(results as [string, Standup[]][]);
    },
    {
      enabled: !!teams && teams.length > 0,
      staleTime: 2 * 60 * 1000, // 2 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    }
  );

  // Memoized callbacks
  const handleCreateTeam = useCallback(
    async (teamName?: string, team?: Team) => {
      try {
        setIsCreateModalOpen(false);
        if (teamName && team) {
          toast.teamCreated(teamName, team.id, navigate);
        } else {
          toast.success('Team created successfully!');
        }
      } catch (error) {
        console.error('Failed to create team:', error);
        toast.error('Failed to create team');
      }
    },
    [navigate]
  );

  const handleToggleFavorite = useCallback((teamId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(teamId)) {
        newFavorites.delete(teamId);
      } else {
        newFavorites.add(teamId);
      }
      return newFavorites;
    });
  }, []);

  const handleViewTeam = useCallback(
    (team: Team) => {
      navigate(`/teams/${team.id}`);
    },
    [navigate]
  );

  const handleSettings = useCallback((team: Team) => {
    setSelectedTeam(team);
    setIsSettingsModalOpen(true);
  }, []);

  const handleCreateStandup = useCallback(
    (team: Team) => {
      navigate(`/teams/${team.id}/standups/wizard`);
    },
    [navigate]
  );

  // Memoized filtered and sorted teams
  const processedTeams = useMemo(() => {
    if (!teams) return [];

    const filtered = teams.filter(team => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch =
          team.name.toLowerCase().includes(searchLower) ||
          team.description?.toLowerCase().includes(searchLower) ||
          false;
        if (!matchesSearch) return false;
      }

      // Category filter
      if (filterBy !== 'all') {
        const teamStandups = teamStandupsMap.get(team.id) || [];
        const activeStandups = teamStandups.filter((s: Standup) => s.isActive);

        switch (filterBy) {
          case 'active': {
            if (activeStandups.length === 0) return false;
            break;
          }
          case 'integrated': {
            if (!activeStandups.some((s: Standup) => s.targetChannelId)) return false;
            break;
          }
          case 'no-integration': {
            if (activeStandups.some((s: Standup) => s.targetChannelId)) return false;
            break;
          }
          case 'favorites': {
            if (!favorites.has(team.id)) return false;
            break;
          }
        }
      }

      return true;
    });

    // Sort teams
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'members':
          return (b.memberCount || b.members.length) - (a.memberCount || a.members.length);
        case 'activity': {
          const aStandups = teamStandupsMap.get(a.id) || [];
          const bStandups = teamStandupsMap.get(b.id) || [];
          return bStandups.length - aStandups.length;
        }
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [teams, searchTerm, sortBy, filterBy, teamStandupsMap, favorites]);

  // Virtual list render function
  const renderTeamItem = useCallback(
    (team: Team, index: number) => {
      const standups = teamStandupsMap.get(team.id) || [];
      const isFavorite = favorites.has(team.id);

      return (
        <div className="p-3">
          <OptimizedTeamCard
            team={team}
            standups={standups}
            isFavorite={isFavorite}
            onToggleFavorite={() => handleToggleFavorite(team.id)}
            onView={() => handleViewTeam(team)}
            onSettings={() => handleSettings(team)}
            onCreateStandup={() => handleCreateStandup(team)}
            index={index}
          />
        </div>
      );
    },
    [
      teamStandupsMap,
      favorites,
      handleToggleFavorite,
      handleViewTeam,
      handleSettings,
      handleCreateStandup,
    ]
  );

  if (!teams && !isLoadingStandups) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Loading teams...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Teams</h1>
              <p className="text-muted-foreground">Manage your organization's teams</p>
            </div>
            <ModernButton onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Team
            </ModernButton>
          </div>

          {/* Filters and Search */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search teams..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div className="flex gap-3">
              <Dropdown
                trigger={
                  <ModernButton variant="ghost" size="sm">
                    <Filter className="w-4 h-4 mr-2" />
                    {filterBy === 'all'
                      ? 'All Teams'
                      : filterBy === 'active'
                        ? 'Active'
                        : filterBy === 'integrated'
                          ? 'Integrated'
                          : filterBy === 'no-integration'
                            ? 'No Integration'
                            : 'Favorites'}
                  </ModernButton>
                }
                items={[
                  { label: 'All Teams', onClick: () => setFilterBy('all') },
                  { label: 'Active', onClick: () => setFilterBy('active') },
                  { label: 'Integrated', onClick: () => setFilterBy('integrated') },
                  { label: 'No Integration', onClick: () => setFilterBy('no-integration') },
                  { label: 'Favorites', onClick: () => setFilterBy('favorites') },
                ]}
              />

              <Dropdown
                trigger={
                  <ModernButton variant="ghost" size="sm">
                    <SortAsc className="w-4 h-4 mr-2" />
                    Sort by{' '}
                    {sortBy === 'name'
                      ? 'Name'
                      : sortBy === 'members'
                        ? 'Members'
                        : sortBy === 'activity'
                          ? 'Activity'
                          : 'Created'}
                  </ModernButton>
                }
                items={[
                  { label: 'Name', onClick: () => setSortBy('name') },
                  { label: 'Members', onClick: () => setSortBy('members') },
                  { label: 'Activity', onClick: () => setSortBy('activity') },
                  { label: 'Created', onClick: () => setSortBy('created') },
                ]}
              />
            </div>
          </div>
        </motion.div>

        {/* Teams Grid with Virtual Scrolling */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          {processedTeams.length > 0 ? (
            processedTeams.length > 20 ? (
              // Use virtual scrolling for large lists
              <OptimizedVirtualList
                items={processedTeams}
                itemHeight={300} // Fixed height including padding
                containerHeight={600}
                renderItem={renderTeamItem}
                getItemKey={team => team.id}
                className="border border-border rounded-lg"
              />
            ) : (
              // Use regular grid for small lists
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {processedTeams.map((team, index) => renderTeamItem(team, index))}
              </div>
            )
          ) : (
            <div className="text-center py-12">
              <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {searchTerm || filterBy !== 'all' ? 'No teams match your filters' : 'No teams yet'}
              </h3>
              <p className="text-muted-foreground mb-6">
                {searchTerm || filterBy !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Create your first team to get started with standups'}
              </p>
              {!searchTerm && filterBy === 'all' && (
                <ModernButton onClick={() => setIsCreateModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Team
                </ModernButton>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* Modals */}
      <CreateTeamModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateTeam}
      />

      {selectedTeam && (
        <TeamSettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          team={selectedTeam}
          onSuccess={() => {
            setIsSettingsModalOpen(false);
            setSelectedTeam(null);
          }}
        />
      )}
    </div>
  );
});

OptimizedTeamsPage.displayName = 'OptimizedTeamsPage';
