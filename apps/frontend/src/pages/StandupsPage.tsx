import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Play,
  RefreshCw,
  Download,
  Activity,
  Plus,
  Search,
  Filter,
  SortAsc,
  BarChart3,
  ChevronDown,
  Inbox,
  Building2,
  X,
} from 'lucide-react';
import { ModernButton, Dropdown, toast } from '@/components/ui';
import { MemberDetailsView } from '@/components/MemberDetailsView';
import { SmartReminderModal } from '@/components/SmartReminderModal';
import { StandupCard } from '@/components/StandupCard';
import { useTeams } from '@/contexts/TeamsContext';
import { useStandups } from '@/contexts/StandupsContext';
import { standupsApi } from '@/lib/api';
import type { ActiveStandup } from '@/types';

type FilterType = 'all' | 'active' | 'completed' | 'overdue' | 'favorites';
type SortType = 'date' | 'team' | 'progress' | 'activity';
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

export const StandupsPage = () => {
  const navigate = useNavigate();
  const { teams, selectedTeam, selectTeam, fetchTeams } = useTeams();
  const { standups, fetchStandupsByTeam } = useStandups();

  const [activeInstances, setActiveInstances] = useState<ActiveStandup[]>([]);
  const [isLoadingInstances, setIsLoadingInstances] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortType, setSortType] = useState<SortType>('date');
  const [favoriteStandups, setFavoriteStandups] = useState<string[]>([]);

  // Modal states
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [isMemberDetailsOpen, setIsMemberDetailsOpen] = useState(false);
  const [isSmartReminderOpen, setIsSmartReminderOpen] = useState(false);

  // Load favorites from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('favoriteStandups');
    if (stored) {
      setFavoriteStandups(JSON.parse(stored));
    }
  }, []);

  // Save favorites to localStorage
  useEffect(() => {
    localStorage.setItem('favoriteStandups', JSON.stringify(favoriteStandups));
  }, [favoriteStandups]);

  // Load team data
  useEffect(() => {
    if (teams.length === 0) {
      fetchTeams();
    }
  }, [teams, fetchTeams]);

  // Auto-select first team if none selected
  useEffect(() => {
    if (!selectedTeam && teams.length > 0) {
      selectTeam(teams[0]);
    }
  }, [teams, selectedTeam, selectTeam]);

  // Fetch standups when team changes
  useEffect(() => {
    if (selectedTeam) {
      fetchStandupsByTeam(selectedTeam.id);
      fetchActiveInstances(selectedTeam.id);
    }
  }, [selectedTeam, fetchStandupsByTeam]);

  const fetchActiveInstances = useCallback(async (teamId?: string) => {
    setIsLoadingInstances(true);
    try {
      // Try to get detailed instances with member information
      let instances;
      try {
        instances = await standupsApi.getActiveStandupsDetailed({ teamId });
      } catch {
        // Fallback to basic instances if detailed endpoint fails
        instances = await standupsApi.getActiveStandups({ teamId });
      }

      setActiveInstances(instances);
    } catch {
      toast.error('Failed to load standup instances');
    } finally {
      setIsLoadingInstances(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        selectedTeam && fetchStandupsByTeam(selectedTeam.id),
        fetchActiveInstances(selectedTeam?.id),
      ]);
      toast.success('Data refreshed successfully');
    } catch {
      toast.error('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedTeam, fetchStandupsByTeam, fetchActiveInstances]);

  const handleTriggerAll = async () => {
    try {
      toast.loading('Triggering all standups for today...', { id: 'trigger-all' });
      const result = await standupsApi.triggerStandupAndSend();

      if (result.created.length > 0) {
        toast.success(
          `Created ${result.created.length} standup${result.created.length > 1 ? 's' : ''}!`,
          { id: 'trigger-all' }
        );
        await fetchActiveInstances(selectedTeam?.id);
      } else {
        toast.info('All standups are already triggered for today', { id: 'trigger-all' });
      }
    } catch {
      toast.error('Failed to trigger standups', { id: 'trigger-all' });
    }
  };

  const handleExportReport = () => {
    toast.info('Export feature coming soon!');
  };

  const handleViewResponses = (instanceId: string) => {
    navigate(`/standups/${instanceId}/responses`);
  };

  const handleSendReminder = async (instanceId: string) => {
    try {
      toast.loading('Sending reminder...', { id: `reminder-${instanceId}` });
      await standupsApi.triggerReminderForInstance(instanceId);
      toast.success('Reminder sent successfully!', { id: `reminder-${instanceId}` });
    } catch {
      toast.error('Failed to send reminder', { id: `reminder-${instanceId}` });
    }
  };

  const handleToggleFavorite = (standupId: string) => {
    const wasFavorited = favoriteStandups.includes(standupId);

    setFavoriteStandups(prev =>
      wasFavorited ? prev.filter(id => id !== standupId) : [...prev, standupId]
    );

    toast.favorite(wasFavorited ? 'Removed from favorites' : 'Added to favorites', !wasFavorited);
  };

  const handleCreateStandup = () => {
    // Navigate to standup configuration wizard to create a new standup template
    if (selectedTeam) {
      navigate(`/teams/${selectedTeam.id}/standups/wizard`);
    } else {
      toast.error('Please select a team first');
    }
  };

  // Filter and sort instances
  const filteredAndSortedInstances = useMemo(() => {
    let filtered = [...activeInstances];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(instance =>
        instance.teamName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply filter
    switch (filterType) {
      case 'active':
        filtered = filtered.filter(inst => inst.state === 'collecting');
        break;
      case 'completed':
        filtered = filtered.filter(inst => inst.state === 'completed');
        break;
      case 'overdue':
        filtered = filtered.filter(inst => inst.members?.some(m => m.status === 'overdue'));
        break;
      case 'favorites':
        filtered = filtered.filter(inst => favoriteStandups.includes(inst.id));
        break;
    }

    // Apply sort
    filtered.sort((a, b) => {
      // Favorites always come first
      const aIsFav = favoriteStandups.includes(a.id);
      const bIsFav = favoriteStandups.includes(b.id);
      if (aIsFav && !bIsFav) return -1;
      if (!aIsFav && bIsFav) return 1;

      switch (sortType) {
        case 'date':
          return new Date(b.targetDate).getTime() - new Date(a.targetDate).getTime();
        case 'team':
          return a.teamName.localeCompare(b.teamName);
        case 'progress': {
          const aProgress = a.totalMembers > 0 ? a.respondedMembers / a.totalMembers : 0;
          const bProgress = b.totalMembers > 0 ? b.respondedMembers / b.totalMembers : 0;
          return bProgress - aProgress;
        }
        case 'activity':
          // Sort by most recent activity (simplified - would need activity timestamps)
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [activeInstances, searchQuery, filterType, sortType, favoriteStandups]);

  // Calculate stats
  const stats = useMemo(() => {
    const activeCount = activeInstances.filter(s => s.state === 'collecting').length;
    const completedCount = activeInstances.filter(s => s.state === 'completed').length;
    const totalResponses = activeInstances.reduce((acc, inst) => acc + inst.respondedMembers, 0);
    const totalExpected = activeInstances.reduce((acc, inst) => acc + inst.totalMembers, 0);
    const responseRate = totalExpected > 0 ? Math.round((totalResponses / totalExpected) * 100) : 0;

    const todayInstances = activeInstances.filter(inst => {
      const today = new Date().toDateString();
      return new Date(inst.targetDate).toDateString() === today;
    });

    const todayResponses = todayInstances.reduce((acc, inst) => acc + inst.respondedMembers, 0);
    const todayExpected = todayInstances.reduce((acc, inst) => acc + inst.totalMembers, 0);

    const avgResponseTime =
      activeInstances.reduce((acc, inst) => {
        return acc + (inst.avgResponseTime || 0);
      }, 0) / (activeInstances.length || 1);

    return {
      responseRate,
      todayStatus: `${todayResponses}/${todayExpected}`,
      activeCount,
      completedCount,
      totalInstances: activeInstances.length,
      avgResponseTime: Math.round(avgResponseTime),
    };
  }, [activeInstances]);

  if (isLoadingInstances && activeInstances.length === 0) {
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
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6"
        >
          <div>
            <motion.h1
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-2xl sm:text-4xl font-bold text-foreground mb-2"
            >
              <span className="bg-gradient-to-r from-foreground via-blue-600/80 to-foreground bg-clip-text text-transparent">
                Standups Overview
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-muted-foreground text-base sm:text-lg"
            >
              Track and manage all your team standups in one place.
            </motion.p>
          </div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap gap-2 sm:gap-3"
          >
            <div className="relative group/tooltip">
              <ModernButton
                variant="secondary"
                onClick={handleTriggerAll}
                disabled={standups.length === 0}
                className="group flex-1 sm:flex-none"
                size="sm"
              >
                <Play className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                <span className="sm:inline">Trigger All</span>
              </ModernButton>
              {standups.length === 0 && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                  No standup configurations found. Create a standup configuration first.
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800"></div>
                </div>
              )}
            </div>
            <ModernButton
              variant="primary"
              onClick={handleCreateStandup}
              className="group shadow-lg shadow-primary/20 flex-1 sm:flex-none"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform" />
              <span className="sm:inline">Setup Standup</span>
            </ModernButton>
          </motion.div>
        </motion.div>

        {/* Team Selector */}
        {teams.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-6"
          >
            <Dropdown
              trigger={
                <ModernButton variant="secondary" className="h-10">
                  <Building2 className="w-4 h-4 mr-2" />
                  {selectedTeam?.name || 'Select Team'}
                  <ChevronDown className="w-4 h-4 ml-2" />
                </ModernButton>
              }
              items={teams.map(team => ({
                label: team.name,
                onClick: () => selectTeam(team),
              }))}
              align="left"
            />
          </motion.div>
        )}

        {/* Quick Stats + Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6"
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              Quick Stats
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-emerald-50 rounded-xl">
                <div className="text-2xl font-bold text-emerald-600">{stats.responseRate}%</div>
                <div className="text-xs text-slate-600 mt-1">Response Rate</div>
                <div className="text-xs text-emerald-600 font-medium">
                  {stats.todayStatus} today
                </div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-xl">
                <div className="text-2xl font-bold text-blue-600">{stats.activeCount}</div>
                <div className="text-xs text-slate-600 mt-1">Active</div>
                <div className="text-xs text-blue-600 font-medium">Currently collecting</div>
              </div>
              <div className="text-center p-4 bg-violet-50 rounded-xl">
                <div className="text-2xl font-bold text-violet-600">{stats.completedCount}</div>
                <div className="text-xs text-slate-600 mt-1">Completed</div>
                <div className="text-xs text-violet-600 font-medium">All responses in</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-xl">
                <div className="text-2xl font-bold text-orange-600">{stats.avgResponseTime}m</div>
                <div className="text-xs text-slate-600 mt-1">Avg Time</div>
                <div className="text-xs text-orange-600 font-medium">Response speed</div>
              </div>
            </div>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="bg-slate-50 rounded-2xl border border-slate-200 p-6"
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-slate-600" />
              Recent Activity
            </h3>
            <div className="space-y-3">
              {filteredAndSortedInstances.slice(0, 4).map(instance => (
                <div key={instance.id} className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      instance.state === 'collecting'
                        ? 'bg-green-500'
                        : instance.state === 'completed'
                          ? 'bg-blue-500'
                          : 'bg-slate-400'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {instance.teamName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {instance.respondedMembers}/{instance.totalMembers} responses
                    </p>
                  </div>
                  <div className="text-xs text-slate-400">
                    {Math.round((instance.respondedMembers / instance.totalMembers) * 100)}%
                  </div>
                </div>
              ))}
              {filteredAndSortedInstances.length === 0 && (
                <div className="text-sm text-slate-500 text-center py-4">No recent activity</div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Search, Filter, and Sort Bar */}
        {activeInstances.length > 0 && (
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
                placeholder="Search standups..."
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
                  {filterType === 'all'
                    ? 'All'
                    : filterType.charAt(0).toUpperCase() + filterType.slice(1)}
                </ModernButton>
              }
              items={[
                { label: 'All Standups', onClick: () => setFilterType('all') },
                { label: 'Active', onClick: () => setFilterType('active') },
                { label: 'Completed', onClick: () => setFilterType('completed') },
                { label: 'Has Overdue', onClick: () => setFilterType('overdue') },
                { label: 'Favorites', onClick: () => setFilterType('favorites') },
              ]}
            />

            {/* Sort */}
            <Dropdown
              trigger={
                <ModernButton variant="secondary" className="h-10">
                  <SortAsc className="w-4 h-4 mr-2" />
                  Sort: {sortType.charAt(0).toUpperCase() + sortType.slice(1)}
                </ModernButton>
              }
              items={[
                { label: 'By Date', onClick: () => setSortType('date') },
                { label: 'By Team', onClick: () => setSortType('team') },
                { label: 'By Progress', onClick: () => setSortType('progress') },
                { label: 'By Activity', onClick: () => setSortType('activity') },
              ]}
            />

            {/* Refresh & Export */}
            <div className="flex gap-2">
              <ModernButton
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </ModernButton>
              <ModernButton variant="ghost" size="sm" onClick={handleExportReport}>
                <Download className="w-4 h-4" />
              </ModernButton>
            </div>
          </motion.div>
        )}

        {filteredAndSortedInstances.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {filteredAndSortedInstances.map(instance => (
                <StandupCard
                  key={instance.id}
                  standup={instance}
                  isFavorite={favoriteStandups.includes(instance.id)}
                  onToggleFavorite={() => handleToggleFavorite(instance.id)}
                  onViewResponses={() => handleViewResponses(instance.id)}
                  onSendReminder={() => handleSendReminder(instance.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : activeInstances.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl border border-border p-12 text-center"
          >
            <Inbox className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No standups found</h3>
            <p className="text-muted-foreground mb-4">Try adjusting your search or filters</p>
            <ModernButton
              variant="secondary"
              onClick={() => {
                setSearchQuery('');
                setFilterType('all');
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
            <div className="max-w-md mx-auto text-center">
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4"
              >
                <Calendar className="w-8 h-8 text-primary" />
              </motion.div>

              <h3 className="text-xl font-bold mb-2">No Active Standups</h3>
              <p className="text-muted-foreground mb-6">
                Create your first standup to start collecting team updates
              </p>

              <div className="flex gap-3 justify-center">
                <ModernButton
                  variant="primary"
                  onClick={handleCreateStandup}
                  className="group shadow-lg shadow-primary/20"
                >
                  <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform" />
                  Setup Standup
                </ModernButton>
                <div className="relative group/tooltip-empty">
                  <ModernButton
                    variant="secondary"
                    onClick={handleTriggerAll}
                    disabled={standups.length === 0}
                    className="group"
                  >
                    <Play className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                    Trigger Existing
                  </ModernButton>
                  {standups.length === 0 && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover/tooltip-empty:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                      No standup configurations found. Create a standup configuration first.
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800"></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* Modals */}
      {selectedInstanceId && (
        <>
          {(() => {
            const selectedInstance = activeInstances.find(inst => inst.id === selectedInstanceId);
            if (!selectedInstance) return null;

            return (
              <>
                <MemberDetailsView
                  isOpen={isMemberDetailsOpen}
                  onClose={() => {
                    setIsMemberDetailsOpen(false);
                    setSelectedInstanceId(null);
                  }}
                  instance={selectedInstance}
                  onSendReminder={async request => {
                    await standupsApi.sendIndividualReminder(request);
                    fetchActiveInstances(selectedTeam?.id);
                  }}
                  onUpdateResponse={async (instanceId, userId, answers) => {
                    await standupsApi.updateMemberResponse(instanceId, userId, answers);
                    fetchActiveInstances(selectedTeam?.id);
                  }}
                />
                <SmartReminderModal
                  isOpen={isSmartReminderOpen}
                  onClose={() => {
                    setIsSmartReminderOpen(false);
                    setSelectedInstanceId(null);
                  }}
                  instanceId={selectedInstanceId}
                  members={selectedInstance.members || []}
                  deliveryType={selectedInstance.deliveryType || 'direct_message'}
                  teamName={selectedInstance.teamName}
                  onSendReminder={async request => {
                    await standupsApi.sendIndividualReminder(request);
                    fetchActiveInstances(selectedTeam?.id);
                  }}
                />
              </>
            );
          })()}
        </>
      )}
    </div>
  );
};
