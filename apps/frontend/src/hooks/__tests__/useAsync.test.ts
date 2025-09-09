import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAsync } from '@/hooks/useAsync';

describe('useAsync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have initial idle state', () => {
    const asyncFunction = vi.fn().mockResolvedValue('success');
    const { result } = renderHook(() => useAsync(asyncFunction));

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isIdle).toBe(true);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('should execute function and handle success', async () => {
    const asyncFunction = vi.fn().mockResolvedValue('success data');
    const { result } = renderHook(() => useAsync(asyncFunction));

    expect(result.current.isIdle).toBe(true);

    await act(async () => {
      const promise = result.current.execute();
      await promise;
    });

    expect(result.current.data).toBe('success data');
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isIdle).toBe(false);
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.isError).toBe(false);
    expect(asyncFunction).toHaveBeenCalledTimes(1);
  });

  it('should handle async function errors', async () => {
    const error = new Error('Test error');
    const asyncFunction = vi.fn().mockRejectedValue(error);
    const { result } = renderHook(() => useAsync(asyncFunction));

    let thrownError: unknown = null;

    await act(async () => {
      try {
        await result.current.execute();
      } catch (error) {
        thrownError = error;
      }
    });

    expect(thrownError).toBe(error);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe(error);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isIdle).toBe(false);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(true);
  });

  it('should handle non-Error thrown values', async () => {
    const asyncFunction = vi.fn().mockRejectedValue('string error');
    const { result } = renderHook(() => useAsync(asyncFunction));

    let thrownError: unknown = null;

    await act(async () => {
      try {
        await result.current.execute();
      } catch (error) {
        thrownError = error;
      }
    });

    expect(thrownError).toBeInstanceOf(Error);
    if (thrownError instanceof Error) {
      expect(thrownError.message).toBe('string error');
    }
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('string error');
  });

  it('should reset state', async () => {
    const asyncFunction = vi.fn().mockResolvedValue('success data');
    const { result } = renderHook(() => useAsync(asyncFunction));

    // Execute and get success state
    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data).toBe('success data');

    // Reset state
    act(() => {
      result.current.reset();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isIdle).toBe(true);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('should execute immediately when immediate is true', async () => {
    const asyncFunction = vi.fn().mockResolvedValue('immediate data');

    const { result } = renderHook(() => useAsync(asyncFunction, true));

    // Wait for the immediate execution
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe('immediate data');
    expect(asyncFunction).toHaveBeenCalledTimes(1);
  });

  it('should not update state if component is unmounted', async () => {
    let resolvePromise: (value: string) => void;
    const promise = new Promise<string>(resolve => {
      resolvePromise = resolve;
    });
    const asyncFunction = vi.fn().mockReturnValue(promise);

    const { result, unmount } = renderHook(() => useAsync(asyncFunction));

    // Start execution
    act(() => {
      result.current.execute();
    });

    expect(result.current.isLoading).toBe(true);

    // Unmount before resolution
    unmount();

    // Resolve the promise after unmount
    await act(async () => {
      resolvePromise!('resolved data');
      await promise;
    });

    // State should still be loading since component was unmounted
    expect(result.current.isLoading).toBe(true);
  });

  it('should not execute if component is unmounted before execution', async () => {
    const asyncFunction = vi.fn().mockResolvedValue('data');
    const { result, unmount } = renderHook(() => useAsync(asyncFunction));

    unmount();

    const returnValue = await act(async () => {
      return result.current.execute();
    });

    expect(returnValue).toBeNull();
    expect(asyncFunction).not.toHaveBeenCalled();
  });

  it('should clear error state when executing after error', async () => {
    const error = new Error('Test error');
    let shouldFail = true;
    const asyncFunction = vi.fn().mockImplementation(() => {
      if (shouldFail) {
        return Promise.reject(error);
      }
      return Promise.resolve('success');
    });

    const { result } = renderHook(() => useAsync(asyncFunction));

    // First execution fails
    await act(async () => {
      try {
        await result.current.execute();
      } catch {
        // Expected to throw
      }
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe(error);

    // Second execution succeeds
    shouldFail = false;
    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data).toBe('success');
  });
});
