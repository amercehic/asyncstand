import React, { useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ModernButton } from '@/components/ui';
import { ArrowRight, Zap, Clock, Users, BarChart3 } from 'lucide-react';
import { usePerformanceMonitor } from '@/hooks';
import { useAuth } from '@/contexts';

export const LandingPage = React.memo(() => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const isNavigatingRef = useRef(false);
  usePerformanceMonitor('LandingPage');

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleNavigation = useCallback(
    (path: string) => {
      if (isNavigatingRef.current) return;
      isNavigatingRef.current = true;
      navigate(path);
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 1000);
    },
    [navigate]
  );

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between px-6 lg:px-8 py-6 max-w-7xl mx-auto"
      >
        <motion.div
          className="text-2xl font-semibold gradient-text cursor-pointer"
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.2 }}
          onClick={() => handleNavigation('/')}
        >
          AsyncStand
        </motion.div>
        <div className="hidden md:flex items-center gap-8">
          <a
            onClick={() => handleNavigation('/features')}
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Features
          </a>
          <a
            onClick={() => handleNavigation('/integrations')}
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Integrations
          </a>
          <a
            onClick={() => handleNavigation('/pricing')}
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Pricing
          </a>
          <div className="flex items-center gap-4 ml-4">
            <ModernButton
              variant="ghost"
              onClick={() => handleNavigation('/login')}
              data-testid="login-button"
            >
              Log In
            </ModernButton>
            <ModernButton
              variant="primary"
              onClick={() => handleNavigation('/signup')}
              data-testid="get-started-button"
            >
              Get Started
            </ModernButton>
          </div>
        </div>
        <div className="md:hidden">
          <ModernButton variant="primary" size="sm" onClick={() => handleNavigation('/signup')}>
            Get Started
          </ModernButton>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-12 lg:py-24">
        <div className="text-center max-w-5xl mx-auto">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-5xl sm:text-6xl lg:text-7xl mb-8 leading-tight font-extralight tracking-tight"
          >
            Async standups that
            <span className="gradient-text block">actually work</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-xl lg:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed"
          >
            Replace time-consuming standup meetings with automated async check-ins. Keep your
            distributed team aligned without the scheduling hassle.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16"
          >
            <ModernButton
              size="lg"
              onClick={() => handleNavigation('/signup')}
              className="group min-w-[200px]"
              data-testid="start-trial-button"
            >
              Start Free Trial
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
            </ModernButton>
            <ModernButton
              variant="secondary"
              size="lg"
              onClick={() => handleNavigation('/features')}
              className="min-w-[200px]"
              data-testid="explore-features-button"
            >
              Explore Features
            </ModernButton>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-sm text-muted-foreground mb-16"
          >
            No credit card required · 14-day free trial · Setup in 5 minutes
          </motion.p>

          {/* Quick Value Props */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 py-12 border-t border-border"
          >
            <div className="text-center">
              <Zap className="w-8 h-8 text-primary mx-auto mb-3" />
              <h3 className="font-medium mb-1">Automated</h3>
              <p className="text-sm text-muted-foreground">Runs on autopilot</p>
            </div>
            <div className="text-center">
              <Clock className="w-8 h-8 text-primary mx-auto mb-3" />
              <h3 className="font-medium mb-1">Async-First</h3>
              <p className="text-sm text-muted-foreground">Work across timezones</p>
            </div>
            <div className="text-center">
              <Users className="w-8 h-8 text-primary mx-auto mb-3" />
              <h3 className="font-medium mb-1">Team Insights</h3>
              <p className="text-sm text-muted-foreground">Track participation</p>
            </div>
            <div className="text-center">
              <BarChart3 className="w-8 h-8 text-primary mx-auto mb-3" />
              <h3 className="font-medium mb-1">Analytics</h3>
              <p className="text-sm text-muted-foreground">Data-driven decisions</p>
            </div>
          </motion.div>

          {/* Social Proof */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-16 p-8 bg-card rounded-2xl border border-border"
          >
            <p className="text-lg text-muted-foreground mb-6">
              "AsyncStand transformed how our distributed team collaborates. We save 5+ hours per
              week and our participation rate went from 60% to 95%."
            </p>
            <div className="flex items-center justify-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full" />
              <div className="text-left">
                <p className="font-medium">Sarah Chen</p>
                <p className="text-sm text-muted-foreground">Engineering Manager at TechCorp</p>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.6 }}
        className="border-t border-border mt-24"
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h4 className="font-medium mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a
                    onClick={() => handleNavigation('/features')}
                    className="hover:text-foreground transition-colors cursor-pointer"
                  >
                    Features
                  </a>
                </li>
                <li>
                  <a
                    onClick={() => handleNavigation('/integrations')}
                    className="hover:text-foreground transition-colors cursor-pointer"
                  >
                    Integrations
                  </a>
                </li>
                <li>
                  <a
                    onClick={() => handleNavigation('/pricing')}
                    className="hover:text-foreground transition-colors cursor-pointer"
                  >
                    Pricing
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Careers
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Documentation
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    API Reference
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Status
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Privacy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Terms
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Security
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
            © 2025 AsyncStand. All rights reserved.
          </div>
        </div>
      </motion.footer>
    </div>
  );
});
