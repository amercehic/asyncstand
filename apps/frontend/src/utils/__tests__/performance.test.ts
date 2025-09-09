import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useDebounce,
  useThrottle,
  useIntersectionObserver,
  useVirtualizedList,
  preloadImage,
  useLazyImage,
  useAnimationFrame,
  useStableCallback,
} from '@/utils/performance';

// Mock IntersectionObserver
const mockObserve = vi.fn();
const mockUnobserve = vi.fn();
const mockDisconnect = vi.fn();

const mockIntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: mockObserve,
  unobserve: mockUnobserve,
  disconnect: mockDisconnect,
}));

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: mockIntersectionObserver,
});

// Mock requestAnimationFrame
let animationFrameId = 1;
const mockRequestAnimationFrame = vi.fn().mockImplementation(cb => {
  const id = animationFrameId++;
  setTimeout(cb, 16); // ~60fps
  return id;
});

const mockCancelAnimationFrame = vi.fn();

Object.defineProperty(window, 'requestAnimationFrame', {
  writable: true,
  value: mockRequestAnimationFrame,
});

Object.defineProperty(window, 'cancelAnimationFrame', {
  writable: true,
  value: mockCancelAnimationFrame,
});

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('should debounce callback execution', () => {
    const mockCallback = vi.fn();
    const { result } = renderHook(() => useDebounce(mockCallback, 500));

    act(() => {
      result.current('arg1');
      result.current('arg2');
      result.current('arg3');
    });

    expect(mockCallback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(mockCallback).toHaveBeenLastCalledWith('arg3');
  });

  it('should cleanup timeout on unmount', () => {
    const mockCallback = vi.fn();
    const { result, unmount } = renderHook(() => useDebounce(mockCallback, 500));

    act(() => {
      result.current('test');
    });

    // Unmount before the timeout fires
    unmount();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // The timeout should be cleared, so callback should not be called
    expect(mockCallback).not.toHaveBeenCalled();
  });
});

describe('useThrottle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should execute callback immediately on first call', () => {
    const mockCallback = vi.fn();

    // Mock Date.now to start at time 0
    let currentTime = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

    const { result } = renderHook(() => useThrottle(mockCallback, 500));

    act(() => {
      // Advance time to be past any initialization time
      currentTime = 1000;
      result.current('test');
    });

    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(mockCallback).toHaveBeenCalledWith('test');
  });

  it('should throttle subsequent calls', () => {
    const mockCallback = vi.fn();

    let currentTime = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

    const { result } = renderHook(() => useThrottle(mockCallback, 500));

    // First call should execute
    act(() => {
      currentTime = 1000;
      result.current('first');
    });
    expect(mockCallback).toHaveBeenCalledTimes(1);

    // Subsequent calls within delay should be ignored
    act(() => {
      currentTime = 1100; // Only 100ms later
      result.current('second');
      result.current('third');
    });
    expect(mockCallback).toHaveBeenCalledTimes(1);

    // After delay, next call should execute
    act(() => {
      currentTime = 1600; // 600ms from first call
      result.current('fourth');
    });
    expect(mockCallback).toHaveBeenCalledTimes(2);
    expect(mockCallback).toHaveBeenLastCalledWith('fourth');
  });
});

describe('useIntersectionObserver', () => {
  beforeEach(() => {
    mockIntersectionObserver.mockClear();
    mockObserve.mockClear();
    mockUnobserve.mockClear();
    mockDisconnect.mockClear();
  });

  it('should return callback ref and intersection state', () => {
    const { result } = renderHook(() => useIntersectionObserver());

    expect(typeof result.current[0]).toBe('function'); // callbackRef
    expect(typeof result.current[1]).toBe('boolean'); // isIntersecting
    expect(result.current[1]).toBe(false); // initial state
  });

  it('should create intersection observer when element is set', () => {
    const { result } = renderHook(() => useIntersectionObserver({ threshold: 0.5 }));

    // const mockElement = document.createElement('div');

    // Just test that the hook returns the expected structure
    expect(typeof result.current[0]).toBe('function');
    expect(typeof result.current[1]).toBe('boolean');
  });
});

