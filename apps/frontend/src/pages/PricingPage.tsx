import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ModernButton } from '@/components/ui';
import {
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Users,
  Building2,
  Shield,
  Clock,
  Zap,
} from 'lucide-react';

export const PricingPage: React.FC = () => {
  const navigate = useNavigate();

  const plans = [
    {
      name: 'Starter',
      description: 'Perfect for small teams getting started',
      features: [
        'Up to 10 team members',
        '1 team workspace',
        'Slack integration',
        'Basic standup templates',
        '7-day response history',
        'Email support',
      ],
      icon: Users,
      badge: 'Free Forever',
    },
    {
      name: 'Team',
      description: 'For growing teams that need more power',
      features: [
        'Unlimited team members',
        'Unlimited teams',
        'All integrations',
        'Response analytics',
        'Unlimited response history',
        'Custom questions & templates',
        'Priority email support',
      ],
      icon: Sparkles,
      badge: 'Most Popular',
      highlighted: true,
    },
    {
      name: 'Enterprise',
      description: 'For large organizations with specific needs',
      features: [
        'Everything in Team',
        'SSO/SAML authentication',
        'Advanced security features',
        'Custom integrations',
        'Dedicated account manager',
        'SLA guarantee',
        'Custom training',
        'Phone & video support',
      ],
      icon: Building2,
      badge: 'Custom',
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
          <a
            onClick={() => navigate('/features')}
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Features
          </a>
          <a
            onClick={() => navigate('/integrations')}
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Integrations
          </a>
          <a className="text-foreground font-medium">Pricing</a>
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
            Simple, transparent
            <span className="gradient-text block">pricing coming soon</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            We're finalizing our pricing to ensure it's perfect for teams of all sizes. Start free
            today and we'll notify you when paid plans are available.
          </p>
        </motion.div>

        {/* Plans Preview */}
        <div className="grid md:grid-cols-3 gap-8 mb-24">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 + index * 0.1 }}
              className={`relative bg-card rounded-2xl p-8 border ${
                plan.highlighted ? 'border-primary/50 shadow-xl' : 'border-border'
              }`}
            >
              {plan.badge && (
                <div
                  className={`absolute -top-3 left-1/2 -translate-x-1/2 ${
                    plan.badge === 'Most Popular' ? 'bg-primary' : 'bg-muted'
                  } text-${plan.badge === 'Most Popular' ? 'white' : 'foreground'} text-xs px-3 py-1 rounded-full`}
                >
                  {plan.badge}
                </div>
              )}

              <div className="mb-8">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-4">
                  <plan.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-medium mb-2">{plan.name}</h3>
                <p className="text-muted-foreground">{plan.description}</p>
              </div>

              <div className="space-y-3">
                {plan.features.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Coming Soon Notice */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-12 border border-primary/20 mb-24 text-center"
        >
          <Clock className="w-12 h-12 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-light mb-4">Pricing Announcement Coming Soon</h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            We're working hard to create the most competitive and fair pricing for async standups.
            Join our free tier today and you'll be the first to know when paid plans launch.
          </p>
          <div className="flex items-center justify-center gap-4">
            <ModernButton size="lg" onClick={() => navigate('/signup')} className="group">
              Start Free Today
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </ModernButton>
          </div>
        </motion.div>

        {/* What's Included */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-24"
        >
          <h2 className="text-2xl font-light text-center mb-12">
            Always Included, No Matter the Plan
          </h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="text-center">
              <Shield className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="font-medium mb-2">Bank-level Security</h3>
              <p className="text-sm text-muted-foreground">
                256-bit encryption, SOC2 compliant infrastructure
              </p>
            </div>
            <div className="text-center">
              <Zap className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="font-medium mb-2">99.9% Uptime</h3>
              <p className="text-sm text-muted-foreground">
                Reliable service with redundant infrastructure
              </p>
            </div>
            <div className="text-center">
              <Sparkles className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="font-medium mb-2">Regular Updates</h3>
              <p className="text-sm text-muted-foreground">
                New features and improvements every month
              </p>
            </div>
          </div>
        </motion.div>

        {/* Early Access CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-center py-16 bg-card rounded-2xl border border-border"
        >
          <h2 className="text-3xl font-light mb-4">Get Early Access</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Be among the first to try AsyncStand. Start free, no credit card required.
          </p>
          <ModernButton size="lg" onClick={() => navigate('/signup')} className="group">
            Join Early Access
            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </ModernButton>
          <p className="text-sm text-muted-foreground mt-4">
            Currently free for all early access users
          </p>
        </motion.div>
      </section>
    </div>
  );
};
