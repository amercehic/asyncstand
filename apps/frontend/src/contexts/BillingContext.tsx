import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import {
  billingApi,
  type BillingPlan,
  type Subscription,
  type CurrentUsage,
  type BillingPeriod,
  type CreateSubscriptionData,
  type UpdateSubscriptionData,
  type PaymentMethod,
  type UsageWarning,
  type ActionPermissionResult,
} from '@/lib/api';
import { normalizeApiError } from '@/utils';
import { toast } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';

interface BillingState {
  subscription: Subscription | null;
  currentPlan: string;
  availablePlans: BillingPlan[];
  currentUsage: CurrentUsage | null;
  billingPeriod: BillingPeriod | null;
  paymentMethods: PaymentMethod[];
  usageWarnings: UsageWarning[];
  isLoading: boolean;
  isRefreshing: boolean;
  lastFetchedAt: string | null;
  error: string | null;
}

type BillingAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_REFRESHING'; payload: boolean }
  | { type: 'SET_SUBSCRIPTION'; payload: { subscription: Subscription | null; plan: string } }
  | { type: 'SET_PLANS'; payload: BillingPlan[] }
  | { type: 'SET_USAGE'; payload: CurrentUsage }
  | { type: 'SET_BILLING_PERIOD'; payload: BillingPeriod }
  | { type: 'SET_PAYMENT_METHODS'; payload: PaymentMethod[] }
  | { type: 'SET_WARNINGS'; payload: UsageWarning[] }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_STATE' };

interface BillingContextType extends BillingState {
  fetchBillingData: () => Promise<void>;
  refreshBillingData: () => Promise<void>;
  createSubscription: (data: CreateSubscriptionData) => Promise<void>;
  updateSubscription: (data: UpdateSubscriptionData) => Promise<void>;
  cancelSubscription: (immediate?: boolean) => Promise<void>;
  createSetupIntent: () => Promise<string>;
  fetchUsage: () => Promise<void>;
  fetchWarnings: () => Promise<void>;
  canPerformAction: (action: string) => Promise<ActionPermissionResult>;
  checkLimits: () => Promise<{
    usage: CurrentUsage;
    warnings: UsageWarning[];
    needsUpgrade: boolean;
    recommendations: string[];
  }>;
}

const BillingContext = createContext<BillingContextType | undefined>(undefined);

const initialState: BillingState = {
  subscription: null,
  currentPlan: 'free',
  availablePlans: [],
  currentUsage: null,
  billingPeriod: null,
  paymentMethods: [],
  usageWarnings: [],
  isLoading: false,
  isRefreshing: false,
  lastFetchedAt: null,
  error: null,
};

function billingReducer(state: BillingState, action: BillingAction): BillingState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_REFRESHING':
      return { ...state, isRefreshing: action.payload };
    case 'SET_SUBSCRIPTION':
      return {
        ...state,
        subscription: action.payload.subscription,
        currentPlan: action.payload.plan,
        lastFetchedAt: new Date().toISOString(),
      };
    case 'SET_PLANS':
      return { ...state, availablePlans: action.payload };
    case 'SET_USAGE':
      return { ...state, currentUsage: action.payload };
    case 'SET_BILLING_PERIOD':
      return { ...state, billingPeriod: action.payload };
    case 'SET_PAYMENT_METHODS':
      return { ...state, paymentMethods: action.payload };
    case 'SET_WARNINGS':
      return { ...state, usageWarnings: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'CLEAR_STATE':
      return initialState;
    default:
      return state;
  }
}

