import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ModernButton } from '@/components/ui';
import { LogOut, Users, Calendar, Settings, Zap } from 'lucide-react';
import { useAuth } from '@/contexts';
import { toast } from 'sonner';

export const Navbar = React.memo(() => {
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();

  // Don't show navbar on auth pages
  const isAuthPage = ['/login', '/signup', '/'].includes(location.pathname);

  if (!isAuthenticated || isAuthPage) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Error logging out');
    }
  };

  const navItems = [
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: Calendar,
      roles: ['owner', 'admin', 'member'] as const,
    },
    { path: '/teams', label: 'Teams', icon: Users, roles: ['owner', 'admin'] as const },
    { path: '/integrations', label: 'Integrations', icon: Zap, roles: ['owner', 'admin'] as const },
  ] as const;

  const isActiveRoute = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-card border-b border-border px-6 py-4 sticky top-0 z-40 backdrop-blur-sm bg-card/80"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/dashboard" className="text-2xl font-semibold gradient-text">
            AsyncStand
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            {navItems
              .filter(item => (user?.role ? item.roles.includes(user.role as any) : false))
              .map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    isActiveRoute(item.path)
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              ))}
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

          <div className="flex items-center gap-2">
            <ModernButton
              variant="ghost"
              size="sm"
              onClick={() => toast.info('Settings - Coming soon!')}
              data-testid="nav-settings-button"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline ml-2">Settings</span>
            </ModernButton>

            <ModernButton
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              data-testid="nav-logout-button"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline ml-2">Logout</span>
            </ModernButton>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden mt-4 pt-4 border-t border-border">
        <nav className="flex items-center gap-2">
          {navItems
            .filter(item => (user?.role ? item.roles.includes(user.role as any) : false))
            .map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors flex-1 justify-center ${
                  isActiveRoute(item.path)
                    ? 'text-primary bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
                data-testid={`nav-mobile-${item.label.toLowerCase()}`}
              >
                <item.icon className="w-4 h-4" />
                <span className="text-sm">{item.label}</span>
              </Link>
            ))}
        </nav>
      </div>
    </motion.header>
  );
});
