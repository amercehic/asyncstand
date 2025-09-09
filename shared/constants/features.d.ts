export declare const FEATURES: {
  readonly DASHBOARD: 'dashboard';
  readonly TEAMS: 'teams';
  readonly STANDUPS: 'standups';
  readonly INTEGRATIONS: 'integrations';
  readonly SETTINGS: 'settings';
  readonly BASIC_STANDUPS: 'basic_standups';
  readonly ADVANCED_STANDUPS: 'advanced_standups';
  readonly BASIC_ANALYTICS: 'basic_analytics';
  readonly ADVANCED_ANALYTICS: 'advanced_analytics';
  readonly SLACK_INTEGRATION: 'slack_integration';
  readonly TEAMS_INTEGRATION: 'teams_integration';
  readonly DISCORD_INTEGRATION: 'discord_integration';
  readonly WEBHOOK_INTEGRATIONS: 'webhook_integrations';
  readonly API_ACCESS: 'api_access';
  readonly CUSTOM_BRANDING: 'custom_branding';
  readonly WHITE_LABELING: 'white_labeling';
  readonly PRIORITY_SUPPORT: 'priority_support';
  readonly BILLING_PORTAL: 'billing_portal';
  readonly INVOICE_MANAGEMENT: 'invoice_management';
  readonly AI_INSIGHTS: 'ai_insights';
  readonly NEW_UI: 'new_ui';
  readonly MOBILE_APP: 'mobile_app';
};
export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];
export declare const FEATURE_CATEGORIES: {
  readonly CORE: 'core';
  readonly ANALYTICS: 'analytics';
  readonly INTEGRATION: 'integration';
  readonly CUSTOMIZATION: 'customization';
  readonly SUPPORT: 'support';
  readonly BILLING: 'billing';
  readonly EXPERIMENTAL: 'experimental';
};
export type FeatureCategory = (typeof FEATURE_CATEGORIES)[keyof typeof FEATURE_CATEGORIES];
export declare const QUOTA_TYPES: {
  readonly MEMBERS: 'members';
  readonly TEAMS: 'teams';
  readonly STANDUPS: 'standups';
  readonly STORAGE: 'storage';
  readonly INTEGRATIONS: 'integrations';
};
export type QuotaType = (typeof QUOTA_TYPES)[keyof typeof QUOTA_TYPES];
export declare const BASE_NAVIGATION_FEATURES: readonly [
  'dashboard',
  'teams',
  'standups',
  'integrations',
  'settings',
];
export declare function isNavigationFeature(feature: FeatureKey): boolean;
export declare function getFeaturesByCategory(category: FeatureCategory): FeatureKey[];
//# sourceMappingURL=features.d.ts.map
