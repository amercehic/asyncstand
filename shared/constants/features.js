'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.BASE_NAVIGATION_FEATURES =
  exports.QUOTA_TYPES =
  exports.FEATURE_CATEGORIES =
  exports.FEATURES =
    void 0;
exports.isNavigationFeature = isNavigationFeature;
exports.getFeaturesByCategory = getFeaturesByCategory;
exports.FEATURES = {
  DASHBOARD: 'dashboard',
  TEAMS: 'teams',
  STANDUPS: 'standups',
  INTEGRATIONS: 'integrations',
  SETTINGS: 'settings',
  BASIC_STANDUPS: 'basic_standups',
  ADVANCED_STANDUPS: 'advanced_standups',
  BASIC_ANALYTICS: 'basic_analytics',
  ADVANCED_ANALYTICS: 'advanced_analytics',
  SLACK_INTEGRATION: 'slack_integration',
  TEAMS_INTEGRATION: 'teams_integration',
  DISCORD_INTEGRATION: 'discord_integration',
  WEBHOOK_INTEGRATIONS: 'webhook_integrations',
  API_ACCESS: 'api_access',
  CUSTOM_BRANDING: 'custom_branding',
  WHITE_LABELING: 'white_labeling',
  PRIORITY_SUPPORT: 'priority_support',
  BILLING_PORTAL: 'billing_portal',
  INVOICE_MANAGEMENT: 'invoice_management',
  AI_INSIGHTS: 'ai_insights',
  NEW_UI: 'new_ui',
  MOBILE_APP: 'mobile_app',
};
exports.FEATURE_CATEGORIES = {
  CORE: 'core',
  ANALYTICS: 'analytics',
  INTEGRATION: 'integration',
  CUSTOMIZATION: 'customization',
  SUPPORT: 'support',
  BILLING: 'billing',
  EXPERIMENTAL: 'experimental',
};
exports.QUOTA_TYPES = {
  MEMBERS: 'members',
  TEAMS: 'teams',
  STANDUPS: 'standups',
  STORAGE: 'storage',
  INTEGRATIONS: 'integrations',
};
exports.BASE_NAVIGATION_FEATURES = [
  exports.FEATURES.DASHBOARD,
  exports.FEATURES.TEAMS,
  exports.FEATURES.STANDUPS,
  exports.FEATURES.INTEGRATIONS,
  exports.FEATURES.SETTINGS,
];
function isNavigationFeature(feature) {
  return exports.BASE_NAVIGATION_FEATURES.includes(feature);
}
function getFeaturesByCategory(category) {
  const categoryMap = {
    [exports.FEATURE_CATEGORIES.CORE]: [
      exports.FEATURES.DASHBOARD,
      exports.FEATURES.TEAMS,
      exports.FEATURES.STANDUPS,
      exports.FEATURES.SETTINGS,
      exports.FEATURES.BASIC_STANDUPS,
      exports.FEATURES.ADVANCED_STANDUPS,
    ],
    [exports.FEATURE_CATEGORIES.ANALYTICS]: [
      exports.FEATURES.BASIC_ANALYTICS,
      exports.FEATURES.ADVANCED_ANALYTICS,
    ],
    [exports.FEATURE_CATEGORIES.INTEGRATION]: [
      exports.FEATURES.INTEGRATIONS,
      exports.FEATURES.SLACK_INTEGRATION,
      exports.FEATURES.TEAMS_INTEGRATION,
      exports.FEATURES.DISCORD_INTEGRATION,
      exports.FEATURES.WEBHOOK_INTEGRATIONS,
      exports.FEATURES.API_ACCESS,
    ],
    [exports.FEATURE_CATEGORIES.CUSTOMIZATION]: [
      exports.FEATURES.CUSTOM_BRANDING,
      exports.FEATURES.WHITE_LABELING,
    ],
    [exports.FEATURE_CATEGORIES.SUPPORT]: [exports.FEATURES.PRIORITY_SUPPORT],
    [exports.FEATURE_CATEGORIES.BILLING]: [
      exports.FEATURES.BILLING_PORTAL,
      exports.FEATURES.INVOICE_MANAGEMENT,
    ],
    [exports.FEATURE_CATEGORIES.EXPERIMENTAL]: [
      exports.FEATURES.AI_INSIGHTS,
      exports.FEATURES.NEW_UI,
      exports.FEATURES.MOBILE_APP,
    ],
  };
  return categoryMap[category] || [];
}
//# sourceMappingURL=features.js.map
