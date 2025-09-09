import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce, useDebouncedCallback, useThrottledCallback } from '@/hooks/useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500));
    expect(result.current).toBe('initial');
  });

  it('should debounce value updates', () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 'initial', delay: 500 },
    });

    expect(result.current).toBe('initial');

    // Update the value
    rerender({ value: 'updated', delay: 500 });
    expect(result.current).toBe('initial'); // Should still be initial

    // Fast-forward time by 250ms
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current).toBe('initial'); // Should still be initial

    // Fast-forward time by another 250ms (total 500ms)
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current).toBe('updated'); // Now should be updated
  });

  it('should reset timer on rapid updates', () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 'initial', delay: 500 },
    });

    // Update value multiple times rapidly
    rerender({ value: 'update1', delay: 500 });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    rerender({ value: 'update2', delay: 500 });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    rerender({ value: 'final', delay: 500 });
    expect(result.current).toBe('initial'); // Should still be initial

    // Fast-forward by full delay from last update
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe('final'); // Should be the last value
  });
});

describe('useDebouncedCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('should debounce callback execution', () => {
    const mockCallback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(mockCallback, 500));

    // Call multiple times rapidly
    act(() => {
      result.current('arg1');
      result.current('arg2');
      result.current('arg3');
    });

    expect(mockCallback).not.toHaveBeenCalled();

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(mockCallback).toHaveBeenLastCalledWith('arg3');
  });

  it('should update callback when it changes', () => {
    const mockCallback1 = vi.fn();
    const mockCallback2 = vi.fn();

    const { result, rerender } = renderHook(({ callback }) => useDebouncedCallback(callback, 500), {
      initialProps: { callback: mockCallback1 },
    });

    act(() => {
      result.current('test');
    });

    // Update callback before execution
    rerender({ callback: mockCallback2 });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(mockCallback1).not.toHaveBeenCalled();
    expect(mockCallback2).toHaveBeenCalledWith('test');
  });

  it('should cleanup timeout on unmount', () => {
    const mockCallback = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedCallback(mockCallback, 500));

    act(() => {
      result.current('test');
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(mockCallback).not.toHaveBeenCalled();
  });
});

describe('useThrottledCallback', () => {
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

    // Mock Date.now to start at time 0, then advance to simulate delay
    let currentTime = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

    const { result } = renderHook(() => useThrottledCallback(mockCallback, 500));

    // First call - advance time to exceed delay from initialization
    act(() => {
      currentTime = 1000; // 1 second later, definitely > 500ms
      result.current('test');
    });

    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(mockCallback).toHaveBeenCalledWith('test');
  });

  it('should throttle subsequent calls', () => {
    const mockCallback = vi.fn();

    let currentTime = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

    const { result } = renderHook(() => useThrottledCallback(mockCallback, 500));

    // First call should execute - advance time first
    act(() => {
      currentTime = 1000;
      result.current('first');
    });
    expect(mockCallback).toHaveBeenCalledTimes(1);

    // Subsequent calls within delay should be ignored - don't advance time much
    act(() => {
      currentTime = 1100; // Only 100ms later, < 500ms delay
      result.current('second');
      result.current('third');
    });
    expect(mockCallback).toHaveBeenCalledTimes(1);

    // Advance time to exceed the delay
    act(() => {
      currentTime = 1600; // 600ms from last execution
      result.current('fourth');
    });
    expect(mockCallback).toHaveBeenCalledTimes(2);
    expect(mockCallback).toHaveBeenLastCalledWith('fourth');
  });

  it('should update callback when it changes', () => {
    const mockCallback1 = vi.fn();
    const mockCallback2 = vi.fn();

    let currentTime = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

    const { result, rerender } = renderHook(({ callback }) => useThrottledCallback(callback, 500), {
      initialProps: { callback: mockCallback1 },
    });

    act(() => {
      currentTime = 1000;
      result.current('test');
    });

    expect(mockCallback1).toHaveBeenCalledWith('test');

    // Update callback
    rerender({ callback: mockCallback2 });

    act(() => {
      // Advance time to allow next call
      currentTime = 1600;
      result.current('test2');
    });

    expect(mockCallback2).toHaveBeenCalledWith('test2');
  });
});
