import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react';
import { standupsApi, type Standup, type StandupInstance, type StandupResponse } from '@/lib/api';
import { normalizeApiError } from '@/utils';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import type { AxiosError } from 'axios';

interface StandupsState {
  standups: Standup[];
  instances: StandupInstance[];
  responses: StandupResponse[];
  selectedStandup: Standup | null;
  selectedInstance: StandupInstance | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isCreating: boolean;
  isSubmittingResponse: boolean;
  lastFetchedAt: string | null;
  error: string | null;
}

type StandupsAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_REFRESHING'; payload: boolean }
  | { type: 'SET_CREATING'; payload: boolean }
  | { type: 'SET_SUBMITTING_RESPONSE'; payload: boolean }
  | { type: 'SET_STANDUPS'; payload: Standup[] }
  | { type: 'SET_INSTANCES'; payload: StandupInstance[] }
  | { type: 'SET_RESPONSES'; payload: StandupResponse[] }
  | { type: 'SET_SELECTED_STANDUP'; payload: Standup | null }
  | { type: 'SET_SELECTED_INSTANCE'; payload: StandupInstance | null }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'ADD_STANDUP'; payload: Standup }
  | { type: 'UPDATE_STANDUP'; payload: { id: string; updates: Partial<Standup> } }
  | { type: 'REMOVE_STANDUP'; payload: string }
  | { type: 'ADD_INSTANCE'; payload: StandupInstance }
  | { type: 'UPDATE_INSTANCE'; payload: { id: string; updates: Partial<StandupInstance> } }
  | { type: 'ADD_RESPONSE'; payload: StandupResponse }
  | { type: 'UPDATE_RESPONSE'; payload: { id: string; updates: Partial<StandupResponse> } }
  | { type: 'CLEAR_STATE' };

interface StandupsContextType extends StandupsState {
  fetchStandupsByTeam: (teamId: string) => Promise<void>;
  fetchStandupInstances: (standupId: string) => Promise<void>;
  fetchInstanceResponses: (instanceId: string) => Promise<void>;
  createStandup: (teamId: string, data: Partial<Standup>) => Promise<Standup>;
  updateStandup: (id: string, updates: Partial<Standup>) => Promise<void>;
  deleteStandup: (id: string) => Promise<void>;
  triggerStandupInstance: (standupId: string) => Promise<StandupInstance>;
  submitResponse: (instanceId: string, responses: Record<string, string>) => Promise<void>;
  updateResponse: (responseId: string, updates: Record<string, string>) => Promise<void>;
  selectStandup: (standup: Standup | null) => void;
  selectInstance: (instance: StandupInstance | null) => void;
  getStandupById: (id: string) => Standup | undefined;
  getInstanceById: (id: string) => StandupInstance | undefined;
  getResponsesByInstance: (instanceId: string) => StandupResponse[];
  getUserResponseForInstance: (instanceId: string, userId: string) => StandupResponse | undefined;
}

const StandupsContext = createContext<StandupsContextType | undefined>(undefined);

const initialState: StandupsState = {
  standups: [],
  instances: [],
  responses: [],
  selectedStandup: null,
  selectedInstance: null,
  isLoading: false,
  isRefreshing: false,
  isCreating: false,
  isSubmittingResponse: false,
  lastFetchedAt: null,
  error: null,
};

function standupsReducer(state: StandupsState, action: StandupsAction): StandupsState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload, error: null };

    case 'SET_REFRESHING':
      return { ...state, isRefreshing: action.payload };

    case 'SET_CREATING':
      return { ...state, isCreating: action.payload };

    case 'SET_SUBMITTING_RESPONSE':
      return { ...state, isSubmittingResponse: action.payload };

    case 'SET_STANDUPS':
      return {
        ...state,
        standups: action.payload,
        isLoading: false,
        isRefreshing: false,
        lastFetchedAt: new Date().toISOString(),
        error: null,
      };

    case 'SET_INSTANCES':
      return { ...state, instances: action.payload };

    case 'SET_RESPONSES':
      return { ...state, responses: action.payload };

    case 'SET_SELECTED_STANDUP':
      return { ...state, selectedStandup: action.payload };

    case 'SET_SELECTED_INSTANCE':
      return { ...state, selectedInstance: action.payload };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
        isRefreshing: false,
        isCreating: false,
        isSubmittingResponse: false,
      };

    case 'ADD_STANDUP':
      return {
        ...state,
        standups: [...state.standups, action.payload],
        isCreating: false,
      };

    case 'UPDATE_STANDUP': {
      const updatedStandups = state.standups.map(standup =>
        standup.id === action.payload.id ? { ...standup, ...action.payload.updates } : standup
      );

      return {
        ...state,
        standups: updatedStandups,
        selectedStandup:
          state.selectedStandup?.id === action.payload.id
            ? { ...state.selectedStandup, ...action.payload.updates }
            : state.selectedStandup,
      };
    }

    case 'REMOVE_STANDUP':
      return {
        ...state,
        standups: state.standups.filter(standup => standup.id !== action.payload),
        selectedStandup:
          state.selectedStandup?.id === action.payload ? null : state.selectedStandup,
      };

    case 'ADD_INSTANCE':
      return {
        ...state,
        instances: [...state.instances, action.payload],
      };

    case 'UPDATE_INSTANCE': {
      const updatedInstances = state.instances.map(instance =>
        instance.id === action.payload.id ? { ...instance, ...action.payload.updates } : instance
      );

      return {
        ...state,
        instances: updatedInstances,
        selectedInstance:
          state.selectedInstance?.id === action.payload.id
            ? { ...state.selectedInstance, ...action.payload.updates }
            : state.selectedInstance,
      };
    }

    case 'ADD_RESPONSE':
      return {
        ...state,
        responses: [...state.responses, action.payload],
        isSubmittingResponse: false,
      };

    case 'UPDATE_RESPONSE': {
      const updatedResponses = state.responses.map(response =>
        response.id === action.payload.id ? { ...response, ...action.payload.updates } : response
      );

      return { ...state, responses: updatedResponses };
    }

    case 'CLEAR_STATE':
      return initialState;

    default:
      return state;
  }
}

