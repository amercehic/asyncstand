import React, { useState } from 'react';
import { cn } from '@/components/ui/utils';

interface FeatureToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  loading?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

export const FeatureToggle: React.FC<FeatureToggleProps> = ({
  enabled,
  onToggle,
  loading = false,
  disabled = false,
  size = 'md',
  className,
  label,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleToggle = async () => {
    if (disabled || loading) return;

    setIsAnimating(true);
    try {
      await onToggle(!enabled);
    } finally {
      setTimeout(() => setIsAnimating(false), 300);
    }
  };

  const sizes = {
    sm: {
      switch: 'h-5 w-9',
      thumb: 'h-4 w-4',
      translate: 'translate-x-4',
    },
    md: {
      switch: 'h-6 w-11',
      thumb: 'h-5 w-5',
      translate: 'translate-x-5',
    },
    lg: {
      switch: 'h-7 w-12',
      thumb: 'h-6 w-6',
      translate: 'translate-x-5',
    },
  };

  const currentSize = sizes[size];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {label && <span className="text-sm font-medium text-foreground">{label}</span>}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled || loading}
        className={cn(
          'relative inline-flex shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          currentSize.switch,
          enabled ? 'bg-gradient-to-r from-[#6366F1] to-[#8B5CF6]' : 'bg-gray-200 dark:bg-gray-700'
        )}
        role="switch"
        aria-checked={enabled}
        aria-label={label || 'Toggle feature'}
      >
        <span className="sr-only">{label || 'Toggle feature'}</span>
        <span
          className={cn(
            'pointer-events-none relative inline-block rounded-full bg-white shadow-lg transform ring-0 transition-all duration-200 ease-in-out',
            currentSize.thumb,
            enabled ? currentSize.translate : 'translate-x-0',
            (loading || isAnimating) && 'animate-pulse'
          )}
        >
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-primary"></div>
            </div>
          )}
        </span>
      </button>
    </div>
  );
};

export default FeatureToggle;
