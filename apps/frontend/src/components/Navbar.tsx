import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut, Users, Calendar, Settings, Zap, BarChart3, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts';
import { toast } from '@/components/ui';

export const Navbar = React.memo(() => {
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);

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
      toast.error('Error logging out', { id: 'logout' });
    }
  };

  const handleMouseEnter = () => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
    setIsUserMenuOpen(true);
  };

  const handleMouseLeave = () => {
    const timeout = setTimeout(() => {
      setIsUserMenuOpen(false);
    }, 150); // Small delay to allow moving to dropdown
    setHoverTimeout(timeout);
  };

  const navItems = [
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: Calendar,
      roles: ['owner', 'admin', 'member'] as const,
    },
    { path: '/teams', label: 'Teams', icon: Users, roles: ['owner', 'admin'] as const },
    {
      path: '/standups',
      label: 'Standups',
      icon: Calendar,
      roles: ['owner', 'admin', 'member'] as const,
    },
    { path: '/integrations', label: 'Integrations', icon: Zap, roles: ['owner', 'admin'] as const },
    {
      path: '/reports',
      label: 'Reports',
      icon: BarChart3,
      roles: ['owner', 'admin'] as const,
      comingSoon: true,
    },
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
              .filter(item => {
                if (!user?.role) return false;
                // TypeScript will narrow the type based on the actual roles array
                return (item.roles as readonly string[]).includes(user.role);
              })
              .map(item => {
                const handleClick = (e: React.MouseEvent) => {
                  if ('comingSoon' in item && item.comingSoon) {
                    e.preventDefault();
                    toast.info(`${item.label} - Coming soon!`);
                  }
                };

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={handleClick}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                      isActiveRoute(item.path)
                        ? 'text-primary bg-primary/10'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    } ${'comingSoon' in item && item.comingSoon ? 'opacity-70' : ''}`}
                    data-testid={`nav-${item.label.toLowerCase()}`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                    {'comingSoon' in item && item.comingSoon && (
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded">Soon</span>
                    )}
                  </Link>
                );
              })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {/* User Menu */}
          <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
            <button className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="w-8 h-8 bg-gradient-to-r from-primary to-primary/80 rounded-full flex items-center justify-center">
                <span className="text-white font-medium text-sm">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-xl shadow-2xl backdrop-blur-md z-50"
              >
                <div className="p-3 border-b border-border">
                  <p className="font-medium text-sm">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                  <p className="text-xs text-muted-foreground mt-1 capitalize">
                    {user?.role} Account
                  </p>
                </div>

                <div className="p-2">
                  <button
                    onClick={() => {
                      toast.info('Settings - Coming soon!');
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                    data-testid="nav-settings-button"
                  >
                    <Settings className="w-4 h-4" />
                    <span className="text-sm">Settings</span>
                  </button>

                  <button
                    onClick={() => {
                      handleLogout();
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left text-red-600 hover:text-red-700"
                    data-testid="nav-logout-button"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm">Logout</span>
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden mt-4 pt-4 border-t border-border">
        <nav className="flex items-center gap-2">
          {navItems
            .filter(item => {
              if (!user?.role) return false;
              // TypeScript will narrow the type based on the actual roles array
              return (item.roles as readonly string[]).includes(user.role);
            })
            .map(item => {
              const handleMobileClick = (e: React.MouseEvent) => {
                if ('comingSoon' in item && item.comingSoon) {
                  e.preventDefault();
                  toast.info(`${item.label} - Coming soon!`);
                }
              };

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={handleMobileClick}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors flex-1 justify-center ${
                    isActiveRoute(item.path)
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  } ${'comingSoon' in item && item.comingSoon ? 'opacity-70' : ''}`}
                  data-testid={`nav-mobile-${item.label.toLowerCase()}`}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="text-sm">{item.label}</span>
                  {'comingSoon' in item && item.comingSoon && (
                    <span className="text-xs bg-muted px-1 py-0.5 rounded">Soon</span>
                  )}
                </Link>
              );
            })}
        </nav>
      </div>
    </motion.header>
  );
});
