import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { teamsApi, type Team, type CreateTeamRequest } from '@/lib/api';
import { normalizeApiError } from '@/utils';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface TeamsState {
  teams: Team[];
  selectedTeam: Team | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isCreating: boolean;
  lastFetchedAt: string | null;
  error: string | null;
}

type TeamsAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_REFRESHING'; payload: boolean }
  | { type: 'SET_CREATING'; payload: boolean }
  | { type: 'SET_TEAMS'; payload: Team[] }
  | { type: 'SET_SELECTED_TEAM'; payload: Team | null }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'ADD_TEAM'; payload: Team }
  | { type: 'UPDATE_TEAM'; payload: { id: string; updates: Partial<Team> } }
  | { type: 'REMOVE_TEAM'; payload: string }
  | { type: 'CLEAR_STATE' };

interface TeamsContextType extends TeamsState {
  fetchTeams: () => Promise<void>;
  refreshTeams: () => Promise<void>;
  createTeam: (data: CreateTeamRequest) => Promise<Team>;
  getTeamById: (id: string) => Promise<Team>;
  updateTeam: (id: string, updates: Partial<Team>) => Promise<void>;
  deleteTeam: (id: string) => Promise<void>;
  selectTeam: (team: Team | null) => void;
  getTeamByIdFromCache: (id: string) => Team | undefined;
}

const TeamsContext = createContext<TeamsContextType | undefined>(undefined);

const initialState: TeamsState = {
  teams: [],
  selectedTeam: null,
  isLoading: false,
  isRefreshing: false,
  isCreating: false,
  lastFetchedAt: null,
  error: null,
};

function teamsReducer(state: TeamsState, action: TeamsAction): TeamsState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload, error: null };

    case 'SET_REFRESHING':
      return { ...state, isRefreshing: action.payload };

    case 'SET_CREATING':
      return { ...state, isCreating: action.payload };

    case 'SET_TEAMS':
      return {
        ...state,
        teams: action.payload,
        isLoading: false,
        isRefreshing: false,
        lastFetchedAt: new Date().toISOString(),
        error: null,
      };

    case 'SET_SELECTED_TEAM':
      return { ...state, selectedTeam: action.payload };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
        isRefreshing: false,
        isCreating: false,
      };

    case 'ADD_TEAM':
      return {
        ...state,
        teams: [...state.teams, action.payload],
        isCreating: false,
      };

    case 'UPDATE_TEAM': {
      const updatedTeams = state.teams.map(team =>
        team.id === action.payload.id ? { ...team, ...action.payload.updates } : team
      );

      return {
        ...state,
        teams: updatedTeams,
        selectedTeam:
          state.selectedTeam?.id === action.payload.id
            ? { ...state.selectedTeam, ...action.payload.updates }
            : state.selectedTeam,
      };
    }

    case 'REMOVE_TEAM':
      return {
        ...state,
        teams: state.teams.filter(team => team.id !== action.payload),
        selectedTeam: state.selectedTeam?.id === action.payload ? null : state.selectedTeam,
      };

    case 'CLEAR_STATE':
      return initialState;

    default:
      return state;
  }
}

interface TeamsProviderProps {
  children: React.ReactNode;
}

