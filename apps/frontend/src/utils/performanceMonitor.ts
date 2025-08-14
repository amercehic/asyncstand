/**
 * Performance monitoring and metrics collection
 */

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private observers: PerformanceObserver[] = [];

  constructor() {
    this.setupObservers();
    this.measureCoreWebVitals();
  }

  private setupObservers() {
    if (typeof window === 'undefined') return;

    // Long Task Observer (for detecting blocking JS)
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver(list => {
          list.getEntries().forEach(entry => {
            this.recordMetric('long-task', entry.duration);

            if (entry.duration > 100) {
              console.warn(`Long task detected: ${entry.duration}ms`);
            }
          });
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.push(longTaskObserver);
      } catch {
        // Long tasks not supported
      }

      // Layout Shift Observer
      try {
        const layoutShiftObserver = new PerformanceObserver(list => {
          list.getEntries().forEach((entry: PerformanceEntry & { value?: number }) => {
            if (entry.value && entry.value > 0.1) {
              this.recordMetric('layout-shift', entry.value);
            }
          });
        });
        layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(layoutShiftObserver);
      } catch {
        // Layout shift not supported
      }
    }
  }

  private measureCoreWebVitals() {
    if (typeof window === 'undefined') return;

    // Largest Contentful Paint (LCP)
    const measureLCP = () => {
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver(list => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.recordMetric('lcp', lastEntry.startTime);
        });

        try {
          observer.observe({ entryTypes: ['largest-contentful-paint'] });
          this.observers.push(observer);
        } catch {
          // LCP not supported
        }
      }
    };

    // First Input Delay (FID)
    const measureFID = () => {
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver(list => {
          list.getEntries().forEach((entry: PerformanceEntry & { processingStart?: number }) => {
            if (entry.processingStart) {
              this.recordMetric('fid', entry.processingStart - entry.startTime);
            }
          });
        });

        try {
          observer.observe({ entryTypes: ['first-input'] });
          this.observers.push(observer);
        } catch {
          // FID not supported
        }
      }
    };

    // Cumulative Layout Shift (CLS)
    const measureCLS = () => {
      let cls = 0;
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver(list => {
          list
            .getEntries()
            .forEach((entry: PerformanceEntry & { value?: number; hadRecentInput?: boolean }) => {
              if (!entry.hadRecentInput && entry.value) {
                cls += entry.value;
                this.recordMetric('cls', cls);
              }
            });
        });

        try {
          observer.observe({ entryTypes: ['layout-shift'] });
          this.observers.push(observer);
        } catch {
          // CLS not supported
        }
      }
    };

    measureLCP();
    measureFID();
    measureCLS();
  }

  recordMetric(name: string, value: number) {
    this.metrics.push({
      name,
      value,
      timestamp: Date.now(),
    });

    // Keep only last 100 metrics to prevent memory leaks
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }
  }

  getMetrics(name?: string): PerformanceMetric[] {
    if (name) {
      return this.metrics.filter(metric => metric.name === name);
    }
    return [...this.metrics];
  }

  getAverageMetric(name: string): number {
    const metrics = this.getMetrics(name);
    if (metrics.length === 0) return 0;

    const sum = metrics.reduce((acc, metric) => acc + metric.value, 0);
    return sum / metrics.length;
  }

  measureFunction<T extends (...args: unknown[]) => unknown>(name: string, fn: T): T {
    return ((...args: Parameters<T>) => {
      const start = performance.now();
      const result = fn(...args);
      const end = performance.now();

      this.recordMetric(name, end - start);

      return result;
    }) as T;
  }

  measureAsync<T extends (...args: unknown[]) => Promise<unknown>>(name: string, fn: T): T {
    return (async (...args: Parameters<T>) => {
      const start = performance.now();
      try {
        const result = await fn(...args);
        const end = performance.now();
        this.recordMetric(name, end - start);
        return result;
      } catch (error) {
        const end = performance.now();
        this.recordMetric(`${name}-error`, end - start);
        throw error;
      }
    }) as T;
  }

  getReport(): {
    coreWebVitals: Record<string, number>;
    customMetrics: Record<string, number>;
    recommendations: string[];
  } {
    const lcp = this.getAverageMetric('lcp');
    const fid = this.getAverageMetric('fid');
    const cls = this.getAverageMetric('cls');
    const longTasks = this.getMetrics('long-task').length;
    const layoutShifts = this.getMetrics('layout-shift').length;

    const recommendations: string[] = [];

    if (lcp > 2500) recommendations.push('Improve LCP: Optimize images and critical resources');
    if (fid > 100) recommendations.push('Improve FID: Reduce JavaScript execution time');
    if (cls > 0.1) recommendations.push('Improve CLS: Ensure elements have defined dimensions');
    if (longTasks > 5) recommendations.push('Reduce long tasks: Break up JavaScript execution');
    if (layoutShifts > 10) recommendations.push('Minimize layout shifts: Pre-size elements');

    return {
      coreWebVitals: { lcp, fid, cls },
      customMetrics: {
        longTasks,
        layoutShifts,
        averageApiCall: this.getAverageMetric('api-call'),
        averageRender: this.getAverageMetric('render'),
      },
      recommendations,
    };
  }

  startResourceTiming() {
    if (typeof window === 'undefined') return;

    // Monitor resource loading
    window.addEventListener('load', () => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

      resources.forEach(resource => {
        const duration = resource.responseEnd - resource.startTime;
        this.recordMetric(`resource-${resource.initiatorType}`, duration);

        if (duration > 1000) {
          console.warn(`Slow resource: ${resource.name} took ${duration}ms`);
        }
      });
    });
  }

  cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.metrics = [];
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for performance monitoring
export function usePerformanceMonitor() {
  return {
    recordMetric: performanceMonitor.recordMetric.bind(performanceMonitor),
    measureFunction: performanceMonitor.measureFunction.bind(performanceMonitor),
    measureAsync: performanceMonitor.measureAsync.bind(performanceMonitor),
    getReport: performanceMonitor.getReport.bind(performanceMonitor),
  };
}

// Development-only performance debugging
if (process.env.NODE_ENV === 'development') {
  // Log performance report every 30 seconds
  setInterval(() => {
    const report = performanceMonitor.getReport();
    if (report.recommendations.length > 0) {
      console.group('🚀 Performance Recommendations');
      report.recommendations.forEach(rec => console.warn(rec));
      console.groupEnd();
    }
  }, 30000);

  // Expose to global for debugging
  (window as typeof window & { performanceMonitor: typeof performanceMonitor }).performanceMonitor =
    performanceMonitor;
}
