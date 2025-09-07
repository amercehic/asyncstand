import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  ArrowLeft,
  Crown,
  Zap,
  Users,
  FileText,
  Shield,
  Star,
  TrendingUp,
  Calendar,
  CreditCard,
  Loader2,
} from 'lucide-react';
import { ModernButton, toast } from '@/components/ui';
import { useBillingPlans, useBillingSubscription } from '@/hooks/useBillingData';
import { UpgradePaymentModal } from '@/components/billing/UpgradePaymentModal';
import type { BillingPlan } from '@/lib/api-client/billing';

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

// Note: Plan data now comes from the API via useBillingPlans hook

// Plan comparison features
const comparisonFeatures = [
  {
    category: 'Core Features',
    features: [
      { name: 'Team Members', starter: '10', professional: '50', enterprise: 'Unlimited' },
      { name: 'Storage', starter: '100 GB', professional: '500 GB', enterprise: 'Unlimited' },
      {
        name: 'API Calls',
        starter: '10K/month',
        professional: '100K/month',
        enterprise: 'Unlimited',
      },
      { name: 'Uptime SLA', starter: '99.9%', professional: '99.95%', enterprise: '99.99%' },
    ],
  },
  {
    category: 'Analytics & Reporting',
    features: [
      { name: 'Basic Analytics', starter: true, professional: true, enterprise: true },
      { name: 'Advanced Analytics', starter: false, professional: true, enterprise: true },
      { name: 'Custom Reports', starter: false, professional: false, enterprise: true },
      { name: 'Real-time Dashboards', starter: false, professional: true, enterprise: true },
    ],
  },
  {
    category: 'Support & Security',
    features: [
      { name: 'Email Support', starter: true, professional: true, enterprise: true },
      { name: 'Priority Support', starter: false, professional: true, enterprise: true },
      { name: '24/7 Phone Support', starter: false, professional: false, enterprise: true },
      { name: 'SSO Integration', starter: false, professional: false, enterprise: true },
    ],
  },
];

