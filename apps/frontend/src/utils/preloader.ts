/**
 * Resource preloading utilities for improved performance
 */

interface PreloadOptions {
  priority?: 'high' | 'low';
  crossOrigin?: 'anonymous' | 'use-credentials';
}

/**
 * Preload critical resources
 */
export class ResourcePreloader {
  private preloadedResources = new Set<string>();

  /**
   * Preload CSS files
   */
  preloadCSS(href: string, options: PreloadOptions = {}) {
    if (this.preloadedResources.has(href)) return;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'style';
    link.href = href;
    if (options.crossOrigin) {
      link.crossOrigin = options.crossOrigin;
    }

    link.onload = () => {
      // Convert preload to actual stylesheet
      link.rel = 'stylesheet';
    };

    document.head.appendChild(link);
    this.preloadedResources.add(href);
  }

  /**
   * Preload JavaScript modules
   */
  preloadJS(src: string, options: PreloadOptions = {}) {
    if (this.preloadedResources.has(src)) return;

    const link = document.createElement('link');
    link.rel = 'modulepreload';
    link.href = src;
    if (options.crossOrigin) {
      link.crossOrigin = options.crossOrigin;
    }

    document.head.appendChild(link);
    this.preloadedResources.add(src);
  }

  /**
   * Preload images
   */
  preloadImage(src: string, options: PreloadOptions = {}): Promise<void> {
    if (this.preloadedResources.has(src)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = src;
      if (options.crossOrigin) {
        link.crossOrigin = options.crossOrigin;
      }

      link.onload = () => {
        this.preloadedResources.add(src);
        resolve();
      };
      link.onerror = reject;

      document.head.appendChild(link);
    });
  }

  /**
   * Preload fonts
   */
  preloadFont(href: string) {
    if (this.preloadedResources.has(href)) return;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'font';
    link.type = 'font/woff2';
    link.href = href;
    link.crossOrigin = 'anonymous'; // Fonts require CORS

    document.head.appendChild(link);
    this.preloadedResources.add(href);
  }

  /**
   * DNS prefetch for external domains
   */
  dnsPrefetch(domain: string) {
    if (this.preloadedResources.has(`dns:${domain}`)) return;

    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = domain;

    document.head.appendChild(link);
    this.preloadedResources.add(`dns:${domain}`);
  }

  /**
   * Preconnect to external origins
   */
  preconnect(origin: string, crossOrigin = false) {
    if (this.preloadedResources.has(`preconnect:${origin}`)) return;

    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    if (crossOrigin) {
      link.crossOrigin = 'anonymous';
    }

    document.head.appendChild(link);
    this.preloadedResources.add(`preconnect:${origin}`);
  }
}

export const resourcePreloader = new ResourcePreloader();

/**
 * Route-based preloading strategy
 */
export function setupRoutePreloading() {
  // Preload critical routes when idle
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      // Preload likely next pages
      const criticalRoutes = ['/dashboard', '/teams', '/integrations'];
      criticalRoutes.forEach(route => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = route;
        document.head.appendChild(link);
      });
    });
  }
}

/**
 * Progressive loading strategy
 */
export class ProgressiveLoader {
  private observer?: IntersectionObserver;

  constructor() {
    if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
      this.observer = new IntersectionObserver(this.handleIntersection.bind(this), {
        rootMargin: '50px', // Start loading 50px before element is visible
        threshold: 0.1,
      });
    }
  }

  private handleIntersection(entries: IntersectionObserverEntry[]) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const element = entry.target;
        const src = element.getAttribute('data-src');
        const srcset = element.getAttribute('data-srcset');

        if (src && element instanceof HTMLImageElement) {
          element.src = src;
          element.removeAttribute('data-src');
        }

        if (srcset && element instanceof HTMLImageElement) {
          element.srcset = srcset;
          element.removeAttribute('data-srcset');
        }

        // Trigger custom load event
        const loadEvent = element.getAttribute('data-onload');
        if (loadEvent) {
          try {
            new Function(loadEvent)();
          } catch (error) {
            console.warn('Error executing progressive load callback:', error);
          }
        }

        this.observer?.unobserve(element);
      }
    });
  }

  observe(element: Element) {
    this.observer?.observe(element);
  }

  unobserve(element: Element) {
    this.observer?.unobserve(element);
  }

  disconnect() {
    this.observer?.disconnect();
  }
}

export const progressiveLoader = new ProgressiveLoader();

/**
 * Critical path optimization
 */
export function optimizeCriticalPath() {
  // Inline critical CSS
  const criticalCSS = `
    /* Critical above-the-fold styles */
    body { margin: 0; padding: 0; font-family: system-ui, sans-serif; }
    .loading-spinner { 
      border: 2px solid #f3f3f3;
      border-top: 2px solid #3498db;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;

  const style = document.createElement('style');
  style.textContent = criticalCSS;
  document.head.appendChild(style);

  // Preconnect to API endpoints
  resourcePreloader.preconnect(import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001');

  // DNS prefetch for CDN domains
  resourcePreloader.dnsPrefetch('//fonts.googleapis.com');
  resourcePreloader.dnsPrefetch('//fonts.gstatic.com');
}
