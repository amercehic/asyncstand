import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import {
  ToastData,
  ToastPosition,
  ToastContextValue,
  CreateToastData,
  ToastPriority,
} from '@/components/ui/Toast/types';

type ToastAction =
  | { type: 'ADD_TOAST'; payload: CreateToastData }
  | { type: 'REMOVE_TOAST'; payload: string }
  | { type: 'UPDATE_TOAST'; payload: { id: string; updates: Partial<ToastData> } }
  | { type: 'CLEAR_TOASTS' }
  | { type: 'CLEAR_QUEUE' }
  | { type: 'SET_POSITION'; payload: ToastPosition }
  | { type: 'SET_MAX_VISIBLE_TOASTS'; payload: number }
  | { type: 'PROCESS_QUEUE' };

interface ToastState {
  toasts: ToastData[];
  queue: ToastData[];
  position: ToastPosition;
  isProcessingQueue: boolean;
  maxVisibleToasts: number;
}

const initialState: ToastState = {
  toasts: [],
  queue: [],
  position: 'top-right',
  isProcessingQueue: false,
  maxVisibleToasts: 5,
};

function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case 'ADD_TOAST': {
      const newToast: ToastData = {
        ...action.payload,
        id: action.payload.id || generateToastId(),
        createdAt: Date.now(),
      };

      // Check for explicit ID replacement (for updates)
      if (action.payload.id) {
        const existingIndex = state.toasts.findIndex(toast => toast.id === newToast.id);
        if (existingIndex !== -1) {
          const updatedToasts = [...state.toasts];
          updatedToasts[existingIndex] = newToast;
          return {
            ...state,
            toasts: updatedToasts,
          };
        }
      }

      // Check for duplicates in both visible toasts and queue
      const allToasts = [...state.toasts, ...state.queue];
      const duplicate = checkForDuplicate(action.payload, allToasts);

      if (duplicate) {
        const strategy = action.payload.duplicateStrategy || 'ignore';

        switch (strategy) {
          case 'ignore':
            return state; // Don't add duplicate

          case 'replace': {
            // Replace the duplicate
            const updatedToasts = state.toasts.map(toast =>
              toast.id === duplicate.id ? newToast : toast
            );
            const updatedQueue = state.queue.map(toast =>
              toast.id === duplicate.id ? newToast : toast
            );
            return {
              ...state,
              toasts: updatedToasts,
              queue: updatedQueue,
            };
          }

          case 'stack':
            // Add with modified message indicating it's a duplicate
            newToast.message = `${newToast.message}`;
            break;

          case 'count': {
            // Update the duplicate count and show count in message
            const count = getDuplicateCount(action.payload, allToasts) + 1;
            newToast.message = `${newToast.message} (${count})`;
            newToast.duplicateCount = count;
            break;
          }
        }
      }

      // Check if we should queue or display immediately
      if (state.toasts.length >= state.maxVisibleToasts) {
        // Add to queue with priority sorting
        const updatedQueue = sortByPriority([...state.queue, newToast]);
        return {
          ...state,
          queue: updatedQueue,
        };
      }

      // Add to visible toasts with priority sorting
      const updatedToasts = sortByPriority([newToast, ...state.toasts]);
      return {
        ...state,
        toasts: updatedToasts,
      };
    }

    case 'REMOVE_TOAST': {
      const updatedState = {
        ...state,
        toasts: state.toasts.filter(toast => toast.id !== action.payload),
      };

      // Process queue if there's space and items in queue
      if (updatedState.queue.length > 0 && updatedState.toasts.length < state.maxVisibleToasts) {
        const nextToast = updatedState.queue[0];
        const newToasts = sortByPriority([...updatedState.toasts, nextToast]);
        return {
          ...updatedState,
          toasts: newToasts,
          queue: updatedState.queue.slice(1),
        };
      }

      return updatedState;
    }

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

    case 'CLEAR_QUEUE':
      return {
        ...state,
        queue: [],
      };

    case 'SET_POSITION':
      return {
        ...state,
        position: action.payload,
      };

    case 'SET_MAX_VISIBLE_TOASTS':
      return {
        ...state,
        maxVisibleToasts: action.payload,
      };

    case 'PROCESS_QUEUE': {
      if (state.queue.length === 0 || state.toasts.length >= state.maxVisibleToasts) {
        return state;
      }

      const nextToast = state.queue[0];
      const newToasts = sortByPriority([...state.toasts, nextToast]);
      return {
        ...state,
        toasts: newToasts,
        queue: state.queue.slice(1),
      };
    }

    default:
      return state;
  }
}

function generateToastId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function checkForDuplicate(
  newToast: CreateToastData,
  existingToasts: ToastData[]
): ToastData | null {
  if (newToast.allowDuplicates) return null;

  const checkFields = newToast.duplicateCheckFields || ['message', 'type'];

  return (
    existingToasts.find(toast =>
      checkFields.every((field: string) => {
        const newValue = newToast[field as keyof CreateToastData];
        const existingValue = toast[field as keyof ToastData];
        return newValue === existingValue;
      })
    ) || null
  );
}

function getDuplicateCount(toastData: CreateToastData, existingToasts: ToastData[]): number {
  const checkFields = toastData.duplicateCheckFields || ['message', 'type'];

  return existingToasts.filter(toast =>
    checkFields.every((field: string) => {
      const newValue = toastData[field as keyof CreateToastData];
      const existingValue = toast[field as keyof ToastData];
      return newValue === existingValue;
    })
  ).length;
}

function sortByPriority(toasts: ToastData[]): ToastData[] {
  const priorityOrder: Record<ToastPriority, number> = {
    urgent: 4,
    high: 3,
    normal: 2,
    low: 1,
  };

  return [...toasts].sort((a, b) => {
    const aPriority = priorityOrder[a.priority || 'normal'] || 2;
    const bPriority = priorityOrder[b.priority || 'normal'] || 2;

    // If priorities are the same, sort by creation time (newest first)
    if (aPriority === bPriority) {
      return b.createdAt - a.createdAt;
    }

    // Otherwise sort by priority
    return bPriority - aPriority;
  });
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
  defaultMaxVisible?: number;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  defaultPosition = 'top-right',
  defaultMaxVisible = 5,
}) => {
  const [state, dispatch] = useReducer(toastReducer, {
    ...initialState,
    position: defaultPosition,
    maxVisibleToasts: defaultMaxVisible,
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

  const clearQueue = useCallback(() => {
    dispatch({ type: 'CLEAR_QUEUE' });
  }, []);

  const setPosition = useCallback((position: ToastPosition) => {
    dispatch({ type: 'SET_POSITION', payload: position });
  }, []);

  const setMaxVisibleToasts = useCallback((max: number) => {
    dispatch({ type: 'SET_MAX_VISIBLE_TOASTS', payload: max });
  }, []);

  // Auto-process queue when toasts are removed
  useEffect(() => {
    if (state.queue.length > 0 && state.toasts.length < state.maxVisibleToasts) {
      const timer = setTimeout(() => {
        dispatch({ type: 'PROCESS_QUEUE' });
      }, 100); // Small delay for smooth transitions

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [state.toasts.length, state.queue.length, state.maxVisibleToasts]);

  const value: ToastContextValue = {
    toasts: state.toasts,
    queue: state.queue,
    addToast,
    removeToast,
    updateToast,
    clearToasts,
    clearQueue,
    position: state.position,
    setPosition,
    maxVisibleToasts: state.maxVisibleToasts,
    setMaxVisibleToasts,
  };

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};
