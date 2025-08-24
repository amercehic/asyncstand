import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ModernButton } from '@/components/ui';
import {
  ArrowRight,
  Zap,
  Shield,
  TrendingUp,
  Users,
  Building2,
  Globe,
  Lock,
  Link2,
  FileText,
  UserCheck,
  Settings,
  Activity,
  Calendar,
} from 'lucide-react';

interface FeatureCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  category: string;
  index: number;
}

const FeatureCard: React.FC<FeatureCardProps> = ({
  icon: Icon,
  title,
  description,
  category,
  index,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay: index * 0.05 }}
    className="bg-card rounded-xl p-6 border border-border hover:border-primary/50 transition-all duration-300 group"
  >
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{category}</span>
        <h3 className="font-medium mt-1 mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  </motion.div>
);

export const FeaturesPage: React.FC = () => {
  const navigate = useNavigate();

  const coreFeatures = [
    {
      icon: Zap,
      title: 'Automated Standups',
      description:
        'Schedule daily, weekly, or custom standups that run automatically through your preferred communication channels.',
      category: 'Automation',
    },
    {
      icon: Shield,
      title: 'Smart Reminders',
      description:
        'Intelligent reminder system that learns from team patterns and ensures high participation rates.',
      category: 'Automation',
    },
    {
      icon: TrendingUp,
      title: 'Team Analytics',
      description:
        'Comprehensive dashboards showing participation rates, response patterns, and team engagement metrics.',
      category: 'Analytics',
    },
  ];

  const allFeatures = [
    {
      icon: Lock,
      title: 'Enterprise Security',
      description:
        'JWT authentication, role-based access control, and comprehensive audit logging for SOC2 compliance.',
      category: 'Security',
    },
    {
      icon: Users,
      title: 'Team Management',
      description:
        'Create multiple teams, assign members, manage roles, and link directly to communication channels.',
      category: 'Organization',
    },
    {
      icon: Building2,
      title: 'Multi-Tenant Architecture',
      description:
        'Isolated workspaces for each organization with custom settings, branding, and permissions.',
      category: 'Organization',
    },
    {
      icon: Globe,
      title: 'Timezone Intelligence',
      description:
        'Automatically handles team members across different timezones with smart scheduling and reminders.',
      category: 'Productivity',
    },
    {
      icon: Link2,
      title: 'Magic Links',
      description:
        'One-click standup responses via secure magic tokens - no login required for quick updates.',
      category: 'Experience',
    },
    {
      icon: FileText,
      title: 'Response History',
      description:
        'Searchable archive of all standup responses with filtering, export, and reporting capabilities.',
      category: 'Analytics',
    },
    {
      icon: UserCheck,
      title: 'Member Tracking',
      description:
        'Monitor individual participation, identify patterns, and support team members who need help.',
      category: 'Management',
    },
    {
      icon: Settings,
      title: 'Custom Questions',
      description:
        'Create tailored standup questions, templates, and workflows that match your team needs.',
      category: 'Customization',
    },
    {
      icon: Activity,
      title: 'Real-time Updates',
      description:
        'Live dashboard showing standup progress, team responses, and activity as it happens.',
      category: 'Experience',
    },
    {
      icon: Calendar,
      title: 'Smart Scheduling',
      description: 'Automated scheduling that works around your team calendar and availability.',
      category: 'Productivity',
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 lg:px-8 py-6 max-w-7xl mx-auto">
        <div
          className="text-2xl font-semibold gradient-text cursor-pointer"
          onClick={() => navigate('/')}
        >
          AsyncStand
        </div>
        <div className="hidden md:flex items-center gap-8">
          <a className="text-foreground font-medium">Features</a>
          <a
            onClick={() => navigate('/integrations')}
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Integrations
          </a>
          <a
            onClick={() => navigate('/pricing')}
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Pricing
          </a>
          <div className="flex items-center gap-4 ml-4">
            <ModernButton variant="ghost" onClick={() => navigate('/login')}>
              Log In
            </ModernButton>
            <ModernButton variant="primary" onClick={() => navigate('/signup')}>
              Get Started
            </ModernButton>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 py-12 lg:py-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h1 className="text-4xl sm:text-5xl lg:text-6xl mb-6 font-extralight tracking-tight">
            Features that make
            <span className="gradient-text block">standups effortless</span>
          </h1>
          <p className="text-xl text-muted-foreground">
            Everything you need to run effective async standups, keep your team aligned, and gain
            insights into team productivity.
          </p>
        </motion.div>

        {/* Core Features */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-24"
        >
          <h2 className="text-2xl font-light text-center mb-12">Core Capabilities</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {coreFeatures.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
                className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-8 border border-primary/20"
              >
                <div className="gradient-primary w-12 h-12 rounded-xl flex items-center justify-center mb-6">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl mb-4">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* All Features Grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-24"
        >
          <h2 className="text-2xl font-light text-center mb-12">Complete Feature Set</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allFeatures.map((feature, index) => (
              <FeatureCard key={feature.title} {...feature} index={index} />
            ))}
          </div>
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center py-16 bg-card rounded-2xl border border-border"
        >
          <h2 className="text-3xl font-light mb-4">Ready to get started?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join teams saving hours every week with automated standups
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <ModernButton size="lg" onClick={() => navigate('/signup')} className="group">
              Start Free Trial
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </ModernButton>
            <ModernButton variant="secondary" size="lg" onClick={() => navigate('/pricing')}>
              View Pricing
            </ModernButton>
          </div>
        </motion.div>
      </section>
    </div>
  );
};
