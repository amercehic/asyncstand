/**
 * Central registry of all feature flags in the application
 * This ensures consistency across backend and frontend
 */

export const FEATURES = {
  // Core Features
  BASIC_STANDUPS: 'basic_standups',
  ADVANCED_STANDUPS: 'advanced_standups',

  // Analytics
  BASIC_ANALYTICS: 'basic_analytics',
  ADVANCED_ANALYTICS: 'advanced_analytics',

  // Integrations
  SLACK_INTEGRATION: 'slack_integration',
  TEAMS_INTEGRATION: 'teams_integration',
  DISCORD_INTEGRATION: 'discord_integration',
  WEBHOOK_INTEGRATIONS: 'webhook_integrations',
  API_ACCESS: 'api_access',

  // Customization
  CUSTOM_BRANDING: 'custom_branding',
  WHITE_LABELING: 'white_labeling',

  // Support
  PRIORITY_SUPPORT: 'priority_support',

  // Billing
  BILLING_PORTAL: 'billing_portal',
  INVOICE_MANAGEMENT: 'invoice_management',

  // Experimental
  AI_INSIGHTS: 'ai_insights',
  NEW_UI: 'new_ui',
  MOBILE_APP: 'mobile_app',
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];

/**
 * Feature categories for grouping in UI
 */
export const FEATURE_CATEGORIES = {
  CORE: 'core',
  ANALYTICS: 'analytics',
  INTEGRATION: 'integration',
  CUSTOMIZATION: 'customization',
  SUPPORT: 'support',
  BILLING: 'billing',
  EXPERIMENTAL: 'experimental',
} as const;

export type FeatureCategory = (typeof FEATURE_CATEGORIES)[keyof typeof FEATURE_CATEGORIES];

/**
 * Resource types for quota checking
 */
export const QUOTA_TYPES = {
  MEMBERS: 'members',
  TEAMS: 'teams',
  STANDUPS: 'standups',
  STORAGE: 'storage',
  INTEGRATIONS: 'integrations',
} as const;

export type QuotaType = (typeof QUOTA_TYPES)[keyof typeof QUOTA_TYPES];

/**
 * Feature metadata for UI display
 */
export const FEATURE_METADATA: Record<
  FeatureKey,
  {
    name: string;
    description: string;
    category: FeatureCategory;
    icon?: string;
    comingSoon?: boolean;
  }
> = {
  [FEATURES.BASIC_STANDUPS]: {
    name: 'Basic Standups',
    description: 'Core standup functionality with standard questions',
    category: FEATURE_CATEGORIES.CORE,
  },
  [FEATURES.ADVANCED_STANDUPS]: {
    name: 'Advanced Standups',
    description: 'Custom questions, templates, and advanced scheduling',
    category: FEATURE_CATEGORIES.CORE,
  },
  [FEATURES.BASIC_ANALYTICS]: {
    name: 'Basic Analytics',
    description: 'Basic reporting and team insights',
    category: FEATURE_CATEGORIES.ANALYTICS,
  },
  [FEATURES.ADVANCED_ANALYTICS]: {
    name: 'Advanced Analytics',
    description: 'Detailed insights, trends, and custom reports',
    category: FEATURE_CATEGORIES.ANALYTICS,
  },
  [FEATURES.SLACK_INTEGRATION]: {
    name: 'Slack Integration',
    description: 'Connect with Slack for notifications and bot commands',
    category: FEATURE_CATEGORIES.INTEGRATION,
  },
  [FEATURES.TEAMS_INTEGRATION]: {
    name: 'Microsoft Teams',
    description: 'Integration with Microsoft Teams',
    category: FEATURE_CATEGORIES.INTEGRATION,
    comingSoon: true,
  },
  [FEATURES.DISCORD_INTEGRATION]: {
    name: 'Discord Integration',
    description: 'Connect with Discord for notifications',
    category: FEATURE_CATEGORIES.INTEGRATION,
    comingSoon: true,
  },
  [FEATURES.WEBHOOK_INTEGRATIONS]: {
    name: 'Webhooks',
    description: 'Custom webhook endpoints for external integrations',
    category: FEATURE_CATEGORIES.INTEGRATION,
  },
  [FEATURES.API_ACCESS]: {
    name: 'API Access',
    description: 'REST API access for custom integrations',
    category: FEATURE_CATEGORIES.INTEGRATION,
  },
  [FEATURES.CUSTOM_BRANDING]: {
    name: 'Custom Branding',
    description: 'Customize logo, colors, and theming',
    category: FEATURE_CATEGORIES.CUSTOMIZATION,
  },
  [FEATURES.WHITE_LABELING]: {
    name: 'White Labeling',
    description: 'Remove AsyncStand branding completely',
    category: FEATURE_CATEGORIES.CUSTOMIZATION,
  },
  [FEATURES.PRIORITY_SUPPORT]: {
    name: 'Priority Support',
    description: 'Faster response times and dedicated support',
    category: FEATURE_CATEGORIES.SUPPORT,
  },
  [FEATURES.BILLING_PORTAL]: {
    name: 'Billing Portal',
    description: 'Access to billing and subscription management',
    category: FEATURE_CATEGORIES.BILLING,
  },
  [FEATURES.INVOICE_MANAGEMENT]: {
    name: 'Invoice Management',
    description: 'Download and manage invoices',
    category: FEATURE_CATEGORIES.BILLING,
  },
  [FEATURES.AI_INSIGHTS]: {
    name: 'AI Insights',
    description: 'AI-powered standup analysis and recommendations',
    category: FEATURE_CATEGORIES.EXPERIMENTAL,
    comingSoon: true,
  },
  [FEATURES.NEW_UI]: {
    name: 'New UI Design',
    description: 'Beta version of the new user interface',
    category: FEATURE_CATEGORIES.EXPERIMENTAL,
  },
  [FEATURES.MOBILE_APP]: {
    name: 'Mobile App',
    description: 'iOS and Android mobile applications',
    category: FEATURE_CATEGORIES.EXPERIMENTAL,
    comingSoon: true,
  },
};

/**
 * Plan feature mappings
 */
export const PLAN_FEATURES = {
  FREE: [FEATURES.BASIC_STANDUPS, FEATURES.SLACK_INTEGRATION],
  STARTER: [
    FEATURES.BASIC_STANDUPS,
    FEATURES.ADVANCED_STANDUPS,
    FEATURES.SLACK_INTEGRATION,
    FEATURES.BASIC_ANALYTICS,
    FEATURES.WEBHOOK_INTEGRATIONS,
  ],
  PROFESSIONAL: [
    FEATURES.BASIC_STANDUPS,
    FEATURES.ADVANCED_STANDUPS,
    FEATURES.SLACK_INTEGRATION,
    FEATURES.BASIC_ANALYTICS,
    FEATURES.ADVANCED_ANALYTICS,
    FEATURES.WEBHOOK_INTEGRATIONS,
    FEATURES.API_ACCESS,
    FEATURES.CUSTOM_BRANDING,
    FEATURES.PRIORITY_SUPPORT,
    FEATURES.INVOICE_MANAGEMENT,
  ],
  ENTERPRISE: [
    // All features
    ...Object.values(FEATURES),
  ],
} as const;