export function TeamsProvider({ children }: TeamsProviderProps) {
  const [state, dispatch] = useReducer(teamsReducer, initialState);
  const { isAuthenticated } = useAuth();

  // Fetch teams when user is authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchTeams();
    } else {
      dispatch({ type: 'CLEAR_STATE' });
    }
  }, [isAuthenticated]);

  const fetchTeams = useCallback(async () => {
    if (state.isLoading || state.isRefreshing) return;

    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const teams = await teamsApi.getTeams();
      dispatch({ type: 'SET_TEAMS', payload: teams });
    } catch (error) {
      const { message } = normalizeApiError(error, 'Failed to load teams');
      dispatch({ type: 'SET_ERROR', payload: message });
      console.error('Error fetching teams:', error);
    }
  }, [state.isLoading, state.isRefreshing]);

  const refreshTeams = useCallback(async () => {
    if (state.isLoading || state.isRefreshing) return;

    dispatch({ type: 'SET_REFRESHING', payload: true });

    try {
      const teams = await teamsApi.getTeams();
      dispatch({ type: 'SET_TEAMS', payload: teams });
    } catch (error) {
      const { message } = normalizeApiError(error, 'Failed to refresh teams');
      dispatch({ type: 'SET_ERROR', payload: message });
      console.error('Error refreshing teams:', error);
    }
  }, [state.isLoading, state.isRefreshing]);

  const createTeam = useCallback(async (data: CreateTeamRequest): Promise<Team> => {
    dispatch({ type: 'SET_CREATING', payload: true });

    try {
      toast.loading('Creating team...', { id: 'create-team' });
      const newTeam = await teamsApi.createTeam(data);

      toast.success('Team created successfully!', { id: 'create-team' });
      dispatch({ type: 'ADD_TEAM', payload: newTeam });

      return newTeam;
    } catch (error) {
      const { message } = normalizeApiError(error, 'Failed to create team');
      dispatch({ type: 'SET_CREATING', payload: false });
      toast.error(message, { id: 'create-team' });
      throw error;
    }
  }, []);

  const getTeamById = useCallback(
    async (id: string): Promise<Team> => {
      // Check cache first
      const cachedTeam = state.teams.find(team => team.id === id);
      if (cachedTeam) {
        return cachedTeam;
      }

      // Fetch from API if not in cache
      try {
        const team = await teamsApi.getTeam(id);
        // Update cache
        dispatch({ type: 'UPDATE_TEAM', payload: { id, updates: team } });
        return team;
      } catch (error) {
        const { message } = normalizeApiError(error, 'Failed to load team');
        throw new Error(message);
      }
    },
    [state.teams]
  );

  const updateTeam = useCallback(
    async (id: string, updates: Partial<Team>) => {
      try {
        toast.loading('Updating team...', { id: `update-team-${id}` });

        // Optimistic update
        dispatch({ type: 'UPDATE_TEAM', payload: { id, updates } });

        const updatedTeam = await teamsApi.updateTeam(id, updates);

        // Update with server response
        dispatch({ type: 'UPDATE_TEAM', payload: { id, updates: updatedTeam } });

        toast.success('Team updated successfully!', { id: `update-team-${id}` });
      } catch (error) {
        // Revert optimistic update by refetching
        await refreshTeams();

        const { message } = normalizeApiError(error, 'Failed to update team');
        toast.error(message, { id: `update-team-${id}` });
        throw error;
      }
    },
    [refreshTeams]
  );

  const deleteTeam = useCallback(
    async (id: string) => {
      const team = state.teams.find(t => t.id === id);
      const teamName = team?.name || 'team';

      const confirmed = window.confirm(
        `Are you sure you want to delete "${teamName}"? This action cannot be undone and will remove all associated standups.`
      );

      if (!confirmed) return;

      try {
        toast.loading('Deleting team...', { id: `delete-team-${id}` });

        await teamsApi.deleteTeam(id);

        dispatch({ type: 'REMOVE_TEAM', payload: id });
        toast.success('Team deleted successfully!', { id: `delete-team-${id}` });
      } catch (error) {
        const { message } = normalizeApiError(error, 'Failed to delete team');
        toast.error(message, { id: `delete-team-${id}` });
        throw error;
      }
    },
    [state.teams]
  );

  const selectTeam = useCallback((team: Team | null) => {
    dispatch({ type: 'SET_SELECTED_TEAM', payload: team });
  }, []);

  const getTeamByIdFromCache = useCallback(
    (id: string) => {
      return state.teams.find(team => team.id === id);
    },
    [state.teams]
  );

  const value = useMemo(
    (): TeamsContextType => ({
      ...state,
      fetchTeams,
      refreshTeams,
      createTeam,
      getTeamById,
      updateTeam,
      deleteTeam,
      selectTeam,
      getTeamByIdFromCache,
    }),
    [
      state,
      fetchTeams,
      refreshTeams,
      createTeam,
      getTeamById,
      updateTeam,
      deleteTeam,
      selectTeam,
      getTeamByIdFromCache,
    ]
  );

  return <TeamsContext.Provider value={value}>{children}</TeamsContext.Provider>;
}

export function useTeams() {
  const context = useContext(TeamsContext);
  if (context === undefined) {
    throw new Error('useTeams must be used within a TeamsProvider');
  }
  return context;
}
