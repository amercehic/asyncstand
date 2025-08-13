import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ModernButton } from '@/components/ui';
import { Calendar, Plus, Search, Filter, BarChart3, Users, TrendingUp, Clock } from 'lucide-react';
import { toast } from '@/components/ui';
import { useTeams } from '@/contexts';
import { standupsApi } from '@/lib/api';
import type { StandupConfig } from '@/types';

export const ActiveStandupsPage = React.memo(() => {
  const { teams, isLoading: teamsLoading } = useTeams();
  const [allStandups, setAllStandups] = useState<(StandupConfig & { teamName: string })[]>([]);
  const [filteredStandups, setFilteredStandups] = useState<
    (StandupConfig & { teamName: string })[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'paused'>('all');

  // Fetch all standups from all teams
  const fetchAllStandups = async () => {
    if (!teams.length) return;

    try {
      setIsLoading(true);
      const standupPromises = teams.map(async team => {
        try {
          const standups = await standupsApi.getTeamStandups(team.id);
          return standups.map(standup => ({
            ...standup,
            teamName: team.name,
          }));
        } catch {
          console.log(`No standups found for team ${team.name}`);
          return [];
        }
      });

      const results = await Promise.all(standupPromises);
      const flatStandups = results.flat();

      setAllStandups(flatStandups);
      setFilteredStandups(flatStandups);
    } catch (error) {
      console.error('Error fetching standups:', error);
      toast.error('Failed to load standups');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!teamsLoading && teams.length > 0) {
      fetchAllStandups();
    }
  }, [teams, teamsLoading]);

  // Filter standups based on search and status filter
  useEffect(() => {
    let filtered = allStandups;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        standup =>
          standup.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          standup.teamName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(standup =>
        filterStatus === 'active' ? standup.isActive : !standup.isActive
      );
    }

    setFilteredStandups(filtered);
  }, [allStandups, searchQuery, filterStatus]);

  // Calculate statistics
  const totalStandups = allStandups.length;
  const activeStandups = allStandups.filter(s => s.isActive).length;
  const pausedStandups = totalStandups - activeStandups;
  const teamsWithStandups = new Set(allStandups.map(s => s.teamName)).size;

  if (teamsLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading standups...</p>
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
            <h1 className="text-3xl font-bold mb-2">Active Standups</h1>
            <p className="text-muted-foreground text-lg">
              Manage all your async standups across teams in one place.
            </p>
          </div>
          <div className="flex gap-3">
            <ModernButton
              variant="secondary"
              onClick={() => toast.info('Analytics - Coming soon!')}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </ModernButton>
            <ModernButton
              variant="primary"
              onClick={() => toast.info('Create standup - Select a team first')}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Standup
            </ModernButton>
          </div>
        </motion.div>

        {/* Statistics Dashboard */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          <div className="bg-card rounded-xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalStandups}</p>
                <p className="text-sm text-muted-foreground">Total Standups</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeStandups}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pausedStandups}</p>
                <p className="text-sm text-muted-foreground">Paused</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl p-6 border border-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{teamsWithStandups}</p>
                <p className="text-sm text-muted-foreground">Teams</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Filters and Search */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-card rounded-xl p-6 border border-border mb-8"
        >
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search standups or teams..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <div className="flex bg-muted rounded-lg p-1">
                {[
                  { value: 'all', label: 'All' },
                  { value: 'active', label: 'Active' },
                  { value: 'paused', label: 'Paused' },
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => setFilterStatus(option.value as 'all' | 'active' | 'paused')}
                    className={`px-4 py-2 text-sm rounded-md transition-all ${
                      filterStatus === option.value
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results summary */}
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Showing {filteredStandups.length} of {totalStandups} standups
              {searchQuery && ` matching "${searchQuery}"`}
              {filterStatus !== 'all' && ` with status "${filterStatus}"`}
            </p>
          </div>
        </motion.div>

        {/* Standups List */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          {filteredStandups.length > 0 ? (
            <div className="space-y-4">
              {filteredStandups.map((standup, index) => (
                <motion.div
                  key={standup.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="group bg-card rounded-2xl border border-border hover:border-primary/20 hover:shadow-lg transition-all duration-300 overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="relative">
                          <div
                            className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300 ${
                              standup.isActive
                                ? 'bg-gradient-to-br from-primary to-primary/80 group-hover:from-primary/90 group-hover:to-primary/70'
                                : 'bg-gradient-to-br from-gray-400 to-gray-500'
                            }`}
                          >
                            <Calendar className="w-7 h-7 text-white" />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                                {standup.name}
                              </h3>
                              <p className="text-sm text-muted-foreground font-medium">
                                {standup.teamName}
                              </p>
                              <div className="flex items-center gap-4 mt-2">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Clock className="w-4 h-4" />
                                  <span>
                                    {standup.schedule.days.length === 5 &&
                                    standup.schedule.days.includes('monday') &&
                                    standup.schedule.days.includes('friday')
                                      ? 'Weekdays'
                                      : `${standup.schedule.days.length} days/week`}{' '}
                                    at {standup.schedule.time}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Calendar className="w-4 h-4" />
                                  <span>{standup.questions.length} questions</span>
                                </div>
                              </div>
                            </div>

                            <div
                              className={`px-3 py-1 rounded-full text-xs font-medium border ${
                                standup.isActive
                                  ? 'text-green-700 bg-green-50 border-green-200'
                                  : 'text-gray-600 bg-gray-50 border-gray-200'
                              }`}
                            >
                              {standup.isActive ? (
                                <div className="flex items-center gap-1">
                                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                  Active
                                </div>
                              ) : (
                                'Paused'
                              )}
                            </div>
                          </div>

                          <div className="text-sm text-muted-foreground">
                            Created {new Date(standup.createdAt).toLocaleDateString()} • Updated{' '}
                            {new Date(standup.updatedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="bg-card rounded-2xl p-12 border border-border text-center">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Search className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">
                {searchQuery || filterStatus !== 'all' ? 'No Results Found' : 'No Standups Yet'}
              </h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                {searchQuery || filterStatus !== 'all'
                  ? "Try adjusting your search criteria or filters to find what you're looking for."
                  : 'Create your first standup configuration to begin collecting async updates from your teams.'}
              </p>
              {!searchQuery && filterStatus === 'all' && (
                <ModernButton
                  variant="primary"
                  onClick={() => toast.info('Navigate to a team to create standups')}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Standup
                </ModernButton>
              )}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
});
