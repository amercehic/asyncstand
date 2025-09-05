import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LogOut,
  Users,
  Calendar,
  Settings,
  Zap,
  BarChart3,
  ChevronDown,
  Menu,
  X,
  Shield,
} from 'lucide-react';
import { useAuth } from '@/contexts';
import { toast } from '@/components/ui';
import { useEnabledFeatures } from '@/hooks/useFeatureFlag';

// Safe auth hook that handles context errors
function useSafeAuth() {
  try {
    return useAuth();
  } catch {
    console.warn('Auth context not available in Navbar, using fallback');
    return {
      user: null,
      logout: async () => {
        throw new Error('Auth context not available');
      },
      isAuthenticated: false,
      isLoading: false,
    };
  }
}

// Helper component that only renders when not on auth pages
const NavbarContentSafe = React.memo(() => {
  const { user, logout, isAuthenticated, isLoading: authLoading } = useSafeAuth();
  const { features: enabledFeatures, loading: featuresLoading } = useEnabledFeatures(
    isAuthenticated && !user?.isSuperAdmin,
    authLoading
  );

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);

  if (!isAuthenticated) {
    return null;
  }

  // Show loading state while auth is loading or features are loading (except for super admins)
  if (authLoading || (!user?.isSuperAdmin && featuresLoading)) {
    return (
      <header className="bg-card border-b border-border sticky top-0 z-40 backdrop-blur-sm bg-card/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="text-xl sm:text-2xl font-semibold gradient-text flex-shrink-0">
              AsyncStand
            </div>
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </header>
    );
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
      featureKey: 'dashboard',
    },
    {
      path: '/teams',
      label: 'Teams',
      icon: Users,
      roles: ['owner', 'admin'] as const,
      featureKey: 'teams',
    },
    {
      path: '/standups',
      label: 'Standups',
      icon: Calendar,
      roles: ['owner', 'admin', 'member'] as const,
      featureKey: 'standups',
    },
    {
      path: '/integrations',
      label: 'Integrations',
      icon: Zap,
      roles: ['owner', 'admin'] as const,
      featureKey: 'integrations',
    },
    {
      path: '/reports',
      label: 'Reports',
      icon: BarChart3,
      roles: ['owner', 'admin'] as const,
      comingSoon: true,
      featureKey: 'reports',
    },
    {
      path: '/admin',
      label: 'Admin',
      icon: Shield,
      roles: ['owner', 'admin'] as const,
      superAdminOnly: true,
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
      className="bg-card border-b border-border sticky top-0 z-40 backdrop-blur-sm bg-card/80"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Main navbar */}
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            to={user?.isSuperAdmin ? '/admin' : '/dashboard'}
            className="text-xl sm:text-2xl font-semibold gradient-text flex-shrink-0"
          >
            AsyncStand
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-6">
            {navItems
              .filter(item => {
                if (!user?.role) return false;

                // If user is super admin, only show admin menu
                if (user.isSuperAdmin) {
                  return 'superAdminOnly' in item && item.superAdminOnly;
                }

                // For regular users, check role permissions
                const roleAllowed = (item.roles as readonly string[]).includes(user.role);
                if (!roleAllowed) return false;

                // Super admin pages are only for super admins
                if ('superAdminOnly' in item && item.superAdminOnly) {
                  return false;
                }

                // Check if feature is enabled (skip for super admins)
                if ('featureKey' in item && item.featureKey && !user.isSuperAdmin) {
                  if (!enabledFeatures.includes(item.featureKey)) {
                    return false;
                  }
                }

                return true;
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

          {/* Right side - User menu and mobile menu button */}
          <div className="flex items-center gap-2">
            {/* Desktop User Menu */}
            <div
              className="hidden sm:block relative"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <button className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="w-8 h-8 bg-gradient-to-r from-primary to-primary/80 rounded-full flex items-center justify-center">
                  <span className="text-white font-medium text-sm">
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Desktop Dropdown Menu */}
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
                    {!user?.isSuperAdmin && enabledFeatures.includes('settings') && (
                      <Link
                        to="/settings"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                        data-testid="nav-settings-button"
                      >
                        <Settings className="w-4 h-4" />
                        <span className="text-sm">Settings</span>
                      </Link>
                    )}

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

            {/* Mobile User Avatar (Simple) */}
            <div className="sm:hidden">
              <div className="w-8 h-8 bg-gradient-to-r from-primary to-primary/80 rounded-full flex items-center justify-center">
                <span className="text-white font-medium text-sm">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-muted/50 transition-colors"
              aria-label="Toggle mobile menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden border-t border-border py-4"
          >
            <nav className="space-y-2">
              {navItems
                .filter(item => {
                  if (!user?.role) return false;

                  // If user is super admin, only show admin menu
                  if (user.isSuperAdmin) {
                    return 'superAdminOnly' in item && item.superAdminOnly;
                  }

                  // For regular users, check role permissions
                  const roleAllowed = (item.roles as readonly string[]).includes(user.role);
                  if (!roleAllowed) return false;

                  // Super admin pages are only for super admins
                  if ('superAdminOnly' in item && item.superAdminOnly) {
                    return false;
                  }

                  // Check if feature is enabled (skip for super admins)
                  if ('featureKey' in item && item.featureKey && !user.isSuperAdmin) {
                    if (!enabledFeatures.includes(item.featureKey)) {
                      return false;
                    }
                  }

                  return true;
                })
                .map(item => {
                  const handleMobileClick = (e: React.MouseEvent) => {
                    if ('comingSoon' in item && item.comingSoon) {
                      e.preventDefault();
                      toast.info(`${item.label} - Coming soon!`);
                    } else {
                      setIsMobileMenuOpen(false);
                    }
                  };

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={handleMobileClick}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        isActiveRoute(item.path)
                          ? 'text-primary bg-primary/10'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      } ${'comingSoon' in item && item.comingSoon ? 'opacity-70' : ''}`}
                      data-testid={`nav-mobile-${item.label.toLowerCase()}`}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                      {'comingSoon' in item && item.comingSoon && (
                        <span className="text-xs bg-muted px-2 py-1 rounded ml-auto">Soon</span>
                      )}
                    </Link>
                  );
                })}
            </nav>

            {/* Mobile User Actions */}
            <div className="mt-6 pt-4 border-t border-border space-y-2">
              <div className="px-4 py-2">
                <p className="font-medium text-sm">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role} Account</p>
              </div>

              {!user?.isSuperAdmin && enabledFeatures.includes('settings') && (
                <Link
                  to="/settings"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                  data-testid="nav-mobile-settings-button"
                >
                  <Settings className="w-5 h-5" />
                  <span className="font-medium">Settings</span>
                </Link>
              )}

              <button
                onClick={() => {
                  handleLogout();
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors text-left text-red-600 hover:text-red-700"
                data-testid="nav-mobile-logout-button"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Logout</span>
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </motion.header>
  );
});

// Updated navbar with forced cache invalidation - v4 - 2025-09-04T07:35:00
export const Navbar = React.memo(() => {
  const location = useLocation();

  // Don't show navbar on auth pages - early return to avoid useAuth hook calls
  const isAuthPage = ['/login', '/signup', '/', '/auth'].includes(location.pathname);

  if (isAuthPage) {
    return null;
  }

  return <NavbarContentSafe />;
});
