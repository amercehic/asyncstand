import { api } from '@/lib/api-client/client';

export interface PlanFeature {
  featureKey: string;
  enabled: boolean;
  value?: string;
}

export interface Plan {
  id: string;
  key: string;
  name: string;
  displayName: string;
  description: string;
  price: number;
  interval: string;
  stripePriceId: string;
  isActive: boolean;
  sortOrder: number;
  memberLimit: number;
  teamLimit: number;
  standupConfigLimit: number;
  standupLimit: number;
  storageLimit: number;
  integrationLimit: number;
  features: PlanFeature[];
  subscriptionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Feature {
  key: string;
  name: string;
  description: string;
  isEnabled: boolean;
  environment: string[];
  category: string;
  isPlanBased: boolean;
  requiresAdmin: boolean;
}

export interface CreatePlanData {
  key: string;
  name: string;
  displayName: string;
  description?: string;
  price: number;
  interval?: string;
  stripePriceId?: string;
  isActive?: boolean;
  sortOrder?: number;
  memberLimit?: number;
  teamLimit?: number;
  standupConfigLimit?: number;
  standupLimit?: number;
  storageLimit?: number;
  integrationLimit?: number;
  features?: PlanFeature[];
}

export interface UpdatePlanData {
  name?: string;
  displayName?: string;
  description?: string;
  price?: number;
  interval?: string;
  stripePriceId?: string;
  isActive?: boolean;
  sortOrder?: number;
  memberLimit?: number;
  teamLimit?: number;
  standupConfigLimit?: number;
  standupLimit?: number;
  storageLimit?: number;
  integrationLimit?: number;
  features?: PlanFeature[];
}

export interface PlanAnalytics {
  plans: Array<{
    id: string;
    key: string;
    name: string;
    subscriptionCount: number;
    percentage: number;
    revenue: number;
  }>;
  totalSubscriptions: number;
  totalRevenue: number;
}

// API Client Methods
export const adminApi = {
  /**
   * Get all plans
   */
  async getAllPlans(): Promise<{ plans: Plan[] }> {
    const response = await api.get('/admin/plans');
    return { plans: response.data };
  },

  /**
   * Get plan by ID
   */
  async getPlanById(planId: string): Promise<{ plan: Plan }> {
    const response = await api.get(`/admin/plans/${planId}`);
    return { plan: response.data };
  },

  /**
   * Get plan by key
   */
  async getPlanByKey(key: string): Promise<{ plan: Plan }> {
    const response = await api.get(`/admin/plans/key/${key}`);
    return { plan: response.data };
  },

  /**
   * Create a new plan
   */
  async createPlan(data: CreatePlanData): Promise<{ plan: Plan }> {
    const response = await api.post('/admin/plans', data);
    return { plan: response.data };
  },

  /**
   * Update an existing plan
   */
  async updatePlan(planId: string, data: UpdatePlanData): Promise<{ plan: Plan }> {
    const response = await api.put(`/admin/plans/${planId}`, data);
    return { plan: response.data };
  },

  /**
   * Delete a plan
   */
  async deletePlan(planId: string): Promise<void> {
    await api.delete(`/admin/plans/${planId}`);
  },

  /**
   * Get available features for plan assignment
   */
  async getAvailableFeatures(): Promise<{ features: Feature[] }> {
    const response = await api.get('/admin/plans/features');
    return { features: response.data };
  },

  /**
   * Get plan analytics
   */
  async getPlanAnalytics(): Promise<{ analytics: PlanAnalytics }> {
    const response = await api.get('/admin/plans/analytics');
    return { analytics: response.data };
  },
};
