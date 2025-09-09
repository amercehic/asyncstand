/**
 * Central registry of all feature flags in the application
 * This ensures consistency across backend and frontend
 * Core constants are imported from shared location
 */

// Import shared constants
import {
  FEATURES,
  FEATURE_CATEGORIES,
  QUOTA_TYPES,
  BASE_NAVIGATION_FEATURES,
  isNavigationFeature,
  getFeaturesByCategory,
  type FeatureKey,
  type FeatureCategory,
  type QuotaType,
} from '../shared/feature-constants';

// Re-export for backward compatibility
export {
  FEATURES,
  FEATURE_CATEGORIES,
  QUOTA_TYPES,
  BASE_NAVIGATION_FEATURES,
  isNavigationFeature,
  getFeaturesByCategory,
};

export type { FeatureKey, FeatureCategory, QuotaType };

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
  // Navigation Features
  [FEATURES.DASHBOARD]: {
    name: 'Dashboard',
    description: 'Access to the main dashboard and analytics overview',
    category: FEATURE_CATEGORIES.CORE,
    icon: 'dashboard',
  },
  [FEATURES.TEAMS]: {
    name: 'Teams',
    description: 'Team management and organization features',
    category: FEATURE_CATEGORIES.CORE,
    icon: 'users',
  },
  [FEATURES.STANDUPS]: {
    name: 'Standups',
    description: 'Standup configuration and management',
    category: FEATURE_CATEGORIES.CORE,
    icon: 'calendar',
  },
  [FEATURES.INTEGRATIONS]: {
    name: 'Integrations',
    description: 'External platform integrations (Slack, Teams, etc.)',
    category: FEATURE_CATEGORIES.INTEGRATION,
    icon: 'plug',
  },
  [FEATURES.SETTINGS]: {
    name: 'Settings',
    description: 'Organization and user settings management',
    category: FEATURE_CATEGORIES.CORE,
    icon: 'settings',
  },

  // Core Features
  [FEATURES.BASIC_STANDUPS]: {
    name: 'Basic Standups',
    description: 'Core standup functionality with standard questions',
    category: FEATURE_CATEGORIES.CORE,
  },

  // Platform Integrations
  [FEATURES.SLACK_INTEGRATION]: {
    name: 'Slack Integration',
    description: 'Connect with Slack for notifications and bot commands',
    category: FEATURE_CATEGORIES.INTEGRATION,
  },
  [FEATURES.DISCORD_INTEGRATION]: {
    name: 'Discord Integration',
    description: 'Connect with Discord for notifications',
    category: FEATURE_CATEGORIES.INTEGRATION,
    comingSoon: true,
  },

  // Billing
  [FEATURES.BILLING_PORTAL]: {
    name: 'Billing Portal',
    description: 'Access to billing and subscription management',
    category: FEATURE_CATEGORIES.BILLING,
  },
};

/**
 * Plan feature mappings
 */

export const PLAN_FEATURES = {
  FREE: [
    ...BASE_NAVIGATION_FEATURES,
    FEATURES.BASIC_STANDUPS,
    FEATURES.SLACK_INTEGRATION,
    FEATURES.BILLING_PORTAL,
  ],
  STARTER: [
    ...BASE_NAVIGATION_FEATURES,
    FEATURES.BASIC_STANDUPS,
    FEATURES.SLACK_INTEGRATION,
    FEATURES.BILLING_PORTAL,
  ],
  PROFESSIONAL: [
    ...BASE_NAVIGATION_FEATURES,
    FEATURES.BASIC_STANDUPS,
    FEATURES.SLACK_INTEGRATION,
    FEATURES.DISCORD_INTEGRATION,
    FEATURES.BILLING_PORTAL,
  ],
  ENTERPRISE: [
    // All features
    ...Object.values(FEATURES),
  ],
} as const;
