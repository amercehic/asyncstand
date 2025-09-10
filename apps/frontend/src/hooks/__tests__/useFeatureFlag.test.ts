import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFeatureFlag, useFeatureFlags, useEnabledFeatures } from '@/hooks/useFeatureFlag';

// Mock the API client
vi.mock('@/lib/api-client/features', () => ({
  featuresApi: {
    checkFeature: vi.fn(),
    getEnabledFeatures: vi.fn(),
  },
}));

const mockFeaturesApi = {
  checkFeature: vi.fn(),
  getEnabledFeatures: vi.fn(),
  checkQuota: vi.fn(),
  getAllFeatures: vi.fn(),
  createFeature: vi.fn(),
  updateFeature: vi.fn(),
  deleteFeature: vi.fn(),
};
vi.mocked(await import('@/lib/api-client/features')).featuresApi =
  mockFeaturesApi as unknown as typeof mockFeaturesApi;

describe('useFeatureFlag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage to ensure clean test state
    localStorage.clear();
  });

  it('should return initial state', () => {
    const { result } = renderHook(() => useFeatureFlag('test-feature'));

    expect(result.current).toEqual({
      isEnabled: false,
      loading: true,
      error: null,
      source: undefined,
      value: undefined,
      reason: undefined,
      refetch: expect.any(Function),
    });
  });

  it('should fetch and return feature state', async () => {
    const mockResult = {
      enabled: true,
      source: 'organization',
      value: 'premium',
      reason: 'User has premium plan',
    };

    mockFeaturesApi.checkFeature.mockResolvedValue(mockResult);

    const { result } = renderHook(() => useFeatureFlag('premium-features'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current).toEqual({
      isEnabled: true,
      loading: false,
      error: null,
      source: 'organization',
      value: 'premium',
      reason: 'User has premium plan',
      refetch: expect.any(Function),
    });

    expect(mockFeaturesApi.checkFeature).toHaveBeenCalledWith('premium-features');
  });

  it('should handle API errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = new Error('Feature check failed');
    mockFeaturesApi.checkFeature.mockRejectedValue(error);

    const { result } = renderHook(() => useFeatureFlag('failing-feature'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current).toEqual({
      isEnabled: false,
      loading: false,
      error,
      source: undefined,
      value: undefined,
      reason: undefined,
      refetch: expect.any(Function),
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      "Feature flag check failed for 'failing-feature':",
      'Feature check failed'
    );

    consoleSpy.mockRestore();
  });

  it('should handle empty feature key', async () => {
    const { result } = renderHook(() => useFeatureFlag(''));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isEnabled).toBe(false);
    expect(mockFeaturesApi.checkFeature).not.toHaveBeenCalled();
  });

  it('should cache results for specified duration', async () => {
    const mockResult = {
      enabled: true,
      source: 'organization',
      value: 'cached',
    };

    mockFeaturesApi.checkFeature.mockResolvedValue(mockResult);

    const { result, rerender } = renderHook(({ featureKey }) => useFeatureFlag(featureKey), {
      initialProps: { featureKey: 'cached-feature' },
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFeaturesApi.checkFeature).toHaveBeenCalledTimes(1);

    // Rerender with same feature key - should use cache
    rerender({ featureKey: 'cached-feature' });

    // Should not call API again
    expect(mockFeaturesApi.checkFeature).toHaveBeenCalledTimes(1);
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.value).toBe('cached');
  });

  it('should bypass cache after expiration', async () => {
    const mockResult = {
      enabled: true,
      source: 'organization',
    };

    mockFeaturesApi.checkFeature.mockResolvedValue(mockResult);

    const { result } = renderHook(() => useFeatureFlag('expiring-feature'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFeaturesApi.checkFeature).toHaveBeenCalledTimes(1);

    // Use fake timers for the cache check
    vi.useFakeTimers();

    // Fast forward past cache duration (5 minutes)
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    // Switch back to real timers for the async operation
    vi.useRealTimers();

    // Trigger a re-check by calling refetch
    await result.current.refetch();

    expect(mockFeaturesApi.checkFeature).toHaveBeenCalledTimes(2);
  });

  it('should refetch feature when refetch is called', async () => {
    const mockResult1 = { enabled: false, source: 'global' };
    const mockResult2 = { enabled: true, source: 'organization' };

    mockFeaturesApi.checkFeature
      .mockResolvedValueOnce(mockResult1)
      .mockResolvedValueOnce(mockResult2);

    const { result } = renderHook(() => useFeatureFlag('refetch-feature'));

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
        expect(result.current.isEnabled).toBe(false);
      },
      { timeout: 10000 }
    );

    await result.current.refetch();

    await waitFor(
      () => {
        expect(result.current.isEnabled).toBe(true);
      },
      { timeout: 10000 }
    );

    expect(mockFeaturesApi.checkFeature).toHaveBeenCalledTimes(2);
  });

  it('should handle feature key changes', async () => {
    const mockResult1 = { enabled: true, source: 'global' };
    const mockResult2 = { enabled: false, source: 'organization' };

    mockFeaturesApi.checkFeature
      .mockResolvedValueOnce(mockResult1)
      .mockResolvedValueOnce(mockResult2);

    const { result, rerender } = renderHook(({ featureKey }) => useFeatureFlag(featureKey), {
      initialProps: { featureKey: 'feature-1' },
    });

    await waitFor(() => {
      expect(result.current.isEnabled).toBe(true);
    });

    rerender({ featureKey: 'feature-2' });

    await waitFor(() => {
      expect(result.current.isEnabled).toBe(false);
    });

    expect(mockFeaturesApi.checkFeature).toHaveBeenCalledWith('feature-1');
    expect(mockFeaturesApi.checkFeature).toHaveBeenCalledWith('feature-2');
    expect(mockFeaturesApi.checkFeature).toHaveBeenCalledTimes(2);
  });

  it('should handle non-Error exceptions', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockFeaturesApi.checkFeature.mockRejectedValue('String error');

    const { result } = renderHook(() => useFeatureFlag('string-error-feature'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Failed to check feature flag');
    expect(result.current.isEnabled).toBe(false);

    consoleSpy.mockRestore();
  });
});

