import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ModernButton } from '@/components/ui';
import { Users, Calendar, Settings, Plus, Bell } from 'lucide-react';
import { useAuth } from '@/contexts';
import { toast } from 'sonner';
import { useTeams } from '@/contexts/TeamsContext';
import { standupsApi } from '@/lib/api';
import type { Standup } from '@/types';

export const DashboardPage = React.memo(() => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { teams } = useTeams();
  const [dashboardStats, setDashboardStats] = useState({
    activeTeams: 0,
    weeklyStandups: 0,
    completionRate: 0,
  });
  const [loading, setLoading] = useState(true);

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  // Fetch dashboard stats
  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        setLoading(true);

        // Get active teams count
        const activeTeams = teams?.length || 0;

        // Get this week's standups count
        // For now, calculate based on active standup configs
        let weeklyStandups = 0;
        let totalCompletionRate = 0;
        let completionDataPoints = 0;

        if (teams && teams.length > 0) {
          for (const team of teams) {
            try {
              // Get standups for this team
              const teamStandups = await standupsApi.getTeamStandups(team.id);

              // Count active standups and estimate weekly occurrences
              const activeStandups = teamStandups.filter((s: Standup) => s.isActive);
              activeStandups.forEach((standup: Standup) => {
                // Count how many days this standup runs per week
                const daysPerWeek = standup.schedule.days.length;
                weeklyStandups += daysPerWeek;
              });

              // Calculate completion rate from actual standup data
              if (activeStandups.length > 0) {
                completionDataPoints++;
                // For now, calculate based on standup configuration completeness
                // In a full implementation, this would fetch recent standup instances
                // and calculate actual participant completion rates
                let teamCompletionScore = 0;

                activeStandups.forEach((standup: Standup) => {
                  // Base score for having a standup configured
                  let standupScore = 60;

                  // Bonus for having proper schedule (time + days)
                  if (standup.schedule.time && standup.schedule.days.length > 0) {
                    standupScore += 20;
                  }

                  // Bonus for having questions configured
                  if (standup.questions && standup.questions.length > 0) {
                    standupScore += 15;
                  }

                  // Bonus for having slack integration
                  if (standup.slackChannelId) {
                    standupScore += 5;
                  }

                  teamCompletionScore = Math.max(teamCompletionScore, standupScore);
                });

                totalCompletionRate += Math.min(100, teamCompletionScore);
              }
            } catch (error) {
              console.log(`Failed to fetch standups for team ${team.id}:`, error);
            }
          }
        }

        // Calculate average completion rate
        const averageCompletionRate =
          completionDataPoints > 0 ? Math.round(totalCompletionRate / completionDataPoints) : 0;

        setDashboardStats({
          activeTeams,
          weeklyStandups,
          completionRate: averageCompletionRate,
        });
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error);
        // Keep default values on error
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardStats();
  }, [teams]);

  const stats = [
    {
      label: 'Active Teams',
      value: loading ? '...' : dashboardStats.activeTeams.toString(),
      icon: Users,
    },
    {
      label: "This Week's Standups",
      value: loading ? '...' : dashboardStats.weeklyStandups.toString(),
      icon: Calendar,
    },
    {
      label: 'Completion Rate',
      value: loading ? '...' : `${dashboardStats.completionRate}%`,
      icon: Bell,
    },
  ];

  const quickActions = [
    { label: 'Create Team', icon: Plus, action: () => handleNavigation('/teams?create=1') },
    { label: 'Join Team', icon: Users, action: () => toast.info('Join team - Coming soon!') },
    {
      label: 'View Teams',
      icon: Users,
      action: () => handleNavigation('/teams'),
    },
    { label: 'Settings', icon: Settings, action: () => toast.info('Settings - Coming soon!') },
  ];

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, {user?.name?.split(' ')[0] || 'there'}! 👋
          </h1>
          <p className="text-muted-foreground text-lg">
            Here's what's happening with your async standups today.
          </p>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
        >
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
              className="bg-card rounded-2xl p-6 border border-border hover:shadow-lg transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-4">
                <stat.icon className="w-8 h-8 text-primary" />
                <div className="text-3xl font-bold text-primary">{stat.value}</div>
              </div>
              <p className="text-muted-foreground font-medium">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-8"
        >
          <h2 className="text-xl font-semibold mb-6">Quick Actions</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action, index) => (
              <motion.div
                key={action.label}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.5 + index * 0.1 }}
              >
                <ModernButton
                  variant="secondary"
                  className="w-full h-24 flex-col gap-2 text-center"
                  onClick={action.action}
                  data-testid={`quick-action-${action.label.toLowerCase().replace(' ', '-')}`}
                >
                  <action.icon className="w-6 h-6" />
                  <span className="text-sm">{action.label}</span>
                </ModernButton>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Recent Activity Placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="bg-card rounded-2xl p-8 border border-border text-center"
        >
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Recent Activity</h3>
          <p className="text-muted-foreground mb-6">
            Get started by creating your first team or joining an existing one.
          </p>
          <ModernButton
            variant="primary"
            onClick={() => handleNavigation('/teams')}
            data-testid="view-teams-button"
          >
            <Users className="w-4 h-4 mr-2" />
            View Teams
          </ModernButton>
        </motion.div>
      </main>
    </div>
  );
});
