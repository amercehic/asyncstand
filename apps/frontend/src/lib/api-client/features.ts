import { api } from '@/lib/api';

export interface Feature {
  key: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  environment: string[];
  rolloutType: string;
  rolloutValue: unknown;
  category: string | null;
  isPlanBased: boolean;
  requiresAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FeatureCheckResult {
  enabled: boolean;
  source: 'global' | 'environment' | 'plan' | 'rollout';
  value?: string;
  reason?: string;
}

export interface CreateFeatureDto {
  key: string;
  name: string;
  description?: string;
  isEnabled?: boolean;
  environment?: string[];
  rolloutType?: string;
  rolloutValue?: unknown;
  category?: string;
  isPlanBased?: boolean;
  requiresAdmin?: boolean;
}

export interface UpdateFeatureDto {
  name?: string;
  description?: string;
  isEnabled?: boolean;
  environment?: string[];
  rolloutType?: string;
  rolloutValue?: unknown;
  category?: string;
  isPlanBased?: boolean;
  requiresAdmin?: boolean;
}

export interface QuotaCheckResult {
  current: number;
  limit: number;
  exceeded: boolean;
}

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  features: string[];
  quotas: Record<string, number>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const featuresApi = {
  /**
   * Get enabled features for current user's organization
   */
  getEnabledFeatures: async (): Promise<string[]> => {
    const response = await api.get<{ features: string[] }>('/features/enabled');
    return response.data.features;
  },

  /**
   * Check if a specific feature is enabled
   */
  checkFeature: async (featureKey: string): Promise<FeatureCheckResult> => {
    const response = await api.get<FeatureCheckResult>(`/features/check/${featureKey}`);
    return response.data;
  },

  /**
   * Check quota for a specific resource type
   */
  checkQuota: async (quotaType: 'members' | 'teams' | 'standups' | 'storage' | 'integrations') => {
    const response = await api.get(`/features/quota/${quotaType}`);
    return response.data;
  },

  // Admin endpoints (require super admin access)

  /**
   * List all features (admin only)
   */
  getAllFeatures: async (category?: string): Promise<{ features: Feature[] }> => {
    const params = category ? { category } : {};
    const response = await api.get<{ features: Feature[] }>('/features/admin/list', { params });
    return response.data;
  },

  /**
   * Create a new feature (admin only)
   */
  createFeature: async (createFeatureDto: CreateFeatureDto): Promise<{ feature: Feature }> => {
    const response = await api.post<{ feature: Feature }>(
      '/features/admin/create',
      createFeatureDto
    );
    return response.data;
  },

  /**
   * Update an existing feature (admin only)
   */
  updateFeature: async (
    featureKey: string,
    updateFeatureDto: UpdateFeatureDto
  ): Promise<{ feature: Feature }> => {
    const response = await api.put<{ feature: Feature }>(
      `/features/admin/${featureKey}`,
      updateFeatureDto
    );
    return response.data;
  },
};