describe('useFeatureFlags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage to ensure clean test state
    localStorage.clear();
  });

  it('should return initial state', () => {
    const { result } = renderHook(() => useFeatureFlags(['feature1', 'feature2']));

    expect(result.current).toEqual({
      features: {},
      loading: true,
      error: null,
      refetch: expect.any(Function),
    });
  });

  it('should fetch multiple features', async () => {
    mockFeaturesApi.checkFeature
      .mockResolvedValueOnce({ enabled: true })
      .mockResolvedValueOnce({ enabled: false });

    const { result } = renderHook(() => useFeatureFlags(['feature1', 'feature2']));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.features).toEqual({
      feature1: true,
      feature2: false,
    });

    expect(result.current.error).toBeNull();
    expect(mockFeaturesApi.checkFeature).toHaveBeenCalledTimes(2);
  });

  it('should handle empty feature keys array', async () => {
    const { result } = renderHook(() => useFeatureFlags([]));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.features).toEqual({});
    expect(mockFeaturesApi.checkFeature).not.toHaveBeenCalled();
  });

  it('should handle partial failures', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockFeaturesApi.checkFeature
      .mockResolvedValueOnce({ enabled: true })
      .mockRejectedValueOnce(new Error('Feature2 failed'));

    const { result } = renderHook(() => useFeatureFlags(['feature1', 'feature2']));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.features).toEqual({
      feature1: true,
      feature2: false, // Fail closed
    });

    expect(result.current.error).toBeNull(); // Individual failures don't set global error
    expect(consoleSpy).toHaveBeenCalledWith(
      "Feature flag check failed for 'feature2':",
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it('should handle complete API failure', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = new Error('Complete API failure');

    // Mock Promise.allSettled to simulate complete failure
    vi.mocked(mockFeaturesApi.checkFeature).mockRejectedValue(error);

    const { result } = renderHook(() => useFeatureFlags(['feature1', 'feature2']));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.features).toEqual({
      feature1: false,
      feature2: false,
    });

    // With Promise.allSettled, individual failures don't set overall error
    // They are handled as individual rejections, so error should be null
    expect(result.current.error).toBeNull();

    consoleSpy.mockRestore();
  });

  it('should refetch all features', async () => {
    mockFeaturesApi.checkFeature
      .mockResolvedValueOnce({ enabled: false })
      .mockResolvedValueOnce({ enabled: false })
      .mockResolvedValueOnce({ enabled: true })
      .mockResolvedValueOnce({ enabled: true });

    const { result } = renderHook(() => useFeatureFlags(['feature1', 'feature2']));

    await waitFor(() => {
      expect(result.current.features).toEqual({
        feature1: false,
        feature2: false,
      });
    });

    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.features).toEqual({
        feature1: true,
        feature2: true,
      });
    });

    expect(mockFeaturesApi.checkFeature).toHaveBeenCalledTimes(4);
  });

  it('should update when feature keys change', async () => {
    // Set up mock to return different values based on which feature is being checked
    mockFeaturesApi.checkFeature.mockImplementation((feature: string) => {
      if (feature === 'feature1') {
        return Promise.resolve({ enabled: true });
      } else if (feature === 'feature2') {
        return Promise.resolve({ enabled: false });
      }
      return Promise.resolve({ enabled: false });
    });

    const { result, rerender } = renderHook(({ features }) => useFeatureFlags(features), {
      initialProps: { features: ['feature1'] },
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.features).toEqual({ feature1: true });
    });

    rerender({ features: ['feature1', 'feature2'] });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.features).toEqual({
        feature1: true,
        feature2: false,
      });
    });
  });

  it('should handle non-Error exceptions in complete failure', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Simulate a scenario where the hook throws a non-Error
    const originalAllSettled = Promise.allSettled;
    Promise.allSettled = vi.fn().mockRejectedValue('String error');

    const { result } = renderHook(() => useFeatureFlags(['feature1']));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Failed to check feature flags');

    Promise.allSettled = originalAllSettled;
    consoleSpy.mockRestore();
  });
});

