import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor, renderHook } from '@testing-library/react';
import { FeatureProvider, useFeatures, useFeature, useQuota } from '@/contexts/FeatureContext';
import { useAuth } from '@/contexts/AuthContext';
import type { User } from '@/types/api';

// Mock the API client
vi.mock('@/lib/api-client', () => ({
  featuresApi: {
    getEnabledFeatures: vi.fn(),
    checkFeature: vi.fn(),
    checkQuota: vi.fn(),
  },
}));

// Mock the auth context
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockFeaturesApi = {
  getEnabledFeatures: vi.fn(),
  checkFeature: vi.fn(),
  checkQuota: vi.fn(),
  getAllFeatures: vi.fn(),
  createFeature: vi.fn(),
  updateFeature: vi.fn(),
  deleteFeature: vi.fn(),
};
vi.mocked(await import('@/lib/api-client')).featuresApi =
  mockFeaturesApi as unknown as typeof mockFeaturesApi;

const mockUseAuth = vi.mocked(await import('@/contexts/AuthContext')).useAuth;

// Helper functions for creating mock objects
const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'member',
  orgId: 'org-1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

const createMockAuthContext = (overrides: Record<string, unknown> = {}) =>
  ({
    isAuthenticated: false,
    isLoading: false,
    user: null,
    tokens: null,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
    refreshUser: vi.fn(),
    ...overrides,
  }) as unknown as ReturnType<typeof useAuth>;