const PlanCard: React.FC<{
  plan: BillingPlan;
  isCurrentPlan?: boolean;
  currentPlanName?: string;
  onUpgrade: (plan: BillingPlan) => void;
}> = ({ plan, isCurrentPlan = false, currentPlanName, onUpgrade }) => {
  return (
    <motion.div
      variants={fadeInUp}
      className={`relative bg-card border rounded-2xl p-8 transition-all duration-300 hover:shadow-lg ${
        plan.name.toLowerCase().includes('professional') || plan.name.toLowerCase().includes('pro')
          ? 'border-primary ring-2 ring-primary/20 scale-105'
          : 'border-border hover:border-primary/50'
      } ${isCurrentPlan ? 'opacity-75' : ''}`}
    >
      {(plan.name.toLowerCase().includes('professional') ||
        plan.name.toLowerCase().includes('pro')) && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium flex items-center gap-1">
            <Star className="w-3 h-3" />
            Most Popular
          </span>
        </div>
      )}

      {isCurrentPlan && (
        <div className="absolute -top-3 right-4">
          <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium">
            Current Plan
          </span>
        </div>
      )}

      <div className="text-center mb-8">
        <div className="flex items-center justify-center mb-4">
          {plan.name.toLowerCase().includes('starter') ||
          plan.name.toLowerCase().includes('basic') ? (
            <Zap className="w-8 h-8 text-blue-500" />
          ) : plan.name.toLowerCase().includes('professional') ||
            plan.name.toLowerCase().includes('pro') ? (
            <TrendingUp className="w-8 h-8 text-primary" />
          ) : plan.name.toLowerCase().includes('enterprise') ||
            plan.name.toLowerCase().includes('premium') ? (
            <Crown className="w-8 h-8 text-yellow-500" />
          ) : (
            <Star className="w-8 h-8 text-gray-500" />
          )}
        </div>

        <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
        <p className="text-muted-foreground text-sm mb-4">
          {plan.name.toLowerCase().includes('starter') || plan.name.toLowerCase().includes('basic')
            ? 'Perfect for small teams getting started'
            : plan.name.toLowerCase().includes('professional') ||
                plan.name.toLowerCase().includes('pro')
              ? 'Great for growing teams with advanced needs'
              : plan.name.toLowerCase().includes('enterprise') ||
                  plan.name.toLowerCase().includes('premium')
                ? 'For large organizations requiring maximum flexibility'
                : 'Comprehensive plan for your team'}
        </p>

        <div className="mb-4">
          <span className="text-4xl font-bold">
            {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(
              plan.price / 100
            )}
          </span>
          <span className="text-muted-foreground">/{plan.interval}</span>
        </div>

        <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground mb-6">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            {plan.limits?.members || 'Unlimited'} members
          </div>
          <div className="flex items-center gap-1">
            <FileText className="w-4 h-4" />
            {plan.limits?.teams || 'Unlimited'} teams
          </div>
        </div>
      </div>

      <ul className="space-y-3 mb-8">
        {plan.features.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-3">
            <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{feature}</span>
          </li>
        ))}
      </ul>

      <ModernButton
        className="w-full"
        variant={
          plan.name.toLowerCase().includes('professional') ||
          plan.name.toLowerCase().includes('pro')
            ? 'primary'
            : 'secondary'
        }
        disabled={isCurrentPlan}
        onClick={() => onUpgrade(plan)}
      >
        {(() => {
          if (isCurrentPlan) return 'Current Plan';

          // Determine if this is an upgrade or downgrade based on plan hierarchy
          const planHierarchy = [
            'free',
            'starter',
            'basic',
            'professional',
            'pro',
            'enterprise',
            'premium',
          ];
          const currentPlanIndex = planHierarchy.findIndex(p =>
            currentPlanName?.toLowerCase().includes(p)
          );
          const targetPlanIndex = planHierarchy.findIndex(p => plan.name.toLowerCase().includes(p));

          // If current plan is enterprise/premium, anything else is a downgrade
          if (
            currentPlanName?.toLowerCase().includes('enterprise') ||
            currentPlanName?.toLowerCase().includes('premium')
          ) {
            return targetPlanIndex < currentPlanIndex
              ? `Downgrade to ${plan.name}`
              : `Change to ${plan.name}`;
          }

          // Otherwise check based on price or hierarchy
          return targetPlanIndex > currentPlanIndex
            ? `Upgrade to ${plan.name}`
            : `Downgrade to ${plan.name}`;
        })()}
      </ModernButton>
    </motion.div>
  );
};

