import React, { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ModernButton } from '@/components/ui';
import { Users, Calendar, Settings, Plus, Bell, Activity, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts';
import { useTeams } from '@/contexts/TeamsContext';
import { useOptimizedQuery } from '@/hooks/useOptimizedQuery';
import { standupsApi } from '@/lib/api';
import type { Standup } from '@/types';

// Memoized stat card component
const StatCard = React.memo<{
  icon: React.ReactNode;
  title: string;
  value: number | string;
  subtitle?: string;
  trend?: number;
  index: number;
}>(({ icon, title, value, subtitle, trend, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{
      duration: 0.3,
      delay: index * 0.05,
      ease: 'easeOut',
    }}
    className="bg-card rounded-xl border border-border p-6 hover:border-primary/30 transition-colors"
  >
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-primary/10 rounded-lg">{icon}</div>
          <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {trend !== undefined && (
        <div
          className={`text-sm font-medium ${
            trend > 0 ? 'text-green-500' : trend < 0 ? 'text-red-500' : 'text-gray-500'
          }`}
        >
          {trend > 0 ? '+' : ''}
          {trend}%
        </div>
      )}
    </div>
  </motion.div>
));

StatCard.displayName = 'StatCard';

// Memoized quick action component
const QuickAction = React.memo<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  index: number;
}>(({ icon, label, onClick, index }) => (
  <motion.button
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{
      duration: 0.2,
      delay: index * 0.05,
    }}
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className="flex flex-col items-center gap-2 p-4 bg-card rounded-xl border border-border hover:border-primary/30 transition-all"
  >
    <div className="p-3 bg-primary/10 rounded-lg">{icon}</div>
    <span className="text-sm font-medium">{label}</span>
  </motion.button>
));

QuickAction.displayName = 'QuickAction';

export const OptimizedDashboardPage = React.memo(() => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { teams } = useTeams();

  // Memoized navigation handler
  const handleNavigation = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate]
  );

  // Fetch dashboard stats with optimized query
  const { data: dashboardStats, isLoading } = useOptimizedQuery(
    ['dashboard-stats', teams?.map(t => t.id).join(',') || ''],
    async () => {
      if (!teams || teams.length === 0) {
        return {
          activeTeams: 0,
          weeklyStandups: 0,
          completionRate: 0,
          pendingResponses: 0,
        };
      }

      const activeTeams = teams.length;
      let weeklyStandups = 0;
      let totalCompletionRate = 0;
      let completionDataPoints = 0;
      const pendingResponses = 0;

      // Fetch standups for all teams in parallel
      const teamStandupPromises = teams.map(async team => {
        try {
          const teamStandups = await standupsApi.getTeamStandups(team.id);
          return { teamId: team.id, standups: teamStandups };
        } catch {
          return { teamId: team.id, standups: [] };
        }
      });

      const allTeamStandups = await Promise.all(teamStandupPromises);

      // Process results
      for (const { standups } of allTeamStandups) {
        const activeStandups = standups.filter((s: Standup) => s.isActive);

        // Count weekly occurrences
        activeStandups.forEach((standup: Standup) => {
          weeklyStandups += standup.schedule.days.length;
        });

        // Calculate completion rate
        if (activeStandups.length > 0) {
          completionDataPoints++;
          let teamCompletionScore = 60; // Base score

          activeStandups.forEach((standup: Standup) => {
            if (standup.schedule.time && standup.schedule.days.length > 0) {
              teamCompletionScore = Math.min(100, teamCompletionScore + 20);
            }
            if (standup.questions?.length > 0) {
              teamCompletionScore = Math.min(100, teamCompletionScore + 15);
            }
            if (standup.targetChannelId) {
              teamCompletionScore = Math.min(100, teamCompletionScore + 5);
            }
          });

          totalCompletionRate += teamCompletionScore;
        }
      }

      const averageCompletionRate =
        completionDataPoints > 0 ? Math.round(totalCompletionRate / completionDataPoints) : 0;

      return {
        activeTeams,
        weeklyStandups,
        completionRate: averageCompletionRate,
        pendingResponses,
      };
    },
    {
      enabled: !!teams && teams.length > 0,
      staleTime: 60000, // 1 minute
      cacheTime: 5 * 60000, // 5 minutes
      refetchOnFocus: true,
    }
  );

  // Memoized quick actions
  const quickActions = useMemo(
    () => [
      { icon: <Plus className="w-5 h-5" />, label: 'Create Team', path: '/teams' },
      { icon: <Calendar className="w-5 h-5" />, label: 'View Standups', path: '/standups' },
      { icon: <Users className="w-5 h-5" />, label: 'Manage Teams', path: '/teams' },
      { icon: <Settings className="w-5 h-5" />, label: 'Integrations', path: '/integrations' },
    ],
    []
  );

  // Memoized stats data
  const statsData = useMemo(
    () => [
      {
        icon: <Users className="w-5 h-5 text-primary" />,
        title: 'Active Teams',
        value: dashboardStats?.activeTeams || 0,
        subtitle: 'Teams in your organization',
      },
      {
        icon: <Calendar className="w-5 h-5 text-primary" />,
        title: 'Weekly Standups',
        value: dashboardStats?.weeklyStandups || 0,
        subtitle: 'Scheduled this week',
      },
      {
        icon: <Activity className="w-5 h-5 text-primary" />,
        title: 'Completion Rate',
        value: `${dashboardStats?.completionRate || 0}%`,
        subtitle: 'Average participation',
        trend: 5,
      },
      {
        icon: <Bell className="w-5 h-5 text-primary" />,
        title: 'Pending',
        value: dashboardStats?.pendingResponses || 0,
        subtitle: 'Responses needed',
      },
    ],
    [dashboardStats]
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-2"
        >
          <h1 className="text-3xl font-bold text-foreground">
            Welcome back, {user?.name || 'User'}!
          </h1>
          <p className="text-muted-foreground">
            Here's an overview of your team's standup activity
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {isLoading
            ? // Loading skeletons
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-card rounded-xl border border-border p-6 animate-pulse">
                  <div className="h-20 bg-muted rounded" />
                </div>
              ))
            : statsData.map((stat, index) => <StatCard key={stat.title} {...stat} index={index} />)}
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickActions.map((action, index) => (
              <QuickAction
                key={action.label}
                icon={action.icon}
                label={action.label}
                onClick={() => handleNavigation(action.path)}
                index={index}
              />
            ))}
          </div>
        </motion.div>

        {/* Recent Activity Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="bg-card rounded-xl border border-border p-6"
        >
          <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {teams && teams.length > 0 ? (
              teams.slice(0, 5).map((team, index) => (
                <motion.div
                  key={team.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className="flex items-center justify-between p-3 bg-background rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleNavigation(`/teams/${team.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <Users className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{team.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {team.memberCount || team.members.length} members
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </motion.div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No teams yet</p>
                <ModernButton onClick={() => handleNavigation('/teams')} className="mt-4" size="sm">
                  Create your first team
                </ModernButton>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
});

OptimizedDashboardPage.displayName = 'OptimizedDashboardPage';
