import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { integrationsApi, type SlackIntegration } from '@/lib/api';
import { normalizeApiError } from '@/utils';
import { toast } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';

interface IntegrationsState {
  integrations: SlackIntegration[];
  isLoading: boolean;
  isRefreshing: boolean;
  syncingIds: Set<string>;
  lastFetchedAt: string | null;
  error: string | null;
}

type IntegrationsAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_REFRESHING'; payload: boolean }
  | { type: 'SET_INTEGRATIONS'; payload: SlackIntegration[] }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'ADD_SYNCING_ID'; payload: string }
  | { type: 'REMOVE_SYNCING_ID'; payload: string }
  | { type: 'UPDATE_INTEGRATION'; payload: { id: string; updates: Partial<SlackIntegration> } }
  | { type: 'REMOVE_INTEGRATION'; payload: string }
  | { type: 'CLEAR_STATE' };

interface IntegrationsContextType extends IntegrationsState {
  fetchIntegrations: () => Promise<void>;
  refreshIntegrations: () => Promise<void>;
  syncIntegration: (integrationId: string) => Promise<void>;
  removeIntegration: (integrationId: string) => Promise<void>;
  updateIntegrationStatus: (id: string, updates: Partial<SlackIntegration>) => void;
  isIntegrationSyncing: (id: string) => boolean;
}

const IntegrationsContext = createContext<IntegrationsContextType | undefined>(undefined);

const initialState: IntegrationsState = {
  integrations: [],
  isLoading: false,
  isRefreshing: false,
  syncingIds: new Set(),
  lastFetchedAt: null,
  error: null,
};

function integrationsReducer(
  state: IntegrationsState,
  action: IntegrationsAction
): IntegrationsState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload, error: null };

    case 'SET_REFRESHING':
      return { ...state, isRefreshing: action.payload };

    case 'SET_INTEGRATIONS':
      return {
        ...state,
        integrations: action.payload,
        isLoading: false,
        isRefreshing: false,
        lastFetchedAt: new Date().toISOString(),
        error: null,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
        isRefreshing: false,
      };

    case 'ADD_SYNCING_ID':
      return {
        ...state,
        syncingIds: new Set([...state.syncingIds, action.payload]),
      };

    case 'REMOVE_SYNCING_ID': {
      const newSyncingIds = new Set(state.syncingIds);
      newSyncingIds.delete(action.payload);
      return {
        ...state,
        syncingIds: newSyncingIds,
      };
    }

    case 'UPDATE_INTEGRATION':
      return {
        ...state,
        integrations: state.integrations.map(integration =>
          integration.id === action.payload.id
            ? { ...integration, ...action.payload.updates }
            : integration
        ),
      };

    case 'REMOVE_INTEGRATION':
      return {
        ...state,
        integrations: state.integrations.filter(integration => integration.id !== action.payload),
      };

    case 'CLEAR_STATE':
      return initialState;

    default:
      return state;
  }
}

interface IntegrationsProviderProps {
  children: React.ReactNode;
}

