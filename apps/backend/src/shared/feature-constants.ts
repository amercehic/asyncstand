/**
 * Shared feature constants for consistent usage across backend and frontend
 * This file should be the single source of truth for all feature keys
 */

export const FEATURES = {
  // Navigation Features (Base Platform Access)
  DASHBOARD: 'dashboard',
  TEAMS: 'teams',
  STANDUPS: 'standups',
  INTEGRATIONS: 'integrations',
  SETTINGS: 'settings',

  // Core Features
  BASIC_STANDUPS: 'basic_standups',

  // Platform Integrations
  SLACK_INTEGRATION: 'slack_integration',
  DISCORD_INTEGRATION: 'discord_integration',

  // Billing
  BILLING_PORTAL: 'billing_portal',
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];

/**
 * Feature categories for grouping in UI
 */
export const FEATURE_CATEGORIES = {
  CORE: 'core',
  INTEGRATION: 'integration',
  BILLING: 'billing',
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
 * Base navigation features available to all plans
 */
export const BASE_NAVIGATION_FEATURES = [
  FEATURES.DASHBOARD,
  FEATURES.TEAMS,
  FEATURES.STANDUPS,
  FEATURES.INTEGRATIONS,
  FEATURES.SETTINGS,
] as const;

/**
 * Helper function to check if a feature is a navigation feature
 */
export function isNavigationFeature(feature: FeatureKey): boolean {
  return (BASE_NAVIGATION_FEATURES as readonly string[]).includes(feature);
}

/**
 * Helper function to get all features by category
 */
export function getFeaturesByCategory(category: FeatureCategory): FeatureKey[] {
  // This would typically be populated from FEATURE_METADATA, but we keep it simple here
  const categoryMap: Record<FeatureCategory, FeatureKey[]> = {
    [FEATURE_CATEGORIES.CORE]: [
      FEATURES.DASHBOARD,
      FEATURES.TEAMS,
      FEATURES.STANDUPS,
      FEATURES.SETTINGS,
      FEATURES.BASIC_STANDUPS,
    ],
    [FEATURE_CATEGORIES.INTEGRATION]: [
      FEATURES.INTEGRATIONS,
      FEATURES.SLACK_INTEGRATION,
      FEATURES.DISCORD_INTEGRATION,
    ],
    [FEATURE_CATEGORIES.BILLING]: [FEATURES.BILLING_PORTAL],
  };

  return categoryMap[category] || [];
}