describe('useEnabledFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage to ensure clean test state
    localStorage.clear();
  });

  it('should return initial state', () => {
    const { result } = renderHook(() => useEnabledFeatures());

    expect(result.current).toEqual({
      features: ['dashboard', 'standups'], // Zero-flicker: start with safe defaults
      loading: true,
      error: null,
      refetch: expect.any(Function),
    });
  });

  it('should fetch enabled features when authenticated', async () => {
    const mockFeatures = ['analytics', 'reports', 'exports'];
    mockFeaturesApi.getEnabledFeatures.mockResolvedValue(mockFeatures);

    const { result } = renderHook(() => useEnabledFeatures(true, false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.features).toEqual(mockFeatures);
    expect(result.current.error).toBeNull();
    expect(mockFeaturesApi.getEnabledFeatures).toHaveBeenCalledTimes(1);
  });

  it('should not fetch when not authenticated', async () => {
    const { result } = renderHook(() => useEnabledFeatures(false, false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.features).toEqual(['dashboard', 'standups']); // Zero-flicker: preserve initial features on error
    expect(mockFeaturesApi.getEnabledFeatures).not.toHaveBeenCalled();
  });

  it('should wait for auth loading to complete', async () => {
    const { result, rerender } = renderHook(
      ({ isAuthenticated, authLoading }) => useEnabledFeatures(isAuthenticated, authLoading),
      {
        initialProps: { isAuthenticated: true, authLoading: true },
      }
    );

    expect(result.current.loading).toBe(true);
    expect(mockFeaturesApi.getEnabledFeatures).not.toHaveBeenCalled();

    // Auth loading completes
    rerender({ isAuthenticated: true, authLoading: false });

    await waitFor(() => {
      expect(mockFeaturesApi.getEnabledFeatures).toHaveBeenCalled();
    });
  });

  it('should handle API errors', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = new Error('API Error');
    mockFeaturesApi.getEnabledFeatures.mockRejectedValue(error);

    const { result } = renderHook(() => useEnabledFeatures(true, false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.features).toEqual(['dashboard', 'standups']); // Zero-flicker: preserve initial features on error
    expect(result.current.error).toBe(error);
    expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch enabled features:', 'API Error');

    consoleSpy.mockRestore();
  });

  it('should refetch features', async () => {
    mockFeaturesApi.getEnabledFeatures
      .mockResolvedValueOnce(['feature1'])
      .mockResolvedValueOnce(['feature1', 'feature2']);

    const { result } = renderHook(() => useEnabledFeatures(true, false));

    await waitFor(() => {
      expect(result.current.features).toEqual(['feature1']);
    });

    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.features).toEqual(['feature1', 'feature2']);
    });

    expect(mockFeaturesApi.getEnabledFeatures).toHaveBeenCalledTimes(2);
  });

  it('should handle non-Error exceptions', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockFeaturesApi.getEnabledFeatures.mockRejectedValue('String error');

    const { result } = renderHook(() => useEnabledFeatures(true, false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Failed to fetch enabled features');
    expect(result.current.features).toEqual(['dashboard', 'standups']); // Zero-flicker: preserve initial features on error

    consoleSpy.mockRestore();
  });

  it('should clear features when authentication changes to false', () => {
    mockFeaturesApi.getEnabledFeatures.mockResolvedValue(['feature1']);

    const { result, rerender } = renderHook(
      ({ isAuthenticated, authLoading }) => useEnabledFeatures(isAuthenticated, authLoading),
      {
        initialProps: { isAuthenticated: true, authLoading: false },
      }
    );

    // Initially should fetch features (we don't wait here to avoid race conditions)

    // User logs out
    rerender({ isAuthenticated: false, authLoading: false });

    expect(result.current.features).toEqual(['dashboard', 'standups']); // Zero-flicker: preserve initial features on error
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle authentication state transitions correctly', async () => {
    const mockFeatures = ['auth-feature'];
    mockFeaturesApi.getEnabledFeatures.mockResolvedValue(mockFeatures);

    const { result, rerender } = renderHook(
      ({ isAuthenticated, authLoading }) => useEnabledFeatures(isAuthenticated, authLoading),
      {
        initialProps: { isAuthenticated: false, authLoading: true },
      }
    );

    // Initially loading auth
    expect(result.current.loading).toBe(true);

    // Auth completes - user is authenticated
    rerender({ isAuthenticated: true, authLoading: false });

    await waitFor(() => {
      expect(result.current.features).toEqual(mockFeatures);
      expect(result.current.loading).toBe(false);
    });

    // User logs out
    rerender({ isAuthenticated: false, authLoading: false });

    expect(result.current.features).toEqual(['dashboard', 'standups']); // Zero-flicker: preserve initial features on error
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
