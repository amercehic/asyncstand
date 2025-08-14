import { useCallback, useRef, useEffect } from 'react';
import { useThrottle } from '@/utils/performance';

/**
 * Optimized animation hook that uses RAF and reduces layout thrashing
 */
export function useOptimizedAnimation() {
  const animationRef = useRef<number | undefined>(undefined);
  const isRunningRef = useRef(false);

  const startAnimation = useCallback((callback: (progress: number) => void, duration: number) => {
    if (isRunningRef.current) return;

    isRunningRef.current = true;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      callback(progress);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        isRunningRef.current = false;
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, []);

  const stopAnimation = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      isRunningRef.current = false;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return { startAnimation, stopAnimation };
}

/**
 * Optimized scroll handler with throttling
 */
export function useOptimizedScroll(callback: (scrollY: number) => void, throttleMs: number = 16) {
  const throttledCallback = useThrottle(callback, throttleMs);

  useEffect(() => {
    const handleScroll = () => {
      throttledCallback(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [throttledCallback]);
}

/**
 * Optimized resize handler with throttling
 */
export function useOptimizedResize(
  callback: (width: number, height: number) => void,
  throttleMs: number = 100
) {
  const throttledCallback = useThrottle(callback, throttleMs);

  useEffect(() => {
    const handleResize = () => {
      throttledCallback(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, [throttledCallback]);
}

/**
 * Will-change optimization hook for better GPU acceleration
 */
export function useWillChange(element: HTMLElement | null, properties: string[]) {
  useEffect(() => {
    if (!element) return;

    element.style.willChange = properties.join(', ');

    return () => {
      element.style.willChange = 'auto';
    };
  }, [element, properties]);
}
