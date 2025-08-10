import { useEffect, useRef } from 'react';

export function usePerformanceMonitor(componentName: string) {
  const renderStartTime = useRef<number>(performance.now());
  const mountTime = useRef<number | null>(null);

  // Mark render start - only run once per component mount
  useEffect(() => {
    renderStartTime.current = performance.now();

    if (window.performance && window.performance.mark) {
      window.performance.mark(`${componentName}-mount-start`);
    }
  }, []); // Empty dependency array to run only once

  useEffect(() => {
    // Component mounted
    mountTime.current = performance.now();
    const mountDuration = mountTime.current - renderStartTime.current;

    // Only log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 ${componentName} mount time: ${mountDuration.toFixed(2)}ms`);
    }

    // Report to analytics service if available
    if (window.performance && window.performance.mark) {
      window.performance.mark(`${componentName}-mount-end`);

      if (window.performance.measure) {
        try {
          window.performance.measure(
            `${componentName}-mount`,
            `${componentName}-mount-start`,
            `${componentName}-mount-end`
          );
        } catch {
          // Mark might not exist, just log in development
          if (process.env.NODE_ENV === 'development') {
            console.warn(`Performance mark ${componentName}-mount-start not found`);
          }
        }
      }
    }

    return () => {
      // Component unmounted
      const unmountTime = performance.now();
      const lifetimeDuration = unmountTime - (mountTime.current || renderStartTime.current);

      if (process.env.NODE_ENV === 'development') {
        console.log(`🔍 ${componentName} lifetime: ${lifetimeDuration.toFixed(2)}ms`);
      }
    };
  }, [componentName]);
}

export function useRenderCount(componentName: string) {
  const renderCount = useRef(0);

  useEffect(() => {
    renderCount.current += 1;

    if (process.env.NODE_ENV === 'development') {
      console.log(`🔄 ${componentName} render count: ${renderCount.current}`);
    }
  });

  return renderCount.current;
}

// Custom hook for measuring specific operations
export function useOperationTimer() {
  const timers = useRef<Map<string, number>>(new Map());

  const startTimer = (operationName: string) => {
    timers.current.set(operationName, performance.now());
  };

  const endTimer = (operationName: string) => {
    const startTime = timers.current.get(operationName);
    if (startTime) {
      const duration = performance.now() - startTime;
      timers.current.delete(operationName);

      if (process.env.NODE_ENV === 'development') {
        console.log(`⏱️ ${operationName}: ${duration.toFixed(2)}ms`);
      }

      return duration;
    }
    return null;
  };

  return { startTimer, endTimer };
}
