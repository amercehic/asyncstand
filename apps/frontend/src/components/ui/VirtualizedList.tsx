import React from 'react';
import { useVirtualizedList } from '@/utils/performance';
import { cn } from '@/lib/utils';

interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  overscan?: number;
}

/**
 * High-performance virtualized list component for large datasets
 */
export function VirtualizedList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  className,
  overscan = 5,
}: VirtualizedListProps<T>) {
  const { visibleItems, totalHeight, offsetY, handleScroll } = useVirtualizedList({
    items,
    itemHeight,
    containerHeight,
    overscan,
  });

  return (
    <div
      className={cn('overflow-auto', className)}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map(({ item, index }) => (
            <div key={index} style={{ height: itemHeight }}>
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Memoized virtual list item wrapper to prevent unnecessary re-renders
 */
export const VirtualListItem = React.memo<{
  children: React.ReactNode;
  height: number;
}>(({ children, height }) => (
  <div style={{ height }} className="flex-shrink-0">
    {children}
  </div>
));

VirtualListItem.displayName = 'VirtualListItem';
