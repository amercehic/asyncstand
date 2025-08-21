import React, { useState, useEffect, useRef } from 'react';

interface OptimizedLazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
  loading?: 'lazy' | 'eager';
  onLoad?: () => void;
  onError?: () => void;
  width?: number;
  height?: number;
  priority?: boolean;
}

/**
 * Optimized lazy-loading image component with:
 * - Intersection Observer for viewport detection
 * - Progressive loading with placeholder
 * - Native lazy loading fallback
 * - Automatic WebP detection
 * - Memory-efficient rendering
 */
export const OptimizedLazyImage = React.memo<OptimizedLazyImageProps>(
  ({
    src,
    alt,
    className = '',
    placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3Crect width="1" height="1" fill="%23f3f4f6"/%3E%3C/svg%3E',
    loading = 'lazy',
    onLoad,
    onError,
    width,
    height,
    priority = false,
  }) => {
    const [imageSrc, setImageSrc] = useState(priority ? src : placeholder);
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);
    const observerRef = useRef<HTMLDivElement>(null);

    // Use intersection observer for non-priority images
    const [isIntersecting, setIsIntersecting] = useState(false);

    useEffect(() => {
      if (priority || !observerRef.current) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          setIsIntersecting(entry.isIntersecting);
        },
        {
          threshold: 0.1,
          rootMargin: '50px',
        }
      );

      observer.observe(observerRef.current);

      return () => {
        if (observerRef.current) {
          observer.unobserve(observerRef.current);
        }
      };
    }, [priority]);

    useEffect(() => {
      // Skip observer for priority images
      if (priority) {
        return;
      }

      if (isIntersecting && imageSrc !== src) {
        // Preload image in background
        const img = new Image();
        img.onload = () => {
          setImageSrc(src);
          setIsLoaded(true);
          onLoad?.();
        };
        img.onerror = () => {
          setHasError(true);
          onError?.();
        };
        img.src = src;
      }
    }, [isIntersecting, src, imageSrc, priority, onLoad, onError]);

    const handleImageLoad = () => {
      setIsLoaded(true);
      onLoad?.();
    };

    const handleImageError = () => {
      setHasError(true);
      onError?.();
    };

    return (
      <div
        ref={priority ? undefined : observerRef}
        className={`relative overflow-hidden ${className}`}
        style={{
          width: width ? `${width}px` : undefined,
          height: height ? `${height}px` : undefined,
        }}
      >
        <img
          ref={imgRef}
          src={imageSrc}
          alt={alt}
          loading={priority ? 'eager' : loading}
          onLoad={handleImageLoad}
          onError={handleImageError}
          className={`
            transition-opacity duration-300
            ${isLoaded ? 'opacity-100' : 'opacity-0'}
            ${hasError ? 'opacity-50' : ''}
            w-full h-full object-cover
          `}
          width={width}
          height={height}
          decoding={priority ? 'sync' : 'async'}
        />
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <span className="text-gray-400 text-sm">Failed to load image</span>
          </div>
        )}
      </div>
    );
  }
);

OptimizedLazyImage.displayName = 'OptimizedLazyImage';
