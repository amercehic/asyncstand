import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { billingApi, type CreateSubscriptionData, type UpdateSubscriptionData } from '@/lib/api';
import { toast } from '@/components/ui';
import { normalizeApiError } from '@/utils';

// Query keys
export const billingQueryKeys = {
  all: ['billing'] as const,
  subscription: () => [...billingQueryKeys.all, 'subscription'] as const,
  usage: () => [...billingQueryKeys.all, 'usage'] as const,
  invoices: () => [...billingQueryKeys.all, 'invoices'] as const,
  paymentMethods: () => [...billingQueryKeys.all, 'paymentMethods'] as const,
  plans: () => [...billingQueryKeys.all, 'plans'] as const,
  warnings: () => [...billingQueryKeys.all, 'warnings'] as const,
};

// Cache times
const CACHE_TIMES = {
  subscription: 5 * 60 * 1000, // 5 minutes
  usage: 60 * 1000, // 1 minute
  invoices: 10 * 60 * 1000, // 10 minutes
  paymentMethods: 5 * 60 * 1000, // 5 minutes
  plans: 30 * 60 * 1000, // 30 minutes
  warnings: 60 * 1000, // 1 minute
};

export const useBillingSubscription = (enabled = true) => {
  return useQuery({
    queryKey: billingQueryKeys.subscription(),
    queryFn: async () => {
      const response = await billingApi.getCurrentSubscription();
      return response;
    },
    enabled,
    staleTime: CACHE_TIMES.subscription,
    retry: (failureCount: number, error: unknown) => {
      // Don't retry on 401/403 errors
      const err = error as { response?: { status?: number } };
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        return false;
      }
      return failureCount < 3;
    },
  });
};

export const useBillingUsage = (enabled = true) => {
  return useQuery({
    queryKey: billingQueryKeys.usage(),
    queryFn: async () => {
      const [usageResponse, periodResponse] = await Promise.all([
        billingApi.getCurrentUsage(),
        billingApi.getBillingPeriod(),
      ]);
      return {
        usage: usageResponse.usage,
        billingPeriod: periodResponse.billingPeriod,
      };
    },
    staleTime: CACHE_TIMES.usage,
    refetchInterval: CACHE_TIMES.usage, // Auto-refresh every minute
    enabled,
  });
};

export const useBillingInvoices = (enabled = true) => {
  return useQuery({
    queryKey: billingQueryKeys.invoices(),
    queryFn: async () => {
      const response = await billingApi.getInvoices();
      return response.invoices || [];
    },
    enabled,
    staleTime: CACHE_TIMES.invoices,
  });
};

export const useBillingPlans = (enabled = true) => {
  return useQuery({
    queryKey: billingQueryKeys.plans(),
    queryFn: async () => {
      const response = await billingApi.getAvailablePlans();
      return response.plans || [];
    },
    enabled,
    staleTime: CACHE_TIMES.plans,
  });
};

export const useBillingWarnings = (enabled = true) => {
  return useQuery({
    queryKey: billingQueryKeys.warnings(),
    queryFn: async () => {
      const response = await billingApi.getUsageWarnings();
      return response.warnings || [];
    },
    enabled,
    staleTime: CACHE_TIMES.warnings,
    refetchInterval: CACHE_TIMES.warnings, // Auto-refresh every minute
  });
};

export const usePaymentMethods = (enabled = true) => {
  return useQuery({
    queryKey: billingQueryKeys.paymentMethods(),
    queryFn: async () => {
      const response = await billingApi.getPaymentMethods();
      return response.paymentMethods || [];
    },
    enabled,
    staleTime: CACHE_TIMES.paymentMethods,
  });
};

// Mutations
export const useCreateSubscription = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateSubscriptionData) => {
      console.log('🚀 useBillingData: Creating subscription with data:', data);
      const result = await billingApi.createSubscription(data);
      console.log('✅ useBillingData: Create subscription API response:', result);
      return result;
    },
    onSuccess: data => {
      console.log('✅ useBillingData: Create subscription mutation success:', data);
      queryClient.invalidateQueries({ queryKey: billingQueryKeys.subscription() });
      queryClient.invalidateQueries({ queryKey: billingQueryKeys.usage() });
      queryClient.invalidateQueries({ queryKey: billingQueryKeys.invoices() });
      queryClient.invalidateQueries({ queryKey: billingQueryKeys.plans() });
      // Toast is handled by the calling component to avoid duplicates
    },
    onError: error => {
      console.error('❌ useBillingData: Create subscription mutation error:', error);
      const { message } = normalizeApiError(error);
      toast.error(`Failed to create subscription: ${message}`);
    },
  });
};

export const useUpdateSubscription = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateSubscriptionData) => {
      console.log('🔄 useBillingData: Updating subscription with data:', data);
      const result = await billingApi.updateSubscription(data);
      console.log('✅ useBillingData: Update subscription API response:', result);
      return result;
    },
    onSuccess: data => {
      console.log('✅ useBillingData: Update subscription mutation success:', data);
      queryClient.invalidateQueries({ queryKey: billingQueryKeys.subscription() });
      queryClient.invalidateQueries({ queryKey: billingQueryKeys.usage() });
      queryClient.invalidateQueries({ queryKey: billingQueryKeys.invoices() });
      queryClient.invalidateQueries({ queryKey: billingQueryKeys.plans() });
      // Toast is handled by the calling component to avoid duplicates
    },
    onError: error => {
      console.error('❌ useBillingData: Update subscription mutation error:', error);
      const { message } = normalizeApiError(error);
      toast.error(`Failed to update subscription: ${message}`);
    },
  });
};