export function BillingProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(billingReducer, initialState);
  const { user, isLoading: authIsLoading } = useAuth();

  const fetchBillingData = useCallback(async () => {
    if (!user) return;

    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      const [subscriptionResult, plansResult] = await Promise.all([
        billingApi.getCurrentSubscription(),
        billingApi.getAvailablePlans(),
      ]);

      dispatch({
        type: 'SET_SUBSCRIPTION',
        payload: {
          subscription: subscriptionResult.subscription || null,
          plan: subscriptionResult.plan || 'free',
        },
      });
      dispatch({ type: 'SET_PLANS', payload: plansResult.plans || [] });
    } catch (error) {
      const { message } = normalizeApiError(error);
      dispatch({ type: 'SET_ERROR', payload: message });
      toast.error(`Failed to fetch billing data: ${message}`);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [user]);

  const refreshBillingData = useCallback(async () => {
    if (!user) return;

    try {
      dispatch({ type: 'SET_REFRESHING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      await fetchBillingData();
    } finally {
      dispatch({ type: 'SET_REFRESHING', payload: false });
    }
  }, [user, fetchBillingData]);

  const createSubscription = useCallback(async (data: CreateSubscriptionData) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const result = await billingApi.createSubscription(data);

      dispatch({
        type: 'SET_SUBSCRIPTION',
        payload: {
          subscription: result.subscription,
          plan: result.subscription.planId,
        },
      });

      toast.success('Subscription created successfully!');
    } catch (error) {
      const { message } = normalizeApiError(error);
      toast.error(`Failed to create subscription: ${message}`);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const updateSubscription = useCallback(async (data: UpdateSubscriptionData) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const result = await billingApi.updateSubscription(data);

      dispatch({
        type: 'SET_SUBSCRIPTION',
        payload: {
          subscription: result.subscription,
          plan: result.subscription.planId,
        },
      });

      toast.success('Subscription updated successfully!');
    } catch (error) {
      const { message } = normalizeApiError(error);
      toast.error(`Failed to update subscription: ${message}`);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const cancelSubscription = useCallback(async (immediate = false) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const result = await billingApi.cancelSubscription(immediate);

      dispatch({
        type: 'SET_SUBSCRIPTION',
        payload: {
          subscription: result.subscription,
          plan: result.subscription.planId,
        },
      });

      const message = immediate
        ? 'Subscription canceled immediately'
        : 'Subscription will be canceled at period end';
      toast.success(message);
    } catch (error) {
      const { message } = normalizeApiError(error);
      toast.error(`Failed to cancel subscription: ${message}`);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const createSetupIntent = useCallback(async (): Promise<string> => {
    try {
      const result = await billingApi.createSetupIntent();
      return result.clientSecret;
    } catch (error) {
      const { message } = normalizeApiError(error);
      toast.error(`Failed to create setup intent: ${message}`);
      throw error;
    }
  }, []);

  const fetchUsage = useCallback(async () => {
    if (!user) return;

    try {
      const [usageResult, periodResult] = await Promise.all([
        billingApi.getCurrentUsage(),
        billingApi.getBillingPeriod(),
      ]);

      dispatch({ type: 'SET_USAGE', payload: usageResult.usage });
      dispatch({
        type: 'SET_BILLING_PERIOD',
        payload: periodResult.billingPeriod,
      });
    } catch (error) {
      const { message } = normalizeApiError(error);
      console.error('Failed to fetch usage:', message);
    }
  }, [user]);

  const fetchWarnings = useCallback(async () => {
    if (!user) return;

    try {
      const result = await billingApi.getUsageWarnings();
      dispatch({ type: 'SET_WARNINGS', payload: result.warnings || [] });
    } catch (error) {
      const { message } = normalizeApiError(error);
      console.error('Failed to fetch warnings:', message);
    }
  }, [user]);

  const canPerformAction = useCallback(async (action: string): Promise<ActionPermissionResult> => {
    try {
      const result = await billingApi.canPerformAction(action);
      return {
        allowed: result.allowed,
        reason: result.reason,
        upgradeRequired: result.upgradeRequired,
      };
    } catch (error) {
      const { message } = normalizeApiError(error);
      console.error('Failed to check action permission:', message);
      return { allowed: false, reason: message, upgradeRequired: true };
    }
  }, []);

  const checkLimits = useCallback(async () => {
    try {
      const result = await billingApi.checkLimits();
      return result;
    } catch (error) {
      const { message } = normalizeApiError(error);
      throw new Error(`Failed to check limits: ${message}`);
    }
  }, []);

  // Fetch billing data when user changes and auth is not loading
  useEffect(() => {
    if (authIsLoading) {
      return; // Don't fetch billing data while auth is still loading
    }

    if (user) {
      fetchBillingData();
      fetchUsage();
      fetchWarnings();
    } else {
      dispatch({ type: 'CLEAR_STATE' });
    }
  }, [user, authIsLoading, fetchBillingData, fetchUsage, fetchWarnings]);

  const contextValue = useMemo(
    () => ({
      ...state,
      fetchBillingData,
      refreshBillingData,
      createSubscription,
      updateSubscription,
      cancelSubscription,
      createSetupIntent,
      fetchUsage,
      fetchWarnings,
      canPerformAction,
      checkLimits,
    }),
    [
      state,
      fetchBillingData,
      refreshBillingData,
      createSubscription,
      updateSubscription,
      cancelSubscription,
      createSetupIntent,
      fetchUsage,
      fetchWarnings,
      canPerformAction,
      checkLimits,
    ]
  );

  return <BillingContext.Provider value={contextValue}>{children}</BillingContext.Provider>;
}

export function useBilling() {
  const context = useContext(BillingContext);
  if (context === undefined) {
    throw new Error('useBilling must be used within a BillingProvider');
  }
  return context;
}