export function IntegrationsProvider({ children }: IntegrationsProviderProps) {
  const [state, dispatch] = useReducer(integrationsReducer, initialState);
  const { isAuthenticated, user } = useAuth();

  // Fetch integrations when user is authenticated
  // Skip fetching for super admins as they don't need integrations data
  useEffect(() => {
    if (isAuthenticated && !user?.isSuperAdmin) {
      fetchIntegrations();
    } else {
      dispatch({ type: 'CLEAR_STATE' });
    }
  }, [isAuthenticated, user?.isSuperAdmin]);

  const fetchIntegrations = useCallback(async () => {
    if (state.isLoading || state.isRefreshing) return;

    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const integrations = await integrationsApi.getSlackIntegrations();
      dispatch({ type: 'SET_INTEGRATIONS', payload: integrations });
    } catch (error) {
      const { message } = normalizeApiError(error, 'Failed to load integrations');
      dispatch({ type: 'SET_ERROR', payload: message });
      console.error('Error fetching integrations:', error);
    }
  }, [state.isLoading, state.isRefreshing]);

  const refreshIntegrations = useCallback(async () => {
    // Don't set refreshing if already loading to avoid UI flicker
    if (!state.isLoading) {
      dispatch({ type: 'SET_REFRESHING', payload: true });
    }

    try {
      const integrations = await integrationsApi.getSlackIntegrations();
      dispatch({ type: 'SET_INTEGRATIONS', payload: integrations });
    } catch (error) {
      const { message } = normalizeApiError(error, 'Failed to refresh integrations');
      dispatch({ type: 'SET_ERROR', payload: message });
      console.error('Error refreshing integrations:', error);
    }
  }, [state.isLoading]);

  const syncIntegration = useCallback(async (integrationId: string) => {
    dispatch({ type: 'ADD_SYNCING_ID', payload: integrationId });

    try {
      toast.loading('Syncing workspace data...', { id: `sync-${integrationId}` });
      const result = await integrationsApi.triggerSlackSync(integrationId);

      if (result.success) {
        toast.success(
          `Sync completed! Added ${result.usersAdded} users, ${result.channelsAdded} channels`,
          { id: `sync-${integrationId}` }
        );

        // Update the integration's sync state with actual sync results
        dispatch({
          type: 'UPDATE_INTEGRATION',
          payload: {
            id: integrationId,
            updates: {
              syncState: {
                lastUsersSyncAt: new Date().toISOString(),
                lastChannelsSyncAt: new Date().toISOString(),
                errorMsg: undefined,
                userCount: result.usersAdded + (result.usersUpdated || 0),
                channelCount: result.channelsAdded + (result.channelsUpdated || 0),
              },
            },
          },
        });
      } else {
        toast.warning('Sync completed with some issues', { id: `sync-${integrationId}` });
      }
    } catch (error) {
      const { message } = normalizeApiError(error, 'Failed to sync workspace');
      toast.error(message, { id: `sync-${integrationId}` });

      // Update the integration's error state
      dispatch({
        type: 'UPDATE_INTEGRATION',
        payload: {
          id: integrationId,
          updates: {
            syncState: {
              errorMsg: message,
            },
          },
        },
      });
    } finally {
      dispatch({ type: 'REMOVE_SYNCING_ID', payload: integrationId });
    }
  }, []);

  const removeIntegration = useCallback(async (integrationId: string) => {
    try {
      toast.loading('Disconnecting workspace...', { id: `disconnect-${integrationId}` });
      await integrationsApi.removeSlackIntegration(integrationId);

      toast.success('Workspace disconnected successfully', { id: `disconnect-${integrationId}` });
      dispatch({ type: 'REMOVE_INTEGRATION', payload: integrationId });
    } catch (error) {
      const { message } = normalizeApiError(error, 'Failed to disconnect workspace');
      toast.error(message, { id: `disconnect-${integrationId}` });
    }
  }, []);

  const updateIntegrationStatus = useCallback((id: string, updates: Partial<SlackIntegration>) => {
    dispatch({ type: 'UPDATE_INTEGRATION', payload: { id, updates } });
  }, []);

  const isIntegrationSyncing = useCallback(
    (id: string) => {
      return state.syncingIds.has(id);
    },
    [state.syncingIds]
  );

  const value = useMemo(
    (): IntegrationsContextType => ({
      ...state,
      fetchIntegrations,
      refreshIntegrations,
      syncIntegration,
      removeIntegration,
      updateIntegrationStatus,
      isIntegrationSyncing,
    }),
    [
      state,
      fetchIntegrations,
      refreshIntegrations,
      syncIntegration,
      removeIntegration,
      updateIntegrationStatus,
      isIntegrationSyncing,
    ]
  );

  return <IntegrationsContext.Provider value={value}>{children}</IntegrationsContext.Provider>;
}

export function useIntegrations() {
  const context = useContext(IntegrationsContext);
  if (context === undefined) {
    throw new Error('useIntegrations must be used within an IntegrationsProvider');
  }
  return context;
}
