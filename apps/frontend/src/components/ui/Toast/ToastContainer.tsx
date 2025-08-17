import React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/components/ui/utils';
import { ToastComponent } from '@/components/ui/Toast/ToastItem';
import { ToastData, ToastPosition } from '@/components/ui/Toast/types';

interface ToastContainerProps {
  toasts: ToastData[];
  position?: ToastPosition;
  onRemove: (id: string) => void;
  maxToasts?: number;
  gap?: number;
  offset?: number;
}

const positionStyles: Record<ToastPosition, string> = {
  'top-left': 'top-4 left-4 items-start',
  'top-center': 'top-4 left-1/2 -translate-x-1/2 items-center',
  'top-right': 'top-4 right-4 items-end',
  'bottom-left': 'bottom-4 left-4 items-start',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 items-center',
  'bottom-right': 'bottom-4 right-4 items-end',
};

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  position = 'top-right',
  onRemove,
  maxToasts = 5,
  gap = 12,
  offset = 16,
}) => {
  const visibleToasts = toasts.slice(0, maxToasts);

  if (visibleToasts.length === 0) {
    return null;
  }

  const container = (
    <div
      className={cn('fixed z-50 flex flex-col pointer-events-none', positionStyles[position])}
      style={{
        gap: `${gap}px`,
        padding: `${offset}px`,
      }}
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      data-toast-position={position}
    >
      {visibleToasts.map((toast, index) => (
        <div
          key={toast.id}
          className="pointer-events-auto"
          style={{
            zIndex: index + 1,
          }}
        >
          <ToastComponent toast={toast} onRemove={onRemove} />
        </div>
      ))}
    </div>
  );

  return createPortal(container, document.body);
};
