/**
 * Performance optimization utilities
 */

import React, { useCallback, useRef } from 'react';

/**
 * Debounce hook for performance optimization
 */
export function useDebounce<T extends unknown[]>(
  callback: (...args: T) => void,
  delay: number
): (...args: T) => void {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: T) => {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => callback(...args), delay);
    },
    [callback, delay]
  );
}

/**
 * Throttle hook for performance optimization
 */
export function useThrottle<T extends unknown[]>(
  callback: (...args: T) => void,
  delay: number
): (...args: T) => void {
  const lastRan = useRef(Date.now());

  return useCallback(
    (...args: T) => {
      if (Date.now() - lastRan.current >= delay) {
        callback(...args);
        lastRan.current = Date.now();
      }
    },
    [callback, delay]
  );
}

/**
 * Intersection Observer hook for lazy loading
 */
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): [React.RefCallback<Element>, boolean] {
  const [isIntersecting, setIsIntersecting] = React.useState(false);
  const [element, setElement] = React.useState<Element | null>(null);

  const callbackRef = React.useCallback((node: Element | null) => {
    if (node !== null) {
      setElement(node);
    }
  }, []);

  React.useEffect(() => {
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, options);

    observer.observe(element);

    return () => observer.disconnect();
  }, [element, options]);

  return [callbackRef, isIntersecting];
}

/**
 * Memory-efficient list virtualization
 */
export interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
}

export function useVirtualizedList<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 5,
}: Omit<VirtualizedListProps<T>, 'renderItem'>) {
  const [scrollTop, setScrollTop] = React.useState(0);

  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(visibleStart + Math.ceil(containerHeight / itemHeight), items.length);

  const startIndex = Math.max(0, visibleStart - overscan);
  const endIndex = Math.min(items.length, visibleEnd + overscan);

  const visibleItems = items.slice(startIndex, endIndex).map((item, index) => ({
    item,
    index: startIndex + index,
  }));

  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return {
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll,
  };
}

/**
 * Preload image utility
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Lazy load images with intersection observer
 */
export function useLazyImage(
  src: string,
  placeholder?: string
): {
  imgRef: React.RefCallback<Element>;
  src: string;
  isLoaded: boolean;
} {
  const [imgRef, isIntersecting] = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: '50px',
  });
  const [currentSrc, setCurrentSrc] = React.useState(placeholder || '');
  const [isLoaded, setIsLoaded] = React.useState(false);

  React.useEffect(() => {
    if (isIntersecting && src && currentSrc !== src) {
      const img = new Image();
      img.onload = () => {
        setCurrentSrc(src);
        setIsLoaded(true);
      };
      img.src = src;
    }
  }, [isIntersecting, src, currentSrc]);

  return { imgRef, src: currentSrc, isLoaded };
}

/**
 * Request Animation Frame hook for smooth animations
 */
export function useAnimationFrame(callback: (time: number) => void, deps: React.DependencyList) {
  const requestRef = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    const animate = (time: number) => {
      callback(time);
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, deps);
}

/**
 * Optimize re-renders by memoizing stable callback references
 */
export function useStableCallback<T extends unknown[]>(
  callback: (...args: T) => void
): (...args: T) => void {
  const callbackRef = React.useRef<(...args: T) => void>(callback);
  callbackRef.current = callback;

  return React.useCallback((...args: T) => {
    callbackRef.current(...args);
  }, []);
}
