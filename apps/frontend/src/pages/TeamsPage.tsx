import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ModernButton, Dropdown } from '@/components/ui';
import { CreateTeamModal } from '@/components/CreateTeamModal';
import { TeamSettingsModal } from '@/components/TeamSettingsModal';
import {
  Plus,
  Users,
  Eye,
  Settings,
  ChevronRight,
  Building2,
  Link2,
  Calendar,
  Slack,
  Search,
  Filter,
  SortAsc,
  Star,
  TrendingUp,
  Activity,
  Clock,
  CheckCircle2,
  BarChart3,
  X,
  ChevronLeft,
  UserPlus,
  Zap,
  Inbox,
} from 'lucide-react';
import { useTeams } from '@/contexts';
import { toast } from '@/components/ui';
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

// Team Card Component
const TeamCard: React.FC<TeamCardProps> = ({
  team,
  standups,
  isFavorite,
  onToggleFavorite,
  onView,
  onSettings,
  onCreateStandup,
  index = 0,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const activeStandups = standups.filter(s => s.isActive);
  const lastActivity = useMemo(() => {
    // Simulate last activity - in real app this would come from API
    const hours = Math.floor(Math.random() * 72);
    return hours === 0
      ? 'Just now'
      : hours < 24
        ? `${hours}h ago`
        : `${Math.floor(hours / 24)}d ago`;
  }, []);

  // Calculate team health score (0-100)
  const healthScore = useMemo(() => {
    let score = 50; // Base score
    if (team.channel) score += 20; // Has integration
    if (activeStandups.length > 0) score += 20; // Has active standups
    score += Math.min(10, team.members.length * 2); // More members = better, capped at 10
    return Math.min(100, score);
  }, [team, activeStandups]);

  const healthColor =
    healthScore > 70 ? 'text-green-500' : healthScore > 40 ? 'text-yellow-500' : 'text-red-500';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4 }}
      transition={{
        duration: 0.4,
        delay: index * 0.1,
        ease: 'easeOut',
      }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="bg-card rounded-xl border border-border hover:border-primary/30 transition-all duration-300 overflow-hidden group relative"
    >
      {/* Favorite Badge */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={e => {
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
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{team.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="px-5 pb-3 grid grid-cols-2 gap-3">
        {/* Members */}
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Members</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1">
              {team.members.slice(0, 3).map(member => (
                <div
                  key={member.id}
                  className="w-6 h-6 bg-primary rounded-full border-2 border-card flex items-center justify-center"
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
            <span className="text-sm font-semibold">{team.members.length}</span>
          </div>
        </div>

        {/* Standups */}
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Standups</span>
          </div>
          <div className="flex items-center gap-2">
            {activeStandups.length > 0 ? (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-semibold text-green-600">
                  {activeStandups.length} Active
                </span>
              </>
            ) : standups.length > 0 ? (
              <>
                <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                <span className="text-sm font-semibold text-yellow-600">
                  {standups.length} Paused
                </span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-muted-foreground/30 rounded-full" />
                <span className="text-sm font-semibold text-muted-foreground">None</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Integration & Health Bar */}
      <div className="px-5 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {team.channel ? (
              <>
                <div className="w-6 h-6 bg-green-500 rounded flex items-center justify-center">
                  <Slack className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-xs font-medium text-green-600">#{team.channel.name}</span>
              </>
            ) : (
              <>
                <div className="w-6 h-6 bg-muted border border-dashed border-muted-foreground/30 rounded flex items-center justify-center">
                  <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <span className="text-xs text-muted-foreground">No integration</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{lastActivity}</span>
          </div>
        </div>

        {/* Health Score */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Team Health</span>
            <span className={`text-xs font-medium ${healthColor}`}>{healthScore}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${healthScore}%` }}
              transition={{ duration: 1, delay: 0.2 }}
              className={`h-full rounded-full ${
                healthScore > 70
                  ? 'bg-green-500'
                  : healthScore > 40
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-2 bg-muted/30 border-t border-border flex items-center gap-1">
        <ModernButton
          variant="ghost"
          size="sm"
          onClick={onView}
          className="flex-1 text-xs h-8"
          title="View team details"
        >
          <Eye className="w-3.5 h-3.5" />
          <span className="ml-1 hidden sm:inline">View</span>
        </ModernButton>
        <ModernButton
          variant="ghost"
          size="sm"
          onClick={onSettings}
          className="flex-1 text-xs h-8"
          title="Team settings"
        >
          <Settings className="w-3.5 h-3.5" />
          <span className="ml-1 hidden sm:inline">Settings</span>
        </ModernButton>
        <ModernButton
          variant="ghost"
          size="sm"
          onClick={onCreateStandup}
          className="flex-1 text-xs h-8"
          title="Create new standup"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="ml-1 hidden sm:inline">Standup</span>
        </ModernButton>
      </div>

      {/* Hover Preview */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-full left-0 right-0 mb-2 p-3 bg-popover rounded-lg border border-border shadow-xl z-20"
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Recent activity: {lastActivity}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-sm">
                  Completion rate: {Math.floor(Math.random() * 30 + 70)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                <span className="text-sm">Engagement trending up</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Skeleton Card Component
const SkeletonCard: React.FC = () => (
  <div className="bg-card rounded-xl border border-border p-5 animate-pulse">
    <div className="flex items-start gap-3 mb-4">
      <div className="w-12 h-12 bg-muted rounded-xl" />
      <div className="flex-1">
        <div className="h-5 bg-muted rounded w-3/4 mb-2" />
        <div className="h-4 bg-muted rounded w-full" />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3 mb-3">
      <div className="bg-muted/50 rounded-lg p-3 h-16" />
      <div className="bg-muted/50 rounded-lg p-3 h-16" />
    </div>
    <div className="h-8 bg-muted/50 rounded" />
  </div>
);

export const TeamsPage = React.memo(() => {
  const { teams, isLoading, refreshTeams } = useTeams();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedTeamForSettings, setSelectedTeamForSettings] = useState<Team | null>(null);
  const [teamStandups, setTeamStandups] = useState<Record<string, Standup[]>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('activity');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [favoriteTeams, setFavoriteTeams] = useState<string[]>([]);
  const [showStats, setShowStats] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  // Load favorites from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('favoriteTeams');
    if (stored) {
      setFavoriteTeams(JSON.parse(stored));
    }
  }, []);

  // Save favorites to localStorage
  useEffect(() => {
    localStorage.setItem('favoriteTeams', JSON.stringify(favoriteTeams));
  }, [favoriteTeams]);

  // Auto-open create modal if query param present
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const shouldOpen = searchParams.get('create') === '1';
    if (shouldOpen) {
      setIsCreateModalOpen(true);
      navigate(location.pathname, { replace: true });
    }
  }, [location.search, location.pathname, navigate]);

  // Fetch standups for all teams
  useEffect(() => {
    const fetchAllStandups = async () => {
      if (teams.length === 0) return;

      const standupsMap: Record<string, Standup[]> = {};
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

  // Filter and sort teams
  const filteredAndSortedTeams = useMemo(() => {
    let filtered = teams;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        team =>
          team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          team.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply filter
    switch (filterBy) {
      case 'active': {
        filtered = filtered.filter(team => (teamStandups[team.id] || []).some(s => s.isActive));
        break;
      }
      case 'integrated': {
        filtered = filtered.filter(team => team.channel);
        break;
      }
      case 'no-integration': {
        filtered = filtered.filter(team => !team.channel);
        break;
      }
      case 'favorites': {
        filtered = filtered.filter(team => favoriteTeams.includes(team.id));
        break;
      }
    }

    // Apply sort
    const sorted = [...filtered].sort((a, b) => {
      // Favorites always come first
      const aIsFav = favoriteTeams.includes(a.id);
      const bIsFav = favoriteTeams.includes(b.id);
      if (aIsFav && !bIsFav) return -1;
      if (!aIsFav && bIsFav) return 1;

      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'members':
          return b.members.length - a.members.length;
        case 'activity': {
          // Sort by active standups count
          const aActive = (teamStandups[a.id] || []).filter(s => s.isActive).length;
          const bActive = (teamStandups[b.id] || []).filter(s => s.isActive).length;
          return bActive - aActive;
        }
        case 'created':
          // Assuming newer teams have higher IDs (simplified)
          return b.id.localeCompare(a.id);
        default:
          return 0;
      }
    });

    return sorted;
  }, [teams, searchQuery, sortBy, filterBy, favoriteTeams, teamStandups]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalTeams = teams.length;
    const totalMembers = teams.reduce((acc, team) => acc + team.members.length, 0);
    const teamsWithIntegrations = teams.filter(team => team.channel).length;
    const activeTeams = teams.filter(team =>
      (teamStandups[team.id] || []).some(s => s.isActive)
    ).length;
    const totalStandups = Object.values(teamStandups).flat().length;
    const activeStandups = Object.values(teamStandups)
      .flat()
      .filter(s => s.isActive).length;

    return {
      totalTeams,
      totalMembers,
      teamsWithIntegrations,
      activeTeams,
      totalStandups,
      activeStandups,
      averageTeamSize: totalTeams > 0 ? Math.round(totalMembers / totalTeams) : 0,
      integrationRate: totalTeams > 0 ? Math.round((teamsWithIntegrations / totalTeams) * 100) : 0,
    };
  }, [teams, teamStandups]);

  const handleToggleFavorite = (teamId: string) => {
    const wasFavorited = favoriteTeams.includes(teamId);

    setFavoriteTeams(prev => (wasFavorited ? prev.filter(id => id !== teamId) : [...prev, teamId]));

    toast.favorite(wasFavorited ? 'Removed from favorites' : 'Added to favorites', !wasFavorited);
  };

  const handleCreateSuccess = async (teamName?: string) => {
    await refreshTeams();
    if (teamName) {
      toast.teamCreated(teamName);
    } else {
      toast.success('Team created successfully!');
    }
  };

  const handleSettingsSuccess = async () => {
    await refreshTeams();
    toast.success('Team settings updated');
  };

  const handleJoinTeam = () => {
    toast.info('Join team functionality coming soon!', {
      richContent: {
        title: 'Feature Coming Soon',
        description: "We're working on team invitation features",
        metadata: 'Q1 2024',
      },
      action: {
        label: 'Get notified',
        onClick: () => toast.info("We'll notify you when this feature is ready!"),
      },
    });
  };

  if (isLoading && teams.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="mb-8">
            <div className="h-10 bg-muted rounded w-48 mb-2 animate-pulse" />
            <div className="h-6 bg-muted rounded w-64 animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </main>
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
          className="flex items-center justify-between mb-6"
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
              variant="ghost"
              onClick={() => setShowStats(!showStats)}
              className="group"
              title={showStats ? 'Hide statistics sidebar' : 'Show statistics sidebar'}
            >
              <BarChart3 className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">{showStats ? 'Hide' : 'Show'} Stats</span>
              {showStats ? (
                <ChevronLeft className="w-3 h-3 ml-1 group-hover:-translate-x-0.5 transition-transform" />
              ) : (
                <ChevronRight className="w-3 h-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
              )}
            </ModernButton>
            <ModernButton variant="secondary" onClick={handleJoinTeam} className="group">
              <Users className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
              Join Team
            </ModernButton>
            <ModernButton
              variant="primary"
              onClick={() => setIsCreateModalOpen(true)}
              className="group shadow-lg shadow-primary/20"
            >
              <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform" />
              Create Team
            </ModernButton>
          </motion.div>
        </motion.div>

        {/* Search, Filter, and Sort Bar */}
        {teams.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex items-center gap-3 mb-6 flex-wrap"
          >
            {/* Search */}
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search teams..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter */}
            <Dropdown
              trigger={
                <ModernButton variant="secondary" className="h-10">
                  <Filter className="w-4 h-4 mr-2" />
                  Filter:{' '}
                  {filterBy === 'all'
                    ? 'All'
                    : filterBy.charAt(0).toUpperCase() + filterBy.slice(1)}
                </ModernButton>
              }
              items={[
                { label: 'All Teams', onClick: () => setFilterBy('all') },
                { label: 'Active Standups', onClick: () => setFilterBy('active') },
                { label: 'With Integration', onClick: () => setFilterBy('integrated') },
                { label: 'No Integration', onClick: () => setFilterBy('no-integration') },
                { label: 'Favorites', onClick: () => setFilterBy('favorites') },
              ]}
            />

            {/* Sort */}
            <Dropdown
              trigger={
                <ModernButton variant="secondary" className="h-10">
                  <SortAsc className="w-4 h-4 mr-2" />
                  Sort: {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
                </ModernButton>
              }
              items={[
                { label: 'Activity', onClick: () => setSortBy('activity') },
                { label: 'Name', onClick: () => setSortBy('name') },
                { label: 'Members', onClick: () => setSortBy('members') },
                { label: 'Created', onClick: () => setSortBy('created') },
              ]}
            />
          </motion.div>
        )}

        <div className="flex gap-6">
          {/* Statistics Sidebar */}
          <AnimatePresence>
            {showStats && teams.length > 0 && (
              <motion.aside
                initial={{ opacity: 0, x: -20, width: 0 }}
                animate={{ opacity: 1, x: 0, width: 280 }}
                exit={{ opacity: 0, x: -20, width: 0 }}
                transition={{ duration: 0.3 }}
                className="hidden lg:block"
              >
                <div className="sticky top-4 space-y-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      Statistics
                    </h3>
                    <button
                      onClick={() => setShowStats(false)}
                      className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted"
                      title="Hide statistics"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Quick Stats - Different style from team cards */}
                  <div className="space-y-2">
                    <div className="bg-muted/40 backdrop-blur-sm rounded-lg p-3 border border-muted-foreground/10">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Total Teams</span>
                        <span className="text-lg font-bold">{stats.totalTeams}</span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Active Teams</span>
                        <span className="text-lg font-bold text-green-500">
                          {stats.activeTeams}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Total Members</span>
                        <span className="text-lg font-bold">{stats.totalMembers}</span>
                      </div>
                    </div>

                    {/* Integration Progress */}
                    <div className="bg-muted/40 backdrop-blur-sm rounded-lg p-3 border border-muted-foreground/10">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Integration Rate</span>
                        <span className="text-sm font-bold text-primary">
                          {stats.integrationRate}%
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${stats.integrationRate}%` }}
                          transition={{ duration: 1 }}
                          className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full"
                        />
                      </div>
                    </div>

                    {/* Standups Stats */}
                    <div className="bg-muted/40 backdrop-blur-sm rounded-lg p-3 border border-muted-foreground/10">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Standups</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Total</span>
                          <span className="text-sm font-semibold">{stats.totalStandups}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Active</span>
                          <span className="text-sm font-semibold text-green-500">
                            {stats.activeStandups}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Average Team Size - Highlight card */}
                    <div className="bg-gradient-to-br from-primary/10 to-primary/5 backdrop-blur-sm rounded-lg border border-primary/20 p-3 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
                      <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-1">
                          <Users className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium text-primary">Avg Team Size</span>
                        </div>
                        <span className="text-2xl font-bold text-primary">
                          {stats.averageTeamSize}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

          {/* Main Content */}
          <div className="flex-1">
            {filteredAndSortedTeams.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                  {filteredAndSortedTeams.map((team, index) => (
                    <TeamCard
                      key={team.id}
                      team={team}
                      standups={teamStandups[team.id] || []}
                      isFavorite={favoriteTeams.includes(team.id)}
                      onToggleFavorite={() => handleToggleFavorite(team.id)}
                      onView={() => navigate(`/teams/${team.id}`)}
                      onSettings={() => {
                        setSelectedTeamForSettings(team);
                        setIsSettingsModalOpen(true);
                      }}
                      onCreateStandup={() => navigate(`/teams/${team.id}/standups/create`)}
                      index={index}
                    />
                  ))}
                </AnimatePresence>
              </div>
            ) : teams.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-xl border border-border p-12 text-center"
              >
                <Inbox className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No teams found</h3>
                <p className="text-muted-foreground mb-4">Try adjusting your search or filters</p>
                <ModernButton
                  variant="secondary"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterBy('all');
                  }}
                >
                  Clear filters
                </ModernButton>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="bg-card rounded-xl border border-border p-8"
              >
                {/* Empty State - Simplified */}
                <div className="max-w-md mx-auto text-center">
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  >
                    <Building2 className="w-8 h-8 text-primary" />
                  </motion.div>

                  <h3 className="text-xl font-bold mb-2">Welcome to AsyncStand</h3>
                  <p className="text-muted-foreground mb-6">
                    Create your first team to get started with async standups
                  </p>

                  {/* Quick Start Guide */}
                  <div className="bg-muted/50 rounded-lg p-4 mb-6 text-left">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-500" />
                      Quick Start Guide
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                          1
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Create a team for your project or department
                        </p>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                          2
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Invite team members to collaborate
                        </p>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                          3
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Set up daily standups with Slack integration
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 justify-center">
                    <ModernButton variant="secondary" onClick={handleJoinTeam} className="group">
                      <UserPlus className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                      Join Team
                    </ModernButton>
                    <ModernButton
                      variant="primary"
                      onClick={() => setIsCreateModalOpen(true)}
                      className="group shadow-lg shadow-primary/20"
                    >
                      <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform" />
                      Create Team
                    </ModernButton>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      <CreateTeamModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

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