const ComparisonTable: React.FC = () => {
  return (
    <motion.div
      variants={fadeInUp}
      className="bg-card border border-border rounded-2xl overflow-hidden"
    >
      <div className="p-6 border-b border-border">
        <h3 className="text-xl font-semibold">Detailed Comparison</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-accent/50">
              <th className="text-left p-4 font-medium">Features</th>
              <th className="text-center p-4 font-medium">Starter</th>
              <th className="text-center p-4 font-medium">Professional</th>
              <th className="text-center p-4 font-medium">Enterprise</th>
            </tr>
          </thead>
          <tbody>
            {comparisonFeatures.map((category, categoryIdx) => (
              <React.Fragment key={categoryIdx}>
                <tr>
                  <td colSpan={4} className="p-4 bg-accent/20 font-semibold text-sm">
                    {category.category}
                  </td>
                </tr>
                {category.features.map((feature, featureIdx) => (
                  <tr key={featureIdx} className="border-b border-border/50">
                    <td className="p-4 text-sm">{feature.name}</td>
                    <td className="p-4 text-center text-sm">
                      {typeof feature.starter === 'boolean' ? (
                        feature.starter ? (
                          <Check className="w-4 h-4 text-green-500 mx-auto" />
                        ) : (
                          <span className="text-muted-foreground">–</span>
                        )
                      ) : (
                        feature.starter
                      )}
                    </td>
                    <td className="p-4 text-center text-sm">
                      {typeof feature.professional === 'boolean' ? (
                        feature.professional ? (
                          <Check className="w-4 h-4 text-green-500 mx-auto" />
                        ) : (
                          <span className="text-muted-foreground">–</span>
                        )
                      ) : (
                        feature.professional
                      )}
                    </td>
                    <td className="p-4 text-center text-sm">
                      {typeof feature.enterprise === 'boolean' ? (
                        feature.enterprise ? (
                          <Check className="w-4 h-4 text-green-500 mx-auto" />
                        ) : (
                          <span className="text-muted-foreground">–</span>
                        )
                      ) : (
                        feature.enterprise
                      )}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export const UpgradePlanPage: React.FC = () => {
  const navigate = useNavigate();
  const [showComparison, setShowComparison] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<BillingPlan | null>(null);

  // Fetch real plans from the API
  const { data: plans, isLoading: plansLoading } = useBillingPlans();
  const { data: subscriptionData, isLoading: subscriptionLoading } = useBillingSubscription();

  // Get current plan key from subscription data
  const currentPlan = subscriptionData?.plan || subscriptionData?.subscription?.planKey || null;

  const handleUpgrade = (plan: BillingPlan) => {
    setSelectedPlan(plan);
    setShowUpgradeModal(true);
  };

  const handleUpgradeSuccess = () => {
    // Refresh the page or redirect to settings
    navigate('/settings?tab=billing');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/settings?tab=billing')}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">
                {currentPlan?.toLowerCase().includes('enterprise')
                  ? 'Change Your Plan'
                  : 'Upgrade Your Plan'}
              </h1>
              <p className="text-muted-foreground">Choose the perfect plan for your team's needs</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-12"
        >
          {/* Plans Grid */}
          <motion.section variants={fadeInUp}>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-4">Choose Your Plan</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Scale with confidence. Upgrade or downgrade at any time with no hidden fees. All
                plans include a 14-day free trial.
              </p>
            </div>

            {plansLoading || subscriptionLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : plans && plans.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                {plans
                  .filter(plan => plan.price > 0) // Filter out free plans
                  .map(plan => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      isCurrentPlan={plan.id === currentPlan}
                      currentPlanName={currentPlan || undefined}
                      onUpgrade={handleUpgrade}
                    />
                  ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No plans available at the moment.</p>
              </div>
            )}

            <div className="text-center">
              <ModernButton
                variant="ghost"
                onClick={() => setShowComparison(!showComparison)}
                className="gap-2"
              >
                {showComparison ? 'Hide' : 'Show'} Detailed Comparison
                <motion.div
                  animate={{ rotate: showComparison ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ArrowLeft className="w-4 h-4 rotate-90" />
                </motion.div>
              </ModernButton>
            </div>
          </motion.section>

          {/* Comparison Table */}
          <AnimatePresence>{showComparison && <ComparisonTable />}</AnimatePresence>

          {/* FAQ Section */}
          <motion.section variants={fadeInUp}>
            <div className="bg-card border border-border rounded-2xl p-8">
              <h3 className="text-2xl font-bold mb-6 text-center">Frequently Asked Questions</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    Can I change plans anytime?
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Yes, you can upgrade or downgrade your plan at any time. Changes take effect
                    immediately, and we'll prorate the billing accordingly.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    Is there a free trial?
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    All paid plans come with a 14-day free trial. No credit card required to start,
                    and you can cancel anytime during the trial period.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-primary" />
                    What payment methods do you accept?
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    We accept all major credit cards (Visa, Mastercard, American Express) and
                    support annual billing with a 20% discount.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    What happens if I exceed my limits?
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    We'll notify you when you're approaching your limits. For overages, we'll
                    suggest upgrading to a higher plan to ensure uninterrupted service.
                  </p>
                </div>
              </div>
            </div>
          </motion.section>

          {/* Contact Section */}
          <motion.section variants={fadeInUp}>
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-8 text-center">
              <h3 className="text-2xl font-bold mb-4">Need a Custom Solution?</h3>
              <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                For organizations with unique requirements or large teams, we offer custom
                enterprise solutions with dedicated support and tailored pricing.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <ModernButton
                  variant="primary"
                  onClick={() => toast.info('Contact sales')}
                  className="gap-2"
                >
                  <Users className="w-4 h-4" />
                  Contact Sales
                </ModernButton>
                <ModernButton
                  variant="secondary"
                  onClick={() => toast.info('Schedule demo')}
                  className="gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  Schedule Demo
                </ModernButton>
              </div>
            </div>
          </motion.section>
        </motion.div>
      </div>

      {/* Upgrade Payment Modal */}
      {selectedPlan && (
        <UpgradePaymentModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          onSuccess={handleUpgradeSuccess}
          selectedPlan={selectedPlan}
        />
      )}
    </div>
  );
};