describe('FeatureContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('FeatureProvider', () => {
    it('should throw error when useFeatures is used outside provider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useFeatures());
      }).toThrow('useFeatures must be used within a FeatureProvider');

      consoleSpy.mockRestore();
    });

    it('should provide initial context values', () => {
      mockUseAuth.mockReturnValue(
        createMockAuthContext({
          isAuthenticated: false,
          user: null,
        })
      );

      const { result } = renderHook(() => useFeatures(), {
        wrapper: ({ children }) => <FeatureProvider>{children}</FeatureProvider>,
      });

      expect(result.current.enabledFeatures).toBeInstanceOf(Set);
      expect(result.current.enabledFeatures.size).toBe(0);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.quotaCache).toBeInstanceOf(Map);
      expect(typeof result.current.hasFeature).toBe('function');
      expect(typeof result.current.checkFeature).toBe('function');
      expect(typeof result.current.refreshFeatures).toBe('function');
      expect(typeof result.current.checkQuota).toBe('function');
    });

    it('should not load features when user is not authenticated', () => {
      mockUseAuth.mockReturnValue(
        createMockAuthContext({
          isAuthenticated: false,
          user: null,
        })
      );

      renderHook(() => useFeatures(), {
        wrapper: ({ children }) => <FeatureProvider>{children}</FeatureProvider>,
      });

      expect(mockFeaturesApi.getEnabledFeatures).not.toHaveBeenCalled();
    });

    it('should not load features for super admin users', () => {
      mockUseAuth.mockReturnValue(
        createMockAuthContext({
          isAuthenticated: true,
          user: createMockUser({ id: '1', isSuperAdmin: true, orgId: 'org-1' }),
        })
      );

      renderHook(() => useFeatures(), {
        wrapper: ({ children }) => <FeatureProvider>{children}</FeatureProvider>,
      });

      expect(mockFeaturesApi.getEnabledFeatures).not.toHaveBeenCalled();
    });

    it('should load features for authenticated regular users', async () => {
      const mockFeatures = ['analytics', 'advanced_standups', 'slack_integration'];
      mockFeaturesApi.getEnabledFeatures.mockResolvedValue(mockFeatures);

      mockUseAuth.mockReturnValue(
        createMockAuthContext({
          isAuthenticated: true,
          user: createMockUser({ id: '1', orgId: 'org-1', isSuperAdmin: false }),
        })
      );

      const { result } = renderHook(() => useFeatures(), {
        wrapper: ({ children }) => <FeatureProvider>{children}</FeatureProvider>,
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.enabledFeatures.size).toBe(3);
        expect(result.current.hasFeature('analytics')).toBe(true);
      });
    });

    it('should handle API error when loading features', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFeaturesApi.getEnabledFeatures.mockRejectedValue(new Error('API Error'));

      mockUseAuth.mockReturnValue(
        createMockAuthContext({
          isAuthenticated: true,
          user: createMockUser({ id: '1', orgId: 'org-1' }),
        })
      );

      const { result } = renderHook(() => useFeatures(), {
        wrapper: ({ children }) => <FeatureProvider>{children}</FeatureProvider>,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.enabledFeatures.size).toBe(0);
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to load features:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('hasFeature', () => {
    it('should return true for enabled features', async () => {
      mockFeaturesApi.getEnabledFeatures.mockResolvedValue(['analytics', 'reports']);
      mockUseAuth.mockReturnValue(
        createMockAuthContext({
          isAuthenticated: true,
          user: createMockUser({ id: '1', orgId: 'org-1' }),
        })
      );

      const { result } = renderHook(() => useFeatures(), {
        wrapper: ({ children }) => <FeatureProvider>{children}</FeatureProvider>,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasFeature('analytics')).toBe(true);
      expect(result.current.hasFeature('reports')).toBe(true);
      expect(result.current.hasFeature('non-existent')).toBe(false);
    });
  });

  describe('checkFeature', () => {
    it('should return feature check result for authenticated user', async () => {
      const mockResult = {
        enabled: true,
        source: 'organization',
        value: 'enabled',
        reason: 'Organization has this feature',
      };

      mockFeaturesApi.checkFeature.mockResolvedValue(mockResult);
      mockFeaturesApi.getEnabledFeatures.mockResolvedValue([]);
      mockUseAuth.mockReturnValue(
        createMockAuthContext({
          isAuthenticated: true,
          user: createMockUser({ id: '1', orgId: 'org-1' }),
        })
      );

      const { result } = renderHook(() => useFeatures(), {
        wrapper: ({ children }) => <FeatureProvider>{children}</FeatureProvider>,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const checkResult = await result.current.checkFeature('test-feature');

      expect(mockFeaturesApi.checkFeature).toHaveBeenCalledWith('test-feature');
      expect(checkResult).toEqual(mockResult);
    });

    it('should return disabled result for unauthenticated user', async () => {
      mockUseAuth.mockReturnValue(
        createMockAuthContext({
          isAuthenticated: false,
          user: null,
        })
      );

      const { result } = renderHook(() => useFeatures(), {
        wrapper: ({ children }) => <FeatureProvider>{children}</FeatureProvider>,
      });

      const checkResult = await result.current.checkFeature('test-feature');

      expect(checkResult).toEqual({
        enabled: false,
        source: 'global',
        reason: 'User not authenticated',
      });
    });

    it('should update enabled features cache when checkFeature returns enabled', async () => {
      const mockResult = { enabled: true, source: 'organization' };
      mockFeaturesApi.getEnabledFeatures.mockResolvedValue([]);
      mockFeaturesApi.checkFeature.mockResolvedValue(mockResult);

      mockUseAuth.mockReturnValue(
        createMockAuthContext({
          isAuthenticated: true,
          user: createMockUser({ id: '1', orgId: 'org-1' }),
        })
      );

      const { result } = renderHook(() => useFeatures(), {
        wrapper: ({ children }) => <FeatureProvider>{children}</FeatureProvider>,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Initially feature not enabled
      expect(result.current.hasFeature('new-feature')).toBe(false);

      // Check feature - should enable it and wait for state update
      await result.current.checkFeature('new-feature');

      // Wait for the state update to be reflected
      await waitFor(() => {
        expect(result.current.hasFeature('new-feature')).toBe(true);
      });
    });

    it('should handle checkFeature API error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFeaturesApi.getEnabledFeatures.mockResolvedValue([]);
      mockFeaturesApi.checkFeature.mockRejectedValue(new Error('API Error'));

      mockUseAuth.mockReturnValue(
        createMockAuthContext({
          isAuthenticated: true,
          user: createMockUser({ id: '1', orgId: 'org-1' }),
        })
      );

      const { result } = renderHook(() => useFeatures(), {
        wrapper: ({ children }) => <FeatureProvider>{children}</FeatureProvider>,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const checkResult = await result.current.checkFeature('test-feature');

      expect(checkResult).toEqual({
        enabled: false,
        source: 'global',
        reason: 'Failed to check feature',
      });

      consoleSpy.mockRestore();
    });
  });

  describe('checkQuota', () => {
    it('should return quota check result for authenticated user', async () => {
      const mockQuotaResult = {
        current: 5,
        limit: 10,
        exceeded: false,
      };

      mockFeaturesApi.checkQuota.mockResolvedValue(mockQuotaResult);
      mockFeaturesApi.getEnabledFeatures.mockResolvedValue([]);
      mockUseAuth.mockReturnValue(
        createMockAuthContext({
          isAuthenticated: true,
          user: createMockUser({ id: '1', orgId: 'org-1' }),
        })
      );

      const { result } = renderHook(() => useFeatures(), {
        wrapper: ({ children }) => <FeatureProvider>{children}</FeatureProvider>,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const quotaResult = await result.current.checkQuota('members');

      expect(mockFeaturesApi.checkQuota).toHaveBeenCalledWith('members');
      expect(quotaResult).toEqual(mockQuotaResult);
    });

    it('should return exceeded quota for unauthenticated user', async () => {
      mockUseAuth.mockReturnValue(
        createMockAuthContext({
          isAuthenticated: false,
          user: null,
        })
      );

      const { result } = renderHook(() => useFeatures(), {
        wrapper: ({ children }) => <FeatureProvider>{children}</FeatureProvider>,
      });

      const quotaResult = await result.current.checkQuota('teams');

      expect(quotaResult).toEqual({
        current: 0,
        limit: 0,
        exceeded: true,
      });
    });

    it('should cache quota results', async () => {
      const mockQuotaResult = {
        current: 3,
        limit: 5,
        exceeded: false,
      };

      mockFeaturesApi.checkQuota.mockResolvedValue(mockQuotaResult);
      mockFeaturesApi.getEnabledFeatures.mockResolvedValue([]);
      mockUseAuth.mockReturnValue(
        createMockAuthContext({
          isAuthenticated: true,
          user: createMockUser({ id: '1', orgId: 'org-1' }),
        })
      );

      const { result } = renderHook(() => useFeatures(), {
        wrapper: ({ children }) => <FeatureProvider>{children}</FeatureProvider>,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // First call
      await result.current.checkQuota('standups');
      expect(mockFeaturesApi.checkQuota).toHaveBeenCalledTimes(1);

      // Cache should be populated
      expect(result.current.quotaCache.has('standups')).toBe(true);

      // Second call should use cache
      const cachedResult = await result.current.checkQuota('standups');
      expect(cachedResult).toEqual(mockQuotaResult);
      // Should still only be called once due to caching
      expect(mockFeaturesApi.checkQuota).toHaveBeenCalledTimes(1);
    });

    it('should handle checkQuota API error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFeaturesApi.getEnabledFeatures.mockResolvedValue([]);
      mockFeaturesApi.checkQuota.mockRejectedValue(new Error('Quota API Error'));

      mockUseAuth.mockReturnValue(
        createMockAuthContext({
          isAuthenticated: true,
          user: createMockUser({ id: '1', orgId: 'org-1' }),
        })
      );

      const { result } = renderHook(() => useFeatures(), {
        wrapper: ({ children }) => <FeatureProvider>{children}</FeatureProvider>,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const quotaResult = await result.current.checkQuota('storage');

      expect(quotaResult).toEqual({
        current: 0,
        limit: 0,
        exceeded: true,
      });

      consoleSpy.mockRestore();
    });
  });

  describe('refreshFeatures', () => {
    it('should reload features when called', async () => {
      mockFeaturesApi.getEnabledFeatures
        .mockResolvedValueOnce(['feature1'])
        .mockResolvedValueOnce(['feature1', 'feature2']);

      mockUseAuth.mockReturnValue(
        createMockAuthContext({
          isAuthenticated: true,
          user: createMockUser({ id: '1', orgId: 'org-1' }),
        })
      );

      const { result } = renderHook(() => useFeatures(), {
        wrapper: ({ children }) => <FeatureProvider>{children}</FeatureProvider>,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.enabledFeatures.size).toBe(1);
      });

      // Refresh features
      await result.current.refreshFeatures();

      await waitFor(() => {
        expect(result.current.enabledFeatures.size).toBe(2);
      });

      expect(mockFeaturesApi.getEnabledFeatures).toHaveBeenCalledTimes(2);
    });
  });

  describe('useFeature hook', () => {
    it('should return feature state correctly', async () => {
      mockFeaturesApi.getEnabledFeatures.mockResolvedValue(['analytics']);
      mockUseAuth.mockReturnValue(
        createMockAuthContext({
          isAuthenticated: true,
          user: createMockUser({ id: '1', orgId: 'org-1' }),
        })
      );

      const { result } = renderHook(() => useFeature('analytics'), {
        wrapper: ({ children }) => <FeatureProvider>{children}</FeatureProvider>,
      });

      await waitFor(() => {
        expect(result.current).toBe(true);
      });
    });

    it('should return false for disabled features', async () => {
      mockFeaturesApi.getEnabledFeatures.mockResolvedValue([]);
      mockUseAuth.mockReturnValue(
        createMockAuthContext({
          isAuthenticated: true,
          user: createMockUser({ id: '1', orgId: 'org-1' }),
        })
      );

      const { result } = renderHook(() => useFeature('disabled-feature'), {
        wrapper: ({ children }) => <FeatureProvider>{children}</FeatureProvider>,
      });

      await waitFor(() => {
        expect(result.current).toBe(false);
      });
    });
  });

  describe('useQuota hook', () => {
    it('should return quota information', async () => {
      const mockQuotaResult = {
        current: 7,
        limit: 10,
        exceeded: false,
      };

      mockFeaturesApi.checkQuota.mockResolvedValue(mockQuotaResult);
      mockFeaturesApi.getEnabledFeatures.mockResolvedValue([]);
      mockUseAuth.mockReturnValue(
        createMockAuthContext({
          isAuthenticated: true,
          user: createMockUser({ id: '1', orgId: 'org-1' }),
        })
      );

      const { result, unmount } = renderHook(() => useQuota('members'), {
        wrapper: ({ children }) => <FeatureProvider>{children}</FeatureProvider>,
      });

      // Should show loading initially
      expect(result.current.loading).toBe(true);

      await waitFor(
        () => {
          expect(result.current.loading).toBe(false);
          expect(result.current.quota).toEqual(mockQuotaResult);
        },
        { timeout: 10000 }
      );

      expect(mockFeaturesApi.checkQuota).toHaveBeenCalledWith('members');

      // Cleanup to prevent interval from running
      unmount();
    });

    it('should handle quota error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFeaturesApi.checkQuota.mockRejectedValue(new Error('Quota API Error'));
      mockFeaturesApi.getEnabledFeatures.mockResolvedValue([]);
      mockUseAuth.mockReturnValue(
        createMockAuthContext({
          isAuthenticated: true,
          user: createMockUser({ id: '1', orgId: 'org-1' }),
        })
      );

      const { result, unmount } = renderHook(() => useQuota('teams'), {
        wrapper: ({ children }) => <FeatureProvider>{children}</FeatureProvider>,
      });

      await waitFor(
        () => {
          expect(result.current.loading).toBe(false);
        },
        { timeout: 10000 }
      );

      // The useQuota hook gets the error quota result from checkQuota context method
      expect(result.current.quota).toEqual({
        current: 0,
        limit: 0,
        exceeded: true,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to check quota for teams:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();

      // Cleanup to prevent interval from running
      unmount();
    });
  });
});
