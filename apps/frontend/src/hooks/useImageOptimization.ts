import { useState, useEffect, useCallback } from 'react';

interface UseImageOptimizationOptions {
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
  loading?: 'lazy' | 'eager';
  sizes?: string;
  placeholder?: string;
  blur?: boolean;
}

interface OptimizedImageData {
  src: string;
  srcSet?: string;
  sizes?: string;
  placeholder?: string;
  isLoading: boolean;
  error: Error | null;
}

export function useImageOptimization(
  originalSrc: string,
  options: UseImageOptimizationOptions = {}
): OptimizedImageData {
  const { quality = 80, format = 'webp', loading = 'lazy', sizes, placeholder } = options;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [optimizedSrc, setOptimizedSrc] = useState(placeholder || '');
  const [srcSet, setSrcSet] = useState<string | undefined>();

  // Generate optimized image URLs (this would typically use a service like Cloudinary, Vercel, etc.)
  const generateOptimizedUrl = useCallback(
    (src: string) => {
      // This is a placeholder - in a real app, you'd use an image optimization service
      // For now, just return the original src
      return src;
    },
    [quality, format]
  );

  // Generate responsive srcSet
  const generateSrcSet = useCallback(
    (src: string) => {
      const widths = [320, 640, 768, 1024, 1280, 1536];
      return widths.map(width => `${generateOptimizedUrl(src, width)} ${width}w`).join(', ');
    },
    [generateOptimizedUrl]
  );

  // Preload image
  const preloadImage = useCallback((src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      img.src = src;
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadImage = async () => {
      if (!originalSrc) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Generate optimized URLs
        const optimized = generateOptimizedUrl(originalSrc);
        const responsiveSrcSet = generateSrcSet(originalSrc);

        // Preload the image
        if (loading === 'eager') {
          await preloadImage(optimized);
        }

        if (isMounted) {
          setOptimizedSrc(optimized);
          setSrcSet(responsiveSrcSet);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err as Error);
          setIsLoading(false);
        }
      }
    };

    loadImage();

    return () => {
      isMounted = false;
    };
  }, [originalSrc, loading, generateOptimizedUrl, generateSrcSet, preloadImage]);

  return {
    src: optimizedSrc || originalSrc,
    srcSet,
    sizes,
    placeholder,
    isLoading,
    error,
  };
}

// Hook for creating blur placeholders
export function useBlurDataURL(src: string): string | null {
  const [blurDataURL, setBlurDataURL] = useState<string | null>(null);

  useEffect(() => {
    if (!src) return;

    // Create a tiny version for blur placeholder
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    canvas.width = 10;
    canvas.height = 10;

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      ctx.drawImage(img, 0, 0, 10, 10);
      const dataURL = canvas.toDataURL('image/jpeg', 0.1);
      setBlurDataURL(dataURL);
    };

    img.onerror = () => {
      // Fallback to a simple gray blur
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, 10, 10);
      const dataURL = canvas.toDataURL('image/jpeg', 0.1);
      setBlurDataURL(dataURL);
    };

    img.src = src;
  }, [src]);

  return blurDataURL;
}
