import React from 'react';
import { ToastManager } from '@/components/ui/Toast/ToastManager';
import { useToastManager } from '@/components/ui/Toast/useToastManager';
import { ToastPosition } from '@/components/ui/Toast/types';

interface ModernToasterProps {
  position?: ToastPosition;
  expand?: boolean;
  richColors?: boolean;
  closeButton?: boolean;
  icons?: {
    success?: React.ReactNode;
    error?: React.ReactNode;
    warning?: React.ReactNode;
    info?: React.ReactNode;
  };
  toastOptions?: {
    duration?: number;
  };
  maxToasts?: number;
  gap?: number;
  offset?: number;
  children?: React.ReactNode;
}

const ToasterInitializer: React.FC = () => {
  useToastManager();
  return null;
};

export const ModernToaster: React.FC<ModernToasterProps> = ({
  position = 'top-right',
  maxToasts = 5,
  gap = 12,
  offset = 16,
  children,
}) => {
  return (
    <ToastManager position={position} maxToasts={maxToasts} gap={gap} offset={offset}>
      <ToasterInitializer />
      {children}
    </ToastManager>
  );
};

export const Toaster = ModernToaster;
