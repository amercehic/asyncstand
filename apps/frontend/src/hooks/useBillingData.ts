import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  invoices: 5 * 60 * 1000, // 5 minutes (shorter cache for perceived speed)
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

// New hook that fetches all invoices at once and handles pagination client-side
export const useAllInvoices = (enabled = true) => {
  return useQuery({
    queryKey: [...billingQueryKeys.invoices(), 'all'],
    queryFn: async () => {
      const response = await billingApi.getInvoices(1, 50); // Fetch first 50 invoices at once
      return response.invoices || [];
    },
    enabled,
    staleTime: CACHE_TIMES.invoices,
  });
};

export const useBillingInvoices = (page = 1, limit = 5, enabled = true) => {
  const allInvoicesQuery = useAllInvoices(enabled);

  return useMemo(() => {
    const baseReturn = {
      refetch: allInvoicesQuery.refetch,
      error: allInvoicesQuery.error,
      isSuccess: allInvoicesQuery.isSuccess,
      isFetching: allInvoicesQuery.isFetching,
    };

    if (!allInvoicesQuery.data) {
      return {
        ...baseReturn,
        data: null,
        isLoading: allInvoicesQuery.isLoading,
      };
    }

    const allInvoices = allInvoicesQuery.data;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const pageInvoices = allInvoices.slice(startIndex, endIndex);
    const totalPages = Math.ceil(allInvoices.length / limit);

    return {
      ...baseReturn,
      data: {
        invoices: pageInvoices,
        pagination: {
          page,
          limit,
          total: allInvoices.length,
          totalPages,
        },
      },
      isLoading: false, // Client-side pagination is instant
    };
  }, [allInvoicesQuery, page, limit]);
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
      return await billingApi.createSubscription(data);
    },
    onSuccess: () => {
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
      return await billingApi.updateSubscription(data);
    },
    onSuccess: () => {
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

export const useReactivateSubscription = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => billingApi.reactivateSubscription(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingQueryKeys.subscription() });
      queryClient.invalidateQueries({ queryKey: billingQueryKeys.usage() });
      toast.success('Subscription reactivated successfully!');
    },
    onError: error => {
      const { message } = normalizeApiError(error);
      toast.error(`Failed to reactivate subscription: ${message}`);
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
export const useBillingData = (enabled = true, invoicePage = 1, invoiceLimit = 5) => {
  const subscription = useBillingSubscription(enabled);
  const usage = useBillingUsage(enabled);
  const invoices = useBillingInvoices(invoicePage, invoiceLimit, enabled);
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
