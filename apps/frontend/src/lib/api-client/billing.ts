import { api } from '@/lib/api-client/client';

export interface BillingPlan {
  id: string;
  key: string;
  name: string;
  price: number;
  currency: string;
  interval: string;
  features: string[];
  limits: {
    teams: number;
    members: number;
    standupConfigs: number;
    standupsPerMonth: number;
  };
}

export interface Subscription {
  id: string;
  organizationId: string;
  planId: string;
  planKey?: string; // e.g., "starter", "professional"
  status: string;
  stripeSubscriptionId: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CurrentUsage {
  orgId: string;
  teams: UsageLimit;
  members: UsageLimit;
  standupConfigs: UsageLimit;
  standupsThisMonth: UsageLimit;
  nextResetDate: string;
  planName: string;
  isFreePlan: boolean;
}

export interface UsageLimit {
  used: number;
  limit: number;
  available: number;
  percentage: number;
  nearLimit: boolean;
  overLimit: boolean;
}

export interface BillingPeriod {
  orgId: string;
  periodStart: string;
  periodEnd: string;
  daysUntilReset: number;
  isInTrial: boolean;
}

export interface Invoice {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: 'paid' | 'failed' | 'pending' | 'refunded';
  invoiceUrl?: string;
}

export interface AddPaymentMethodData {
  paymentMethodId: string;
}

export interface CreateSubscriptionData {
  planId: string;
  paymentMethodId?: string;
}

export interface UpdateSubscriptionData {
  planId?: string;
  status?: string;
}

export interface PaymentMethod {
  id: string;
  type: string;
  card: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  } | null;
  isDefault: boolean;
}

export interface UsageWarning {
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface ActionPermissionResult {
  allowed: boolean;
  reason?: string;
  upgradeRequired: boolean;
}

// API Client Methods
export const billingApi = {
  /**
   * Get current subscription
   */
  async getCurrentSubscription(): Promise<{ subscription: Subscription | null; plan: string }> {
    console.log('🔍 billingApi: Getting current subscription request:', {
      url: '/billing/subscription',
      method: 'GET',
    });
    const response = await api.get('/billing/subscription');
    console.log('📄 billingApi: Current subscription response:', response.data);
    return response.data;
  },

  /**
   * Create a new subscription
   */
  async createSubscription(data: CreateSubscriptionData): Promise<{ subscription: Subscription }> {
    console.log('🚀 billingApi: Creating subscription request:', {
      url: '/billing/subscription',
      method: 'POST',
      data,
    });
    const response = await api.post('/billing/subscription', data);
    console.log('✅ billingApi: Create subscription response:', response.data);
    return response.data;
  },

  /**
   * Update subscription
   */
  async updateSubscription(data: UpdateSubscriptionData): Promise<{ subscription: Subscription }> {
    console.log('🔄 billingApi: Updating subscription request:', {
      url: '/billing/subscription',
      method: 'PUT',
      data,
    });
    const response = await api.put('/billing/subscription', data);
    console.log('✅ billingApi: Update subscription response:', response.data);
    return response.data;
  },

  /**
   * Cancel subscription
   */
  async cancelSubscription(immediate = false): Promise<{ subscription: Subscription }> {
    const response = await api.delete('/billing/subscription', { data: { immediate } });
    return response.data;
  },

  /**
   * Get available plans
   */
  async getAvailablePlans(): Promise<{ plans: BillingPlan[] }> {
    console.log('📋 billingApi: Getting available plans request:', {
      url: '/billing/plans',
      method: 'GET',
    });
    const response = await api.get('/billing/plans');
    console.log('📋 billingApi: Available plans response:', response.data);
    return response.data;
  },

  /**
   * Create setup intent for payment method
   */
  async createSetupIntent(): Promise<{ clientSecret: string }> {
    const response = await api.post('/billing/setup-intent');
    return response.data;
  },

  /**
   * Get payment methods
   */
  async getPaymentMethods(): Promise<{ paymentMethods: PaymentMethod[] }> {
    const response = await api.get('/billing/payment-methods');
    return response.data;
  },

  /**
   * Get current usage
   */
  async getCurrentUsage(): Promise<{ usage: CurrentUsage }> {
    const response = await api.get('/usage/current');
    return response.data;
  },

  /**
   * Get billing period
   */
  async getBillingPeriod(): Promise<{ billingPeriod: BillingPeriod }> {
    const response = await api.get('/usage/billing-period');
    return response.data;
  },

  /**
   * Get usage warnings
   */
  async getUsageWarnings(): Promise<{ warnings: UsageWarning[] }> {
    const response = await api.get('/usage/warnings');
    return response.data;
  },

  /**
   * Check if action is allowed
   */
  async canPerformAction(action: string): Promise<ActionPermissionResult & { action: string }> {
    const response = await api.get(`/usage/can-perform/${action}`);
    return response.data;
  },

  /**
   * Check all limits
   */
  async checkLimits(): Promise<{
    usage: CurrentUsage;
    warnings: UsageWarning[];
    needsUpgrade: boolean;
    recommendations: string[];
  }> {
    const response = await api.get('/usage/limits-check');
    return response.data;
  },

  /**
   * Validate downgrade feasibility
   */
  async validateDowngrade(planKey: string): Promise<{
    canDowngrade: boolean;
    warnings: Array<{
      type: string;
      current: number;
      newLimit: number;
      message: string;
    }>;
    blockers: Array<{
      type: string;
      current: number;
      newLimit: number;
      message: string;
    }>;
  }> {
    const response = await api.get(`/billing/downgrade-validation/${planKey}`);
    return response.data;
  },

  /**
   * Get invoices
   */
  async getInvoices(): Promise<{ invoices: Invoice[] }> {
    const response = await api.get('/billing/invoices');
    return response.data;
  },

  /**
   * Add payment method
   */
  async addPaymentMethod(data: AddPaymentMethodData): Promise<{ paymentMethod: PaymentMethod }> {
    const response = await api.post('/billing/payment-methods', data);
    return response.data;
  },

  /**
   * Remove payment method
   */
  async removePaymentMethod(paymentMethodId: string): Promise<void> {
    await api.delete(`/billing/payment-methods/${paymentMethodId}`);
  },

  /**
   * Download invoice
   */
  async downloadInvoice(invoiceId: string): Promise<Blob> {
    const response = await api.get(`/billing/invoices/${invoiceId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Retry payment
   */
  async retryPayment(invoiceId: string): Promise<{ success: boolean }> {
    const response = await api.post(`/billing/invoices/${invoiceId}/retry`);
    return response.data;
  },
};
