import React, { createContext, useContext, useReducer, useCallback } from 'react';
import {
  ToastData,
  ToastPosition,
  ToastContextValue,
  CreateToastData,
} from '@/components/ui/Toast/types';

type ToastAction =
  | { type: 'ADD_TOAST'; payload: CreateToastData }
  | { type: 'REMOVE_TOAST'; payload: string }
  | { type: 'UPDATE_TOAST'; payload: { id: string; updates: Partial<ToastData> } }
  | { type: 'CLEAR_TOASTS' }
  | { type: 'SET_POSITION'; payload: ToastPosition };

interface ToastState {
  toasts: ToastData[];
  position: ToastPosition;
}

const initialState: ToastState = {
  toasts: [],
  position: 'top-right',
};

function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case 'ADD_TOAST': {
      const newToast: ToastData = {
        ...action.payload,
        id: action.payload.id || generateToastId(),
        createdAt: Date.now(),
      };

      // If a toast with the same ID already exists, replace it
      const existingIndex = state.toasts.findIndex(toast => toast.id === newToast.id);
      if (existingIndex !== -1) {
        const updatedToasts = [...state.toasts];
        updatedToasts[existingIndex] = newToast;
        return {
          ...state,
          toasts: updatedToasts,
        };
      }

      return {
        ...state,
        toasts: [newToast, ...state.toasts],
      };
    }

    case 'REMOVE_TOAST':
      return {
        ...state,
        toasts: state.toasts.filter(toast => toast.id !== action.payload),
      };

    case 'UPDATE_TOAST':
      return {
        ...state,
        toasts: state.toasts.map(toast =>
          toast.id === action.payload.id ? { ...toast, ...action.payload.updates } : toast
        ),
      };

    case 'CLEAR_TOASTS':
      return {
        ...state,
        toasts: [],
      };

    case 'SET_POSITION':
      return {
        ...state,
        position: action.payload,
      };

    default:
      return state;
  }
}

function generateToastId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: React.ReactNode;
  defaultPosition?: ToastPosition;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  defaultPosition = 'top-right',
}) => {
  const [state, dispatch] = useReducer(toastReducer, {
    ...initialState,
    position: defaultPosition,
  });

  const addToast = useCallback((toast: CreateToastData): string => {
    const id = toast.id || generateToastId();
    dispatch({ type: 'ADD_TOAST', payload: { ...toast, id } });
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_TOAST', payload: id });
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<ToastData>) => {
    dispatch({ type: 'UPDATE_TOAST', payload: { id, updates } });
  }, []);

  const clearToasts = useCallback(() => {
    dispatch({ type: 'CLEAR_TOASTS' });
  }, []);

  const setPosition = useCallback((position: ToastPosition) => {
    dispatch({ type: 'SET_POSITION', payload: position });
  }, []);

  const value: ToastContextValue = {
    toasts: state.toasts,
    addToast,
    removeToast,
    updateToast,
    clearToasts,
    position: state.position,
    setPosition,
  };

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};
