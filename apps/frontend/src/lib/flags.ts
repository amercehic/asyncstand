export type Flags = Record<string, boolean>;

/**
 * Read bootstrapped flags from the script tag injected by the server
 */
export function readBootstrappedFlags(): Flags {
  try {
    const flagsScript = document.getElementById('__FLAGS__');
    if (!flagsScript) {
      console.warn('No bootstrapped flags found in DOM');
      return {};
    }

    const flagsText = flagsScript.textContent;
    if (!flagsText) {
      console.warn('Empty flags script content');
      return {};
    }

    const flags = JSON.parse(flagsText);
    console.log('Loaded bootstrapped flags:', Object.keys(flags));
    return flags;
  } catch (error) {
    console.error('Failed to read bootstrapped flags:', error);
    return {};
  }
}

/**
 * Get cached flags from localStorage
 */
export function getCachedFlags(): Flags {
  try {
    const cached = localStorage.getItem('feature-flags');
    if (!cached) return {};

    const { flags, timestamp } = JSON.parse(cached);

    // Check if cache is stale (older than 5 minutes)
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    if (Date.now() - timestamp > CACHE_TTL) {
      localStorage.removeItem('feature-flags');
      return {};
    }

    return flags || {};
  } catch (error) {
    console.warn('Failed to read cached flags:', error);
    localStorage.removeItem('feature-flags');
    return {};
  }
}

/**
 * Cache flags in localStorage
 */
export function setCachedFlags(flags: Flags): void {
  try {
    const cacheData = {
      flags,
      timestamp: Date.now(),
    };
    localStorage.setItem('feature-flags', JSON.stringify(cacheData));
  } catch (error) {
    console.warn('Failed to cache flags:', error);
  }
}

/**
 * Get initial flags (bootstrapped + cached, preferring bootstrapped)
 */
export function getInitialFlags(): Flags {
  const bootstrapped = readBootstrappedFlags();
  const cached = getCachedFlags();

  // Merge cached with bootstrapped, preferring bootstrapped
  return { ...cached, ...bootstrapped };
}

/**
 * Sticky experiment variants - persist A/B test assignments
 */
export class StickyVariants {
  private static readonly STORAGE_KEY = 'experiment-variants';
  private static cache: Record<string, string> | null = null;

  /**
   * Get cached variants from localStorage
   */
  private static getVariants(): Record<string, string> {
    if (this.cache) return this.cache;

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      this.cache = stored ? JSON.parse(stored) : {};
      return this.cache || {};
    } catch (error) {
      console.warn('Failed to read experiment variants:', error);
      this.cache = {};
      return this.cache;
    }
  }

  /**
   * Set variant for an experiment
   */
  private static setVariant(experimentKey: string, variant: string): void {
    try {
      const variants = this.getVariants();
      variants[experimentKey] = variant;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(variants));
      this.cache = variants;
    } catch (error) {
      console.warn('Failed to save experiment variant:', error);
    }
  }

  /**
   * Get sticky variant for an experiment flag
   */
  static getStickyVariant(experimentKey: string, isEnabled: boolean): boolean {
    const variants = this.getVariants();

    // If we have a cached variant, use it
    if (variants[experimentKey] !== undefined) {
      return variants[experimentKey] === 'enabled';
    }

    // First time seeing this experiment - assign variant based on current state
    const variant = isEnabled ? 'enabled' : 'disabled';
    this.setVariant(experimentKey, variant);

    console.log(`Assigned sticky variant for ${experimentKey}: ${variant}`);
    return isEnabled;
  }

  /**
   * Clear all experiment variants (for testing)
   */
  static clearVariants(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.cache = null;
  }
}

/**
 * Feature flag configuration
 */
export const FLAG_CONFIG = {
  // Experimental flags that should be sticky (don't change mid-session)
  STICKY_EXPERIMENTS: ['newUI', 'betaBanner', 'experimentalDashboard', 'aiAssistant'],

  // Operational flags that can change live
  LIVE_FLAGS: ['maintenance', 'emergencyBanner', 'apiHealthCheck', 'debugMode'],

  // Core flags that should always be available
  CORE_FLAGS: ['dashboard', 'standups', 'teams', 'integrations', 'settings'],
} as const;

/**
 * Check if a flag is a sticky experiment
 */
export function isStickyExperiment(flagKey: string): boolean {
  return (FLAG_CONFIG.STICKY_EXPERIMENTS as readonly string[]).includes(flagKey);
}

/**
 * Check if a flag is a live operational flag
 */
export function isLiveFlag(flagKey: string): boolean {
  return (FLAG_CONFIG.LIVE_FLAGS as readonly string[]).includes(flagKey);
}

/**
 * Check if a flag is a core feature
 */
export function isCoreFlag(flagKey: string): boolean {
  return (FLAG_CONFIG.CORE_FLAGS as readonly string[]).includes(flagKey);
}
