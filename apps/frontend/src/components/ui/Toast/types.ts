export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading' | 'custom';

export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface ToastAction {
  label: string;
  onClick: () => void;
  className?: string;
}

export interface RichContent {
  title: string;
  description?: string;
  avatar?: string;
  metadata?: string;
  component?: React.ComponentType<unknown>;
}

export interface ToastData {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  description?: string;
  icon?: React.ReactNode;
  duration?: number;
  persistent?: boolean;
  dismissible?: boolean;
  position?: ToastPosition;
  action?: ToastAction;
  richContent?: RichContent;
  progress?: number;
  className?: string;
  createdAt: number;
  promise?: {
    loading: string;
    success: string | ((data: unknown) => string);
    error: string | ((error: Error) => string);
  };
  render?: (toast: ToastData) => React.ReactElement;
}

export interface ToastOptions {
  id?: string;
  duration?: number;
  position?: ToastPosition;
  persistent?: boolean;
  dismissible?: boolean;
  icon?: React.ReactNode;
  action?: ToastAction;
  richContent?: RichContent;
  progress?: number;
  className?: string;
  description?: string;
}

export interface ToastManagerState {
  toasts: ToastData[];
  position: ToastPosition;
}

export interface CreateToastData extends Omit<ToastData, 'id' | 'createdAt'> {
  id?: string;
}

export interface ToastContextValue {
  toasts: ToastData[];
  addToast: (toast: CreateToastData) => string;
  removeToast: (id: string) => void;
  updateToast: (id: string, updates: Partial<ToastData>) => void;
  clearToasts: () => void;
  position: ToastPosition;
  setPosition: (position: ToastPosition) => void;
}
