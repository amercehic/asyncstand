import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ModernButton } from '@/components/ui';
import { LogOut, Users, Calendar, Settings, Plus, Bell } from 'lucide-react';
import { useAuth } from '@/contexts';
import { toast } from 'sonner';

export const DashboardPage = React.memo(() => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Error logging out');
    }
  };

  const handleNavigation = (path: string) => {
    toast.info(`Navigation to ${path} - Coming soon!`);
  };

  const stats = [
    { label: 'Active Teams', value: '2', icon: Users },
    { label: "This Week's Standups", value: '8', icon: Calendar },
    { label: 'Completion Rate', value: '95%', icon: Bell },
  ];

  const quickActions = [
    { label: 'Create Team', icon: Plus, action: () => handleNavigation('/teams/create') },
    { label: 'Join Team', icon: Users, action: () => handleNavigation('/teams/join') },
    {
      label: 'Schedule Standup',
      icon: Calendar,
      action: () => handleNavigation('/standups/create'),
    },
    { label: 'Settings', icon: Settings, action: () => handleNavigation('/settings') },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-card border-b border-border px-6 py-4"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="text-2xl font-semibold gradient-text">AsyncStand</div>
            <nav className="hidden md:flex items-center gap-6">
              <button
                className="text-muted-foreground hover:text-foreground transition-smooth"
                onClick={() => handleNavigation('/dashboard')}
                data-testid="nav-dashboard"
              >
                Dashboard
              </button>
              <button
                className="text-muted-foreground hover:text-foreground transition-smooth"
                onClick={() => handleNavigation('/teams')}
                data-testid="nav-teams"
              >
                Teams
              </button>
              <button
                className="text-muted-foreground hover:text-foreground transition-smooth"
                onClick={() => handleNavigation('/standups')}
                data-testid="nav-standups"
              >
                Standups
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-primary to-primary/80 rounded-full flex items-center justify-center">
                <span className="text-white font-medium text-sm">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <ModernButton
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              data-testid="logout-button"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline ml-2">Logout</span>
            </ModernButton>
          </div>
        </div>
      </motion.header>

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
            onClick={() => handleNavigation('/teams/create')}
            data-testid="create-first-team-button"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Team
          </ModernButton>
        </motion.div>
      </main>
    </div>
  );
});
