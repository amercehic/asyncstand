import { useCallback, useMemo } from 'react';
import type { Transition } from 'framer-motion';

/**
 * Reduced motion detection hook
 */
function useReducedMotionDetection() {
  return useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );
}

/**
 * Optimized animation configuration hook
 * Provides GPU-accelerated animations with reduced motion support
 */
export function useOptimizedMotion() {
  const prefersReducedMotion = useReducedMotionDetection();

  const getTransition = useCallback(
    (type: 'smooth' | 'fast' | 'spring' = 'smooth'): Transition => {
      if (prefersReducedMotion) {
        return { duration: 0.01 };
      }

      switch (type) {
        case 'fast':
          return {
            type: 'tween',
            ease: 'easeOut',
            duration: 0.15,
          };
        case 'spring':
          return {
            type: 'spring',
            stiffness: 300,
            damping: 30,
            mass: 1,
          };
        default:
          return {
            type: 'tween',
            ease: 'easeOut',
            duration: 0.3,
          };
      }
    },
    [prefersReducedMotion]
  );

  const variants = useMemo(
    () => ({
      fadeIn: {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      },
      slideUp: {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 20 },
      },
      scale: {
        initial: { opacity: 0, scale: 0.95 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.95 },
      },
    }),
    []
  );

  return {
    getTransition,
    variants,
    prefersReducedMotion,
  };
}
