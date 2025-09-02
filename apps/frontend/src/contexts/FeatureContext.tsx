import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { featuresApi, type FeatureCheckResult, type QuotaCheckResult } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';

interface FeatureContextType {
  // Feature checking
  enabledFeatures: Set<string>;
  isLoading: boolean;
  hasFeature: (featureKey: string) => boolean;
  checkFeature: (featureKey: string) => Promise<FeatureCheckResult>;
  refreshFeatures: () => Promise<void>;

  // Quota checking
  checkQuota: (
    quotaType: 'members' | 'teams' | 'standups' | 'storage' | 'integrations'
  ) => Promise<QuotaCheckResult>;

  // Cached quota results
  quotaCache: Map<string, QuotaCheckResult>;
}

const FeatureContext = createContext<FeatureContextType | undefined>(undefined);

export const useFeatures = () => {
  const context = useContext(FeatureContext);
  if (!context) {
    throw new Error('useFeatures must be used within a FeatureProvider');
  }
  return context;
};

interface FeatureProviderProps {
  children: React.ReactNode;
}

export const FeatureProvider: React.FC<FeatureProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [enabledFeatures, setEnabledFeatures] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [quotaCache] = useState<Map<string, QuotaCheckResult>>(new Map());

  // Load enabled features when user logs in or organization changes
  const loadFeatures = useCallback(async () => {
    if (!isAuthenticated || !user?.orgId) {
      setEnabledFeatures(new Set());
      return;
    }

    try {
      setIsLoading(true);
      const features = await featuresApi.getEnabledFeatures();
      setEnabledFeatures(new Set(features));
    } catch (error) {
      console.error('Failed to load features:', error);
      setEnabledFeatures(new Set());
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.orgId]);

  useEffect(() => {
    loadFeatures();
  }, [loadFeatures]);

  const hasFeature = useCallback(
    (featureKey: string): boolean => {
      return enabledFeatures.has(featureKey);
    },
    [enabledFeatures]
  );

  const checkFeature = useCallback(
    async (featureKey: string): Promise<FeatureCheckResult> => {
      if (!isAuthenticated || !user?.orgId) {
        return {
          enabled: false,
          source: 'global',
          reason: 'User not authenticated',
        };
      }

      try {
        const result = await featuresApi.checkFeature(featureKey);

        // Update the local cache if needed
        if (result.enabled && !enabledFeatures.has(featureKey)) {
          setEnabledFeatures(prev => new Set([...prev, featureKey]));
        } else if (!result.enabled && enabledFeatures.has(featureKey)) {
          setEnabledFeatures(prev => {
            const newSet = new Set(prev);
            newSet.delete(featureKey);
            return newSet;
          });
        }

        return result;
      } catch (error) {
        console.error(`Failed to check feature ${featureKey}:`, error);
        return {
          enabled: false,
          source: 'global',
          reason: 'Failed to check feature',
        };
      }
    },
    [isAuthenticated, user?.orgId, enabledFeatures]
  );

  const checkQuota = useCallback(
    async (
      quotaType: 'members' | 'teams' | 'standups' | 'storage' | 'integrations'
    ): Promise<QuotaCheckResult> => {
      if (!isAuthenticated || !user?.orgId) {
        return {
          current: 0,
          limit: 0,
          exceeded: true,
        };
      }

      // Check cache first
      const cacheKey = `${quotaType}_${Date.now()}`;
      const cached = quotaCache.get(quotaType);
      if (cached && cacheKey) {
        return cached;
      }

      try {
        const result = await featuresApi.checkQuota(quotaType);

        // Cache the result for 1 minute
        quotaCache.set(quotaType, result);
        setTimeout(() => quotaCache.delete(quotaType), 60000);

        return result;
      } catch (error) {
        console.error(`Failed to check quota for ${quotaType}:`, error);
        return {
          current: 0,
          limit: 0,
          exceeded: true,
        };
      }
    },
    [isAuthenticated, user?.orgId, quotaCache]
  );

  const refreshFeatures = useCallback(async () => {
    await loadFeatures();
  }, [loadFeatures]);

  const value: FeatureContextType = {
    enabledFeatures,
    isLoading,
    hasFeature,
    checkFeature,
    refreshFeatures,
    checkQuota,
    quotaCache,
  };

  return <FeatureContext.Provider value={value}>{children}</FeatureContext.Provider>;
};

// Utility hook for checking a specific feature
export const useFeature = (featureKey: string): boolean => {
  const { hasFeature } = useFeatures();
  return hasFeature(featureKey);
};

// Utility hook for checking quota with auto-refresh
export const useQuota = (
  quotaType: 'members' | 'teams' | 'standups' | 'storage' | 'integrations'
) => {
  const { checkQuota } = useFeatures();
  const [quota, setQuota] = useState<QuotaCheckResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadQuota = async () => {
      setLoading(true);
      try {
        const result = await checkQuota(quotaType);
        setQuota(result);
      } catch (error) {
        console.error(`Failed to load quota for ${quotaType}:`, error);
      } finally {
        setLoading(false);
      }
    };

    loadQuota();

    // Refresh every minute
    const interval = setInterval(loadQuota, 60000);
    return () => clearInterval(interval);
  }, [quotaType, checkQuota]);

  return { quota, loading, refetch: () => checkQuota(quotaType) };
};
