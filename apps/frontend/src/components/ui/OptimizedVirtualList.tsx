import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number | ((index: number) => number);
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
  className?: string;
  onScroll?: (scrollTop: number) => void;
  getItemKey?: (item: T, index: number) => string | number;
}

/**
 * High-performance virtualized list component
 * Renders only visible items to minimize DOM nodes and improve performance
 */
export function OptimizedVirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 3,
  className = '',
  onScroll,
  getItemKey,
}: VirtualListProps<T>) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Calculate item heights and positions
  const { itemPositions, totalHeight } = useMemo(() => {
    const positions: number[] = [];
    let currentTop = 0;

    for (let i = 0; i < items.length; i++) {
      positions.push(currentTop);
      const height = typeof itemHeight === 'function' ? itemHeight(i) : itemHeight;
      currentTop += height;
    }

    return {
      itemPositions: positions,
      totalHeight: currentTop,
    };
  }, [items, itemHeight]);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const getItemHeight = (index: number) =>
      typeof itemHeight === 'function' ? itemHeight(index) : itemHeight;

    // Find first visible item
    let startIndex = 0;
    for (let i = 0; i < itemPositions.length; i++) {
      if (itemPositions[i] + getItemHeight(i) > scrollTop) {
        startIndex = Math.max(0, i - overscan);
        break;
      }
    }

    // Find last visible item
    let endIndex = startIndex;
    const viewportBottom = scrollTop + containerHeight;
    for (let i = startIndex; i < items.length; i++) {
      if (itemPositions[i] > viewportBottom) {
        endIndex = Math.min(items.length, i + overscan);
        break;
      }
      endIndex = i + 1;
    }

    return { startIndex, endIndex };
  }, [scrollTop, containerHeight, itemPositions, items.length, overscan, itemHeight]);

  // Handle scroll with debouncing
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const newScrollTop = e.currentTarget.scrollTop;
      setScrollTop(newScrollTop);
      setIsScrolling(true);

      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Set scrolling to false after scroll ends
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 150);

      onScroll?.(newScrollTop);
    },
    [onScroll]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Generate visible items
  const visibleItems = useMemo(() => {
    const { startIndex, endIndex } = visibleRange;
    const visible = [];

    for (let i = startIndex; i < endIndex; i++) {
      const item = items[i];
      const key = getItemKey ? getItemKey(item, i) : i;
      const height = typeof itemHeight === 'function' ? itemHeight(i) : itemHeight;

      visible.push({
        key,
        item,
        index: i,
        style: {
          position: 'absolute' as const,
          top: itemPositions[i],
          left: 0,
          right: 0,
          height,
          // Optimize rendering during scroll
          willChange: isScrolling ? 'transform' : 'auto',
          contain: 'layout style paint',
        },
      });
    }

    return visible;
  }, [visibleRange, items, itemHeight, itemPositions, getItemKey, isScrolling]);

  return (
    <div
      ref={scrollContainerRef}
      className={`relative overflow-auto ${className}`}
      style={{
        height: containerHeight,
        willChange: 'scroll-position',
      }}
      onScroll={handleScroll}
    >
      {/* Total height container for scrollbar */}
      <div
        style={{
          height: totalHeight,
          position: 'relative',
        }}
      >
        {/* Render only visible items */}
        {visibleItems.map(({ key, item, index, style }) => (
          <div key={key} style={style}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Hook for dynamic virtual list with variable item heights
 */
export function useDynamicVirtualList<T>(
  items: T[],
  containerRef: React.RefObject<HTMLElement>,
  estimatedItemHeight: number = 50
) {
  const [measurements, setMeasurements] = useState<Map<number, number>>(new Map());
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Observe container size
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(containerRef.current);
    setContainerHeight(containerRef.current.clientHeight);

    return () => resizeObserver.disconnect();
  }, [containerRef]);

  // Handle scroll
  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
    }
  }, [containerRef]);

  // Measure item height
  const measureItem = useCallback((index: number, height: number) => {
    setMeasurements(prev => {
      const next = new Map(prev);
      next.set(index, height);
      return next;
    });
  }, []);

  // Calculate positions and visible range
  const { visibleRange, itemPositions, totalHeight } = useMemo(() => {
    let currentTop = 0;
    const positions: number[] = [];

    for (let i = 0; i < items.length; i++) {
      positions.push(currentTop);
      const height = measurements.get(i) || estimatedItemHeight;
      currentTop += height;
    }

    // Find visible range
    let startIndex = 0;
    let endIndex = items.length;

    for (let i = 0; i < positions.length; i++) {
      const itemBottom = positions[i] + (measurements.get(i) || estimatedItemHeight);
      if (itemBottom > scrollTop) {
        startIndex = Math.max(0, i - 3); // overscan
        break;
      }
    }

    for (let i = startIndex; i < items.length; i++) {
      if (positions[i] > scrollTop + containerHeight) {
        endIndex = Math.min(items.length, i + 3); // overscan
        break;
      }
    }

    return {
      visibleRange: { startIndex, endIndex },
      itemPositions: positions,
      totalHeight: currentTop,
    };
  }, [items, measurements, scrollTop, containerHeight, estimatedItemHeight]);

  return {
    visibleRange,
    itemPositions,
    totalHeight,
    handleScroll,
    measureItem,
  };
}
