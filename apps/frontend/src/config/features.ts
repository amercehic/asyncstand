/**
 * Smart feature flag system that combines:
 * 1. Safe defaults from config (show immediately, hide if API says no)
 * 2. Cached values from localStorage (from previous API calls)
 * 3. Fresh API data (when available)
 */

export interface FeatureConfig {
  // Features safe to show by default (will hide if API says no)
  safeDefaults: string[];
  // Features that MUST wait for API confirmation (never show without confirmation)
  requireApiConfirmation: string[];
}

// Safe defaults per environment - these can be shown immediately but will be hidden if API says no
const FEATURE_CONFIG: Record<string, FeatureConfig> = {
  development: {
    safeDefaults: ['dashboard', 'standups'], // Always safe
    requireApiConfirmation: ['teams', 'integrations', 'settings', 'reports', 'admin']
  },
  staging: {
    safeDefaults: ['dashboard', 'standups', 'teams', 'integrations', 'settings'], // Usually enabled in staging
    requireApiConfirmation: ['reports', 'admin']
  },
  production: {
    safeDefaults: ['dashboard', 'standups', 'teams', 'integrations', 'settings'], // Usually enabled in prod
    requireApiConfirmation: ['reports', 'admin']
  }
};

// Get current environment
const getEnvironment = (): string => {
  // Check for explicit env var first
  if (import.meta.env.VITE_APP_ENV) {
    return import.meta.env.VITE_APP_ENV;
  }
  
  // Fallback to NODE_ENV or default
  if (import.meta.env.DEV) return 'development';
  if (import.meta.env.PROD) return 'production';
  
  // Check hostname for staging
  if (typeof window !== 'undefined' && window.location.hostname.includes('staging')) {
    return 'staging';
  }
  
  return 'production';
};

export const currentEnvironment = getEnvironment();
export const featureConfig = FEATURE_CONFIG[currentEnvironment] || FEATURE_CONFIG.production;

/**
 * Get cached features from previous API calls
 */
const getCachedFeatures = (): string[] => {
  try {
    const cached = localStorage.getItem('enabledFeatures');
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
};

/**
 * Get features that should be shown immediately (before API loads)
 * Combines safe defaults with cached values from previous sessions
 */
export const getInitialFeatures = (): string[] => {
  const safeDefaults = featureConfig.safeDefaults;
  const cached = getCachedFeatures();
  
  // Combine safe defaults with cached features (deduplicated)
  return [...new Set([...safeDefaults, ...cached])];
};

/**
 * Check if a feature should be shown before API confirmation
 */
export const shouldShowBeforeAPI = (featureKey: string): boolean => {
  return getInitialFeatures().includes(featureKey);
};

/**
 * Check if a feature requires API confirmation before showing
 */
export const requiresAPIConfirmation = (featureKey: string): boolean => {
  return featureConfig.requireApiConfirmation.includes(featureKey);
};

/**
 * Cache features in localStorage for next session
 */
export const cacheFeatures = (features: string[]): void => {
  try {
    localStorage.setItem('enabledFeatures', JSON.stringify(features));
  } catch (error) {
    console.warn('Failed to cache features:', error);
  }
};