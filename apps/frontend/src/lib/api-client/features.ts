import { api as apiClient } from '@/lib/api-client/client';

export interface FeatureCheckResult {
  enabled: boolean;
  source: 'global' | 'environment' | 'plan' | 'override' | 'rollout';
  value?: string;
  reason?: string;
}

export interface QuotaCheckResult {
  current: number;
  limit: number | null;
  exceeded: boolean;
}

export interface Feature {
  key: string;
  name: string;
  description?: string;
  isEnabled: boolean;
  environment: string[];
  rolloutType: string;
  rolloutValue?: unknown;
  category?: string;
  isPlanBased: boolean;
  requiresAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Plan {
  id: string;
  key: string;
  name: string;
  displayName: string;
  description?: string;
  price: number;
  interval: string;
  stripePriceId?: string;
  isActive: boolean;
  sortOrder: number;
  memberLimit?: number;
  teamLimit?: number;
  standupLimit?: number;
  storageLimit?: number;
  integrationLimit?: number;
  createdAt: string;
  updatedAt: string;
}

export const featuresApi = {
  /**
   * Get all enabled features for the current organization
   */
  async getEnabledFeatures(): Promise<string[]> {
    const response = await apiClient.get<{ features: string[] }>('/features/enabled');
    return response.data.features;
  },

  /**
   * Check if a specific feature is enabled
   */
  async checkFeature(featureKey: string): Promise<FeatureCheckResult> {
    const response = await apiClient.get<FeatureCheckResult>(`/features/check/${featureKey}`);
    return response.data;
  },

  /**
   * Check quota usage for a specific resource
   */
  async checkQuota(
    quotaType: 'members' | 'teams' | 'standups' | 'storage' | 'integrations'
  ): Promise<QuotaCheckResult> {
    const response = await apiClient.get<QuotaCheckResult>(`/features/quota/${quotaType}`);
    return response.data;
  },
};
