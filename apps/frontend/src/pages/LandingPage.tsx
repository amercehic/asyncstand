import React, { useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ModernButton } from '@/components/ui';
import { ArrowRight, Zap, Shield, TrendingUp } from 'lucide-react';
import { usePerformanceMonitor } from '@/hooks';
import { useAuth } from '@/contexts';
import type { FeatureItem, StatItem } from '@/types';

interface FeatureCardProps extends FeatureItem {
  index: number;
}

const FeatureCard = React.memo<FeatureCardProps>(({ icon: Icon, title, description, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
    className="bg-card rounded-2xl p-8 shadow-card border border-border group hover:shadow-[0_8px_40px_rgba(0,0,0,0.25)] transition-all duration-300"
  >
    <div className="gradient-primary w-12 h-12 rounded-xl flex items-center justify-center mb-6 mx-auto group-hover:scale-110 transition-transform duration-300">
      <Icon className="w-6 h-6 text-white" />
    </div>
    <h3 className="text-xl mb-4">{title}</h3>
    <p className="text-muted-foreground leading-relaxed">{description}</p>
  </motion.div>
));

interface StatCardProps extends StatItem {
  index: number;
}

const StatCard = React.memo<StatCardProps>(({ value, label, index }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.5, delay: 0.1 + index * 0.1 }}
    className="text-center"
  >
    <div className="text-3xl lg:text-4xl font-semibold gradient-text mb-2">{value}</div>
    <div className="text-muted-foreground">{label}</div>
  </motion.div>
));

export const LandingPage = React.memo(() => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, user } = useAuth();
  const isNavigatingRef = useRef(false);
  usePerformanceMonitor('LandingPage');

  // Redirect authenticated users to appropriate dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, isLoading, user, navigate]);

  const handleNavigation = useCallback(
    (path: string) => {
      if (isNavigatingRef.current) return;
      isNavigatingRef.current = true;
      navigate(path);
      // Reset after a delay to prevent double clicks
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 1000);
    },
    [navigate]
  );
  const features = [
    {
      icon: Zap,
      title: 'Lightning Fast',
      description:
        'Instant updates and real-time collaboration without the overhead of traditional meetings.',
    },
    {
      icon: Shield,
      title: 'Enterprise Security',
      description:
        'Bank-level encryption and compliance with SOC 2, GDPR, and enterprise security standards.',
    },
    {
      icon: TrendingUp,
      title: 'Scale Effortlessly',
      description:
        'From small teams to enterprise organizations, AsyncStand grows with your needs.',
    },
  ];

  const stats = [
    { value: '50K+', label: 'Active Teams' },
    { value: '99.9%', label: 'Uptime' },
    { value: '40%', label: 'Time Saved' },
    { value: '150+', label: 'Countries' },
  ];

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
          className="text-2xl font-semibold gradient-text"
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.2 }}
        >
          AsyncStand
        </motion.div>
        <div className="flex items-center gap-4">
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
      </motion.nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-12 lg:py-20">
        <div className="text-center max-w-5xl mx-auto">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl sm:text-5xl lg:text-7xl mb-8 leading-tight font-extralight tracking-tight"
          >
            Async collaboration
            <span className="gradient-text"> reimagined</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-xl lg:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed"
          >
            Transform your team's productivity with intelligent async workflows. No more endless
            meetings, just seamless collaboration that works around your schedule.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-20"
          >
            <ModernButton
              size="lg"
              onClick={() => handleNavigation('/signup')}
              className="group"
              data-testid="start-trial-button"
            >
              Start Free Trial
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
            </ModernButton>
            <ModernButton variant="secondary" size="lg" data-testid="watch-demo-button">
              Watch Demo
            </ModernButton>
          </motion.div>

          {/* Feature Grid */}
          <div className="grid md:grid-cols-3 gap-8 mt-24">
            {features.map((feature, index) => (
              <FeatureCard key={feature.title} {...feature} index={index} />
            ))}
          </div>

          {/* Stats Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-24 py-16 border-t border-border"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat, index) => (
                <StatCard key={stat.label} {...stat} index={index} />
              ))}
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.7 }}
        className="border-t border-border mt-24"
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-muted-foreground mb-4 md:mb-0">
              © 2025 AsyncStand. All rights reserved.
            </div>
            <div className="flex gap-6 text-muted-foreground">
              <a
                href="#"
                className="hover:text-foreground transition-smooth"
                data-testid="privacy-link"
              >
                Privacy
              </a>
              <a
                href="#"
                className="hover:text-foreground transition-smooth"
                data-testid="terms-link"
              >
                Terms
              </a>
              <a
                href="#"
                className="hover:text-foreground transition-smooth"
                data-testid="support-link"
              >
                Support
              </a>
            </div>
          </div>
        </div>
      </motion.footer>
    </div>
  );
});