export const useCancelSubscription = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ immediate = false }: { immediate?: boolean }) =>
      billingApi.cancelSubscription(immediate),
    onSuccess: (_, { immediate }) => {
      queryClient.invalidateQueries({ queryKey: billingQueryKeys.subscription() });
      const message = immediate
        ? 'Subscription canceled immediately'
        : 'Subscription will be canceled at period end';
      toast.success(message);
    },
    onError: error => {
      const { message } = normalizeApiError(error);
      toast.error(`Failed to cancel subscription: ${message}`);
    },
  });
};

export const useAddPaymentMethod = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: billingApi.addPaymentMethod,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingQueryKeys.paymentMethods() });
      // Toast is handled by the calling component to avoid duplicates
    },
    onError: error => {
      const { message } = normalizeApiError(error);
      toast.error(`Failed to add payment method: ${message}`);
    },
  });
};

export const useRemovePaymentMethod = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ paymentMethodId }: { paymentMethodId: string }) =>
      billingApi.removePaymentMethod(paymentMethodId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingQueryKeys.paymentMethods() });
      toast.success('Payment method removed successfully!');
    },
    onError: error => {
      const { message } = normalizeApiError(error);
      toast.error(`Failed to remove payment method: ${message}`);
    },
  });
};

export const useDownloadInvoice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ invoiceId, invoiceUrl }: { invoiceId: string; invoiceUrl?: string }) => {
      // If we have a direct invoice URL (from Stripe), use it directly
      if (invoiceUrl) {
        window.open(invoiceUrl, '_blank');
        return { success: true };
      }

      // Otherwise, try to get the invoices to find the URL
      try {
        const invoicesData = queryClient.getQueryData(billingQueryKeys.invoices()) as Array<{
          id: string;
          invoiceUrl?: string;
        }>;
        if (invoicesData) {
          const invoice = invoicesData.find(inv => inv.id === invoiceId);
          if (invoice?.invoiceUrl) {
            window.open(invoice.invoiceUrl, '_blank');
            return { success: true };
          }
        }
      } catch (error) {
        console.warn('Could not get invoice URL from cache:', error);
      }

      // Fallback: try the backend download endpoint (may still fail due to auth)
      const downloadUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/billing/invoices/${invoiceId}/download`;
      window.open(downloadUrl, '_blank');

      return { success: true };
    },
    onSuccess: () => {
      toast.success('Invoice download started!');
    },
    onError: error => {
      const { message } = normalizeApiError(error);
      toast.error(`Failed to download invoice: ${message}`);
    },
  });
};

export const useRetryPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ invoiceId }: { invoiceId: string }) => billingApi.retryPayment(invoiceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingQueryKeys.invoices() });
      queryClient.invalidateQueries({ queryKey: billingQueryKeys.subscription() });
      toast.success('Payment retry initiated successfully!');
    },
    onError: error => {
      const { message } = normalizeApiError(error);
      toast.error(`Failed to retry payment: ${message}`);
    },
  });
};

// Custom hook for managing real-time usage updates
export const useRealTimeUsage = () => {
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const { data: usageData, refetch } = useBillingUsage(true);

  const startRealTimeUpdates = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      refetch();
      setLastUpdate(new Date());
    }, 60000) as NodeJS.Timeout; // Update every minute
  }, [refetch]);

  const stopRealTimeUpdates = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  }, []);

  useEffect(() => {
    startRealTimeUpdates();

    return () => {
      stopRealTimeUpdates();
    };
  }, [startRealTimeUpdates, stopRealTimeUpdates]);

  return {
    usageData,
    lastUpdate,
    refetch,
    startRealTimeUpdates,
    stopRealTimeUpdates,
  };
};

// Custom hook for comprehensive billing data
export const useBillingData = (enabled = true) => {
  const subscription = useBillingSubscription(enabled);
  const usage = useBillingUsage(enabled);
  const invoices = useBillingInvoices(enabled);
  const plans = useBillingPlans(enabled);
  const warnings = useBillingWarnings(enabled);
  const paymentMethods = usePaymentMethods(enabled);

  const isLoading =
    subscription.isLoading ||
    usage.isLoading ||
    invoices.isLoading ||
    plans.isLoading ||
    warnings.isLoading ||
    paymentMethods.isLoading;

  const hasError =
    subscription.error ||
    usage.error ||
    invoices.error ||
    plans.error ||
    warnings.error ||
    paymentMethods.error;

  const refetchAll = useCallback(async () => {
    await Promise.all([
      subscription.refetch(),
      usage.refetch(),
      invoices.refetch(),
      plans.refetch(),
      warnings.refetch(),
      paymentMethods.refetch(),
    ]);
  }, [subscription, usage, invoices, plans, warnings, paymentMethods]);

  return {
    subscription: subscription.data,
    usage: usage.data,
    invoices: invoices.data,
    plans: plans.data,
    warnings: warnings.data,
    paymentMethods: paymentMethods.data,
    isLoading,
    hasError,
    refetchAll,
    queries: {
      subscription,
      usage,
      invoices,
      plans,
      warnings,
      paymentMethods,
    },
  };
};
