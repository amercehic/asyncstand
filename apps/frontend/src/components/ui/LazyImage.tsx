import React from 'react';
import { useLazyImage } from '@/utils/performance';
import { cn } from '@/lib/utils';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  placeholder?: string;
  className?: string;
  fallback?: React.ReactNode;
}

/**
 * LazyImage component with intersection observer optimization
 */
export const LazyImage = React.memo<LazyImageProps>(
  ({
    src,
    alt,
    placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkxvYWRpbmcuLi48L3RleHQ+PC9zdmc+',
    className,
    fallback,
    ...props
  }) => {
    const { imgRef, src: currentSrc, isLoaded } = useLazyImage(src, placeholder);

    if (!currentSrc && fallback) {
      return <>{fallback}</>;
    }

    return (
      <div ref={imgRef} className={cn('relative overflow-hidden', className)}>
        <img
          src={currentSrc}
          alt={alt}
          className={cn(
            'transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-60',
            className
          )}
          {...props}
        />
        {!isLoaded && <div className="absolute inset-0 bg-muted animate-pulse rounded" />}
      </div>
    );
  }
);

LazyImage.displayName = 'LazyImage';