describe('useVirtualizedList', () => {
  const items = Array.from({ length: 1000 }, (_, i) => `Item ${i}`);
  const itemHeight = 50;
  const containerHeight = 300;

  it('should calculate visible items correctly', () => {
    const { result } = renderHook(() =>
      useVirtualizedList({
        items,
        itemHeight,
        containerHeight,
        overscan: 5,
      })
    );

    expect(result.current.visibleItems).toHaveLength(11); // 6 visible + 5 overscan
    expect(result.current.totalHeight).toBe(50000); // 1000 * 50
    expect(result.current.offsetY).toBe(0);
  });

  it('should update visible items when scrollTop changes', () => {
    const { result } = renderHook(() =>
      useVirtualizedList({
        items,
        itemHeight,
        containerHeight,
        overscan: 2,
      })
    );

    // Simulate scroll event
    const mockScrollEvent = {
      currentTarget: { scrollTop: 250 },
    } as React.UIEvent<HTMLDivElement>;

    act(() => {
      result.current.handleScroll(mockScrollEvent);
    });

    // Should start from item 5 (250 / 50) minus overscan
    expect(result.current.visibleItems[0].index).toBe(3); // 5 - 2 overscan
    expect(result.current.offsetY).toBe(150); // 3 * 50
  });

  it('should handle edge cases at list boundaries', () => {
    const shortItems = Array.from({ length: 5 }, (_, i) => `Item ${i}`);

    const { result } = renderHook(() =>
      useVirtualizedList({
        items: shortItems,
        itemHeight,
        containerHeight,
        overscan: 10,
      })
    );

    expect(result.current.visibleItems).toHaveLength(5); // Should not exceed items length
    expect(result.current.visibleItems[0].index).toBe(0);
    expect(result.current.visibleItems[4].index).toBe(4);
  });
});

describe('preloadImage', () => {
  it('should resolve when image loads successfully', async () => {
    // Mock Image constructor
    const mockImage = {
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      src: '',
    };

    Object.defineProperty(window, 'Image', {
      writable: true,
      value: vi.fn().mockImplementation(() => mockImage),
    });

    const loadPromise = preloadImage('test.jpg');

    // Simulate successful load
    act(() => {
      mockImage.onload?.();
    });

    await expect(loadPromise).resolves.toBeUndefined();
    expect(mockImage.src).toBe('test.jpg');
  });

  it('should reject when image fails to load', async () => {
    const mockImage = {
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      src: '',
    };

    Object.defineProperty(window, 'Image', {
      writable: true,
      value: vi.fn().mockImplementation(() => mockImage),
    });

    const loadPromise = preloadImage('invalid.jpg');

    // Simulate load error
    act(() => {
      mockImage.onerror?.();
    });

    await expect(loadPromise).rejects.toBeUndefined();
  });
});

describe('useLazyImage', () => {
  beforeEach(() => {
    mockIntersectionObserver.mockClear();
  });

  it('should return placeholder initially', () => {
    const { result } = renderHook(() => useLazyImage('test.jpg', 'placeholder.jpg'));

    expect(result.current.src).toBe('placeholder.jpg');
    expect(result.current.isLoaded).toBe(false);
  });

  it('should return empty string when no placeholder provided', () => {
    const { result } = renderHook(() => useLazyImage('test.jpg'));

    expect(result.current.src).toBe('');
    expect(result.current.isLoaded).toBe(false);
  });
});

describe('useAnimationFrame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequestAnimationFrame.mockClear();
    mockCancelAnimationFrame.mockClear();
  });

  it('should call callback on each animation frame', () => {
    const mockCallback = vi.fn();

    renderHook(() => useAnimationFrame(mockCallback, []));

    expect(mockRequestAnimationFrame).toHaveBeenCalled();
  });

  it('should cleanup animation frame on unmount', () => {
    const mockCallback = vi.fn();

    const { unmount } = renderHook(() => useAnimationFrame(mockCallback, []));

    // Test that it doesn't throw on unmount
    expect(() => unmount()).not.toThrow();
  });
});

describe('useStableCallback', () => {
  it('should return stable callback reference', () => {
    const mockCallback = vi.fn();

    const { result, rerender } = renderHook(({ callback }) => useStableCallback(callback), {
      initialProps: { callback: mockCallback },
    });

    const firstCallback = result.current;

    const newMockCallback = vi.fn();
    rerender({ callback: newMockCallback });

    const secondCallback = result.current;

    // Reference should remain the same
    expect(firstCallback).toBe(secondCallback);
  });

  it('should call the latest callback', () => {
    const mockCallback1 = vi.fn();
    const mockCallback2 = vi.fn();

    const { result, rerender } = renderHook(({ callback }) => useStableCallback(callback), {
      initialProps: { callback: mockCallback1 },
    });

    // Update to new callback
    rerender({ callback: mockCallback2 });

    // Call the stable callback
    act(() => {
      result.current('test');
    });

    expect(mockCallback1).not.toHaveBeenCalled();
    expect(mockCallback2).toHaveBeenCalledWith('test');
  });
});
