import { useState, useEffect, useRef } from 'react';
import { featuresApi, type FeatureCheckResult } from '@/lib/api-client/features';
import { getInitialFeatures, cacheFeatures } from '@/config/features';

interface UseFeatureFlagResult {
  isEnabled: boolean;
  loading: boolean;
  error: Error | null;
  source?: string;
  value?: string;
  reason?: string;
  refetch: () => Promise<void>;
}

interface UseFeatureFlagsResult {
  features: Record<string, boolean>;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to check if a single feature flag is enabled
 * Implements caching and error handling
 */
export const useFeatureFlag = (featureKey: string): UseFeatureFlagResult => {
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<FeatureCheckResult | null>(null);
  const cacheRef = useRef<Map<string, { result: FeatureCheckResult; timestamp: number }>>(
    new Map()
  );

  // Cache duration: 5 minutes
  const CACHE_DURATION = 5 * 60 * 1000;

  const checkFeature = async () => {
    if (!featureKey) {
      setIsEnabled(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Check cache first
      const cached = cacheRef.current.get(featureKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        const { result } = cached;
        setResult(result);
        setIsEnabled(result.enabled);
        setLoading(false);
        return;
      }

      // Fetch from API
      const featureResult = await featuresApi.checkFeature(featureKey);

      // Update cache
      cacheRef.current.set(featureKey, {
        result: featureResult,
        timestamp: Date.now(),
      });

      setResult(featureResult);
      setIsEnabled(featureResult.enabled);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to check feature flag');
      setError(error);
      setIsEnabled(false); // Fail closed - feature disabled on error

      console.warn(`Feature flag check failed for '${featureKey}':`, error.message);
    } finally {
      setLoading(false);
    }
  };

  const refetch = async () => {
    // Clear cache for this feature
    cacheRef.current.delete(featureKey);
    await checkFeature();
  };

  useEffect(() => {
    checkFeature();
  }, [featureKey]);

  return {
    isEnabled,
    loading,
    error,
    source: result?.source,
    value: result?.value,
    reason: result?.reason,
    refetch,
  };
};

/**
 * Hook to check multiple feature flags at once
 * More efficient than calling useFeatureFlag multiple times
 */
export const useFeatureFlags = (featureKeys: string[]): UseFeatureFlagsResult => {
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const checkFeatures = async () => {
    if (!featureKeys.length) {
      setFeatures({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Check each feature individually
      // TODO: Consider adding a batch API endpoint for better performance
      const results = await Promise.allSettled(
        featureKeys.map(async key => {
          const result = await featuresApi.checkFeature(key);
          return { key, enabled: result.enabled };
        })
      );

      const featureMap: Record<string, boolean> = {};

      results.forEach((result, index) => {
        const key = featureKeys[index];
        if (result.status === 'fulfilled') {
          featureMap[key] = result.value.enabled;
        } else {
          featureMap[key] = false; // Fail closed
          console.warn(`Feature flag check failed for '${key}':`, result.reason);
        }
      });

      setFeatures(featureMap);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to check feature flags');
      setError(error);

      // Set all features to false on error
      const featureMap: Record<string, boolean> = {};
      featureKeys.forEach(key => {
        featureMap[key] = false;
      });
      setFeatures(featureMap);

      console.warn('Feature flags check failed:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const refetch = async () => {
    await checkFeatures();
  };

  useEffect(() => {
    checkFeatures();
  }, [featureKeys.join(',')]); // Re-run when feature keys change

  return {
    features,
    loading,
    error,
    refetch,
  };
};

/**
 * Hook to get all enabled features for the current user's organization
 * Useful for bulk feature checking with localStorage caching
 */
export const useEnabledFeatures = (isAuthenticated?: boolean, authLoading?: boolean) => {
  // Start with initial features (safe defaults + cached)
  const [features, setFeatures] = useState<string[]>(getInitialFeatures);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEnabledFeatures = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await featuresApi.getEnabledFeatures();
      setFeatures(result);
      // Cache the fresh results for next session
      cacheFeatures(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch enabled features');
      setError(error);
      // Keep the initial features (don't clear them on error)
      console.warn('Failed to fetch enabled features:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const refetch = async () => {
    await fetchEnabledFeatures();
  };

  useEffect(() => {
    // Only fetch if authenticated and auth is not loading
    if (isAuthenticated && !authLoading) {
      fetchEnabledFeatures();
    } else if (isAuthenticated === false && !authLoading) {
      // User is not authenticated, clear features and stop loading
      setFeatures([]);
      setLoading(false);
      setError(null);
    }
    // If authLoading is true, keep the loading state
  }, [isAuthenticated, authLoading]);

  return {
    features,
    loading: authLoading || loading,
    error,
    refetch,
  };
};
