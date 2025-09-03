import React from 'react';
import { ToastProvider, useToast } from '@/components/ui/Toast/ToastContext';
import { ToastContainer } from '@/components/ui/Toast/ToastContainer';
import { ToastPosition } from '@/components/ui/Toast/types';
import '@/components/ui/Toast/toast.css';

interface ToastManagerProps {
  children: React.ReactNode;
  position?: ToastPosition;
  maxToasts?: number;
  gap?: number;
  offset?: number;
}

const ToastRenderer: React.FC<{
  gap?: number;
  offset?: number;
}> = ({ gap, offset }) => {
  const { toasts, position, removeToast } = useToast();

  return (
    <ToastContainer
      toasts={toasts}
      position={position}
      onRemove={removeToast}
      gap={gap}
      offset={offset}
    />
  );
};

export const ToastManager: React.FC<ToastManagerProps> = ({
  children,
  position = 'top-right',
  maxToasts = 5,
  gap = 12,
  offset = 16,
}) => {
  return (
    <ToastProvider defaultPosition={position} defaultMaxVisible={maxToasts}>
      {children}
      <ToastRenderer gap={gap} offset={offset} />
    </ToastProvider>
  );
};
