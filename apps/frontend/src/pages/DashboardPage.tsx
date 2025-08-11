import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ModernButton } from '@/components/ui';
import { Users, Calendar, Settings, Plus, Bell } from 'lucide-react';
import { useAuth } from '@/contexts';
import { toast } from 'sonner';

export const DashboardPage = React.memo(() => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const stats = [
    { label: 'Active Teams', value: '2', icon: Users },
    { label: "This Week's Standups", value: '8', icon: Calendar },
    { label: 'Completion Rate', value: '95%', icon: Bell },
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
