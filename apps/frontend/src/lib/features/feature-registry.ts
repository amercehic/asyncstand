/**
 * Central registry of all feature flags in the application
 * This should be kept in sync with the backend feature-registry.ts
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
 * Helper to check if a feature is experimental
 */
export const isExperimentalFeature = (feature: FeatureKey): boolean => {
  return ([FEATURES.AI_INSIGHTS, FEATURES.NEW_UI, FEATURES.MOBILE_APP] as FeatureKey[]).includes(
    feature
  );
};

/**
 * Helper to check if a feature is integration-related
 */
export const isIntegrationFeature = (feature: FeatureKey): boolean => {
  return (
    [
      FEATURES.SLACK_INTEGRATION,
      FEATURES.TEAMS_INTEGRATION,
      FEATURES.DISCORD_INTEGRATION,
      FEATURES.WEBHOOK_INTEGRATIONS,
      FEATURES.API_ACCESS,
    ] as FeatureKey[]
  ).includes(feature);
};

/**
 * Helper to check if a feature is analytics-related
 */
export const isAnalyticsFeature = (feature: FeatureKey): boolean => {
  return ([FEATURES.BASIC_ANALYTICS, FEATURES.ADVANCED_ANALYTICS] as FeatureKey[]).includes(
    feature
  );
};

/**
 * Feature icons for UI display (using Lucide icons)
 */
export const FEATURE_ICONS: Partial<Record<FeatureKey, string>> = {
  [FEATURES.BASIC_STANDUPS]: 'Calendar',
  [FEATURES.ADVANCED_STANDUPS]: 'CalendarClock',
  [FEATURES.BASIC_ANALYTICS]: 'BarChart3',
  [FEATURES.ADVANCED_ANALYTICS]: 'TrendingUp',
  [FEATURES.SLACK_INTEGRATION]: 'MessageSquare',
  [FEATURES.TEAMS_INTEGRATION]: 'Users',
  [FEATURES.DISCORD_INTEGRATION]: 'MessageCircle',
  [FEATURES.WEBHOOK_INTEGRATIONS]: 'Webhook',
  [FEATURES.API_ACCESS]: 'Code2',
  [FEATURES.CUSTOM_BRANDING]: 'Palette',
  [FEATURES.WHITE_LABELING]: 'Eye',
  [FEATURES.PRIORITY_SUPPORT]: 'Headphones',
  [FEATURES.BILLING_PORTAL]: 'CreditCard',
  [FEATURES.INVOICE_MANAGEMENT]: 'FileText',
  [FEATURES.AI_INSIGHTS]: 'Sparkles',
  [FEATURES.NEW_UI]: 'Layout',
  [FEATURES.MOBILE_APP]: 'Smartphone',
};
