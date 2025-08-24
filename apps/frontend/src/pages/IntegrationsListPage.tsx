import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ModernButton } from '@/components/ui';
import { ArrowRight, CheckCircle2, Slack, MessageSquare, Bot, Users } from 'lucide-react';

interface IntegrationCardProps {
  name: string;
  icon: React.ElementType;
  description: string;
  features: string[];
  status: 'available' | 'coming' | 'planned';
  category: string;
  index: number;
}

const IntegrationCard: React.FC<IntegrationCardProps> = ({
  name,
  icon: Icon,
  description,
  features,
  status,
  category,
  index,
}) => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 + index * 0.05 }}
      className={`bg-card rounded-xl p-6 border ${
        status === 'available' ? 'border-green-500/30' : 'border-border'
      } hover:border-primary/50 transition-all duration-300 group relative`}
    >
      {status === 'coming' && (
        <div className="absolute -top-3 right-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs px-3 py-1 rounded-full">
          Coming Soon
        </div>
      )}
      {status === 'planned' && (
        <div className="absolute -top-3 right-4 bg-muted text-muted-foreground text-xs px-3 py-1 rounded-full">
          Planned
        </div>
      )}

      <div className="flex items-start gap-4 mb-4">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            status === 'available'
              ? 'bg-gradient-to-br from-green-500/20 to-green-500/10'
              : 'bg-muted'
          }`}
        >
          <Icon
            className={`w-6 h-6 ${
              status === 'available' ? 'text-green-500' : 'text-muted-foreground'
            }`}
          />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-medium mb-1">{name}</h3>
          <span className="text-xs text-muted-foreground uppercase tracking-wider">{category}</span>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-4">{description}</p>

      <div className="space-y-2 mb-4">
        {features.slice(0, 3).map((feature, idx) => (
          <div key={idx} className="flex items-center gap-2 text-sm">
            <CheckCircle2
              className={`w-4 h-4 ${
                status === 'available' ? 'text-green-500' : 'text-muted-foreground'
              }`}
            />
            <span className={status !== 'available' ? 'text-muted-foreground' : ''}>{feature}</span>
          </div>
        ))}
      </div>

      {status === 'available' && (
        <ModernButton
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={() => navigate('/signup')}
        >
          Connect Now
        </ModernButton>
      )}
    </motion.div>
  );
};

export const IntegrationsListPage: React.FC = () => {
  const navigate = useNavigate();

  const integrations = [
    {
      name: 'Slack',
      icon: Slack,
      description: 'Full integration with Slack workspaces for seamless standup management.',
      features: [
        'OAuth 2.0 authentication',
        'Channel-based standups',
        'Direct message reminders',
        'Thread organization',
        'Emoji reactions',
        'Slash commands',
      ],
      status: 'available' as const,
      category: 'communication',
    },
    {
      name: 'Microsoft Teams',
      icon: MessageSquare,
      description: 'Native Teams integration for enterprise environments.',
      features: [
        'Teams & Channels support',
        'Adaptive Cards UI',
        'Graph API integration',
        'SSO authentication',
        'Compliance ready',
        'Activity feed updates',
      ],
      status: 'coming' as const,
      category: 'communication',
    },
    {
      name: 'Discord',
      icon: Bot,
      description: 'Perfect for community teams and open source projects.',
      features: [
        'Server & Channel support',
        'Bot commands',
        'Role-based permissions',
        'Webhooks',
        'Rich embeds',
        'Voice channel integration',
      ],
      status: 'coming' as const,
      category: 'communication',
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
          <a className="text-foreground font-medium">Integrations</a>
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
            Connect with your
            <span className="gradient-text block">favorite tools</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            AsyncStand integrates seamlessly with the tools your team already uses. More
            integrations coming soon!
          </p>

          {/* Stats */}
          <div className="flex justify-center gap-8 mb-8">
            <div className="text-center">
              <div className="text-3xl font-bold gradient-text">1</div>
              <div className="text-sm text-muted-foreground">Available Now</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-500">2</div>
              <div className="text-sm text-muted-foreground">Coming Soon</div>
            </div>
          </div>
        </motion.div>

        {/* Integrations Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-24 max-w-5xl mx-auto">
          {integrations.map((integration, index) => (
            <IntegrationCard key={integration.name} {...integration} index={index} />
          ))}
        </div>

        {/* API Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-12 border border-primary/20 mb-24"
        >
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-light mb-4">Build Custom Integrations</h2>
            <p className="text-xl text-muted-foreground mb-8">
              Use our REST API and webhooks to create custom integrations with your internal tools.
            </p>
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-card rounded-xl p-4 border border-border">
                <h3 className="font-medium mb-2">REST API</h3>
                <p className="text-sm text-muted-foreground">
                  Full CRUD operations for standups, teams, and responses
                </p>
              </div>
              <div className="bg-card rounded-xl p-4 border border-border">
                <h3 className="font-medium mb-2">Webhooks</h3>
                <p className="text-sm text-muted-foreground">
                  Real-time notifications for standup events
                </p>
              </div>
              <div className="bg-card rounded-xl p-4 border border-border">
                <h3 className="font-medium mb-2">OAuth 2.0</h3>
                <p className="text-sm text-muted-foreground">
                  Secure authentication for third-party apps
                </p>
              </div>
            </div>
            <ModernButton variant="secondary" onClick={() => window.open('/docs/api', '_blank')}>
              View API Documentation
            </ModernButton>
          </div>
        </motion.div>

        {/* Request Integration */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center py-16 bg-card rounded-2xl border border-border"
        >
          <Users className="w-12 h-12 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-light mb-4">Don't see your tool?</h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            We're constantly adding new integrations based on user feedback. Let us know what tools
            you'd like to see integrated.
          </p>
          <ModernButton variant="secondary">Request Integration</ModernButton>
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-center py-16 mt-24"
        >
          <h2 className="text-3xl font-light mb-4">Ready to connect your tools?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Start with Slack today, more integrations coming soon
          </p>
          <ModernButton size="lg" onClick={() => navigate('/signup')} className="group">
            Get Started Free
            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </ModernButton>
        </motion.div>
      </section>
    </div>
  );
};