interface StandupsProviderProps {
  children: React.ReactNode;
}

export function StandupsProvider({ children }: StandupsProviderProps) {
  const [state, dispatch] = useReducer(standupsReducer, initialState);
  const { isAuthenticated } = useAuth();

  // Clear state when user logs out
  React.useEffect(() => {
    if (!isAuthenticated) {
      dispatch({ type: 'CLEAR_STATE' });
    }
  }, [isAuthenticated]);

  const fetchStandupsByTeam = useCallback(async (teamId: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const standups = await standupsApi.getStandupsByTeam(teamId);
      dispatch({ type: 'SET_STANDUPS', payload: standups });
    } catch (error: unknown) {
      // Check if this is a 404 for standup config not found - this is expected for new teams
      const axiosError = error as AxiosError;
      const errorData = axiosError?.response?.data as
        | { code?: string; detail?: string }
        | undefined;

      if (
        axiosError?.response?.status === 404 ||
        errorData?.code === 'STANDUP_CONFIG_NOT_FOUND' ||
        (errorData?.detail && errorData.detail.includes('STANDUP_CONFIG_NOT_FOUND'))
      ) {
        // For standup config not found, just set empty standups without showing error
        dispatch({ type: 'SET_STANDUPS', payload: [] });
        console.log('No standup config found for team, showing empty state');
      } else {
        // For other errors, show the error message
        const { message } = normalizeApiError(error, 'Failed to load standups');
        dispatch({ type: 'SET_ERROR', payload: message });
        console.error('Error fetching standups:', error);
      }
    }
  }, []);

  const fetchStandupInstances = useCallback(async (standupId: string) => {
    try {
      const instances = await standupsApi.getStandupInstances(standupId);
      dispatch({ type: 'SET_INSTANCES', payload: instances });
    } catch (error) {
      const { message } = normalizeApiError(error, 'Failed to load standup instances');
      console.error('Error fetching standup instances:', error);
      toast.error(message);
    }
  }, []);

  const fetchInstanceResponses = useCallback(async (instanceId: string) => {
    try {
      const responses = await standupsApi.getInstanceResponses(instanceId);
      dispatch({ type: 'SET_RESPONSES', payload: responses });
    } catch (error) {
      const { message } = normalizeApiError(error, 'Failed to load responses');
      console.error('Error fetching instance responses:', error);
      toast.error(message);
    }
  }, []);

  const createStandup = useCallback(
    async (teamId: string, data: Partial<Standup>): Promise<Standup> => {
      dispatch({ type: 'SET_CREATING', payload: true });

      try {
        toast.loading('Creating standup...', { id: 'create-standup' });
        const newStandup = await standupsApi.createStandup(teamId, data);

        toast.success('Standup created successfully!', { id: 'create-standup' });
        dispatch({ type: 'ADD_STANDUP', payload: newStandup });

        return newStandup;
      } catch (error) {
        const { message } = normalizeApiError(error, 'Failed to create standup');
        dispatch({ type: 'SET_CREATING', payload: false });
        toast.error(message, { id: 'create-standup' });
        throw error;
      }
    },
    []
  );

  const updateStandup = useCallback(
    async (id: string, updates: Partial<Standup>) => {
      try {
        toast.loading('Updating standup...', { id: `update-standup-${id}` });

        // Optimistic update
        dispatch({ type: 'UPDATE_STANDUP', payload: { id, updates } });

        const updatedStandup = await standupsApi.updateStandup(id, updates);

        // Update with server response
        dispatch({ type: 'UPDATE_STANDUP', payload: { id, updates: updatedStandup } });

        toast.success('Standup updated successfully!', { id: `update-standup-${id}` });
      } catch (error) {
        // Revert optimistic update by refetching
        const standup = state.standups.find(s => s.id === id);
        if (standup?.teamId) {
          await fetchStandupsByTeam(standup.teamId);
        }

        const { message } = normalizeApiError(error, 'Failed to update standup');
        toast.error(message, { id: `update-standup-${id}` });
        throw error;
      }
    },
    [state.standups, fetchStandupsByTeam]
  );

  const deleteStandup = useCallback(
    async (id: string) => {
      const standup = state.standups.find(s => s.id === id);
      const standupName = standup?.name || 'standup';

      const confirmed = window.confirm(
        `Are you sure you want to delete "${standupName}"? This action cannot be undone and will remove all associated responses.`
      );

      if (!confirmed) return;

      try {
        toast.loading('Deleting standup...', { id: `delete-standup-${id}` });

        await standupsApi.deleteStandup(id);

        dispatch({ type: 'REMOVE_STANDUP', payload: id });
        toast.success('Standup deleted successfully!', { id: `delete-standup-${id}` });
      } catch (error) {
        const { message } = normalizeApiError(error, 'Failed to delete standup');
        toast.error(message, { id: `delete-standup-${id}` });
        throw error;
      }
    },
    [state.standups]
  );

  const triggerStandupInstance = useCallback(
    async (standupId: string): Promise<StandupInstance> => {
      try {
        toast.loading('Creating standup instance...', { id: `trigger-${standupId}` });

        const instance = await standupsApi.triggerStandup(standupId);

        dispatch({ type: 'ADD_INSTANCE', payload: instance });
        toast.success('Standup instance created!', { id: `trigger-${standupId}` });

        return instance;
      } catch (error) {
        const { message } = normalizeApiError(error, 'Failed to trigger standup');
        toast.error(message, { id: `trigger-${standupId}` });
        throw error;
      }
    },
    []
  );

  const submitResponse = useCallback(
    async (instanceId: string, responses: Record<string, string>) => {
      dispatch({ type: 'SET_SUBMITTING_RESPONSE', payload: true });

      try {
        toast.loading('Submitting response...', { id: `submit-${instanceId}` });

        const response = await standupsApi.submitResponse(instanceId, responses);

        dispatch({ type: 'ADD_RESPONSE', payload: response });
        toast.success('Response submitted successfully!', { id: `submit-${instanceId}` });
      } catch (error) {
        const { message } = normalizeApiError(error, 'Failed to submit response');
        dispatch({ type: 'SET_SUBMITTING_RESPONSE', payload: false });
        toast.error(message, { id: `submit-${instanceId}` });
        throw error;
      }
    },
    []
  );

  const updateResponse = useCallback(
    async (responseId: string, updates: Record<string, string>) => {
      try {
        toast.loading('Updating response...', { id: `update-response-${responseId}` });

        const updatedResponse = await standupsApi.updateResponse(responseId, updates);

        dispatch({
          type: 'UPDATE_RESPONSE',
          payload: { id: responseId, updates: updatedResponse },
        });
        toast.success('Response updated successfully!', { id: `update-response-${responseId}` });
      } catch (error) {
        const { message } = normalizeApiError(error, 'Failed to update response');
        toast.error(message, { id: `update-response-${responseId}` });
        throw error;
      }
    },
    []
  );

  const selectStandup = useCallback((standup: Standup | null) => {
    dispatch({ type: 'SET_SELECTED_STANDUP', payload: standup });
  }, []);

  const selectInstance = useCallback((instance: StandupInstance | null) => {
    dispatch({ type: 'SET_SELECTED_INSTANCE', payload: instance });
  }, []);

  const getStandupById = useCallback(
    (id: string) => {
      return state.standups.find(standup => standup.id === id);
    },
    [state.standups]
  );

  const getInstanceById = useCallback(
    (id: string) => {
      return state.instances.find(instance => instance.id === id);
    },
    [state.instances]
  );

  const getResponsesByInstance = useCallback(
    (instanceId: string) => {
      return state.responses.filter(response => response.instanceId === instanceId);
    },
    [state.responses]
  );

  const getUserResponseForInstance = useCallback(
    (instanceId: string, userId: string) => {
      return state.responses.find(
        response => response.instanceId === instanceId && response.userId === userId
      );
    },
    [state.responses]
  );

  const value = useMemo(
    (): StandupsContextType => ({
      ...state,
      fetchStandupsByTeam,
      fetchStandupInstances,
      fetchInstanceResponses,
      createStandup,
      updateStandup,
      deleteStandup,
      triggerStandupInstance,
      submitResponse,
      updateResponse,
      selectStandup,
      selectInstance,
      getStandupById,
      getInstanceById,
      getResponsesByInstance,
      getUserResponseForInstance,
    }),
    [
      state,
      fetchStandupsByTeam,
      fetchStandupInstances,
      fetchInstanceResponses,
      createStandup,
      updateStandup,
      deleteStandup,
      triggerStandupInstance,
      submitResponse,
      updateResponse,
      selectStandup,
      selectInstance,
      getStandupById,
      getInstanceById,
      getResponsesByInstance,
      getUserResponseForInstance,
    ]
  );

  return <StandupsContext.Provider value={value}>{children}</StandupsContext.Provider>;
}

export function useStandups() {
  const context = useContext(StandupsContext);
  if (context === undefined) {
    throw new Error('useStandups must be used within a StandupsProvider');
  }
  return context;
}
