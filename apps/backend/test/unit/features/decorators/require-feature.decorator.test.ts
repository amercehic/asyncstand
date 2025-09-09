import { SetMetadata } from '@nestjs/common';
import { RequireFeature, FEATURE_KEY } from '@/features/decorators/require-feature.decorator';

// Mock SetMetadata to track its calls
jest.mock('@nestjs/common', () => ({
  SetMetadata: jest.fn(),
}));

const mockSetMetadata = SetMetadata as jest.MockedFunction<typeof SetMetadata>;

describe('RequireFeature Decorator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(RequireFeature).toBeDefined();
    expect(FEATURE_KEY).toBeDefined();
  });

  it('should have correct FEATURE_KEY constant', () => {
    expect(FEATURE_KEY).toBe('feature');
  });

  it('should call SetMetadata with correct parameters', () => {
    const featureName = 'test-feature';

    RequireFeature(featureName);

    expect(mockSetMetadata).toHaveBeenCalledWith(FEATURE_KEY, featureName);
    expect(mockSetMetadata).toHaveBeenCalledTimes(1);
  });

  it('should work with different feature names', () => {
    const featureNames = [
      'dashboard',
      'teams',
      'standups',
      'integrations',
      'billing',
      'admin-panel',
      'user-management',
    ];

    featureNames.forEach((featureName, index) => {
      RequireFeature(featureName);

      expect(mockSetMetadata).toHaveBeenNthCalledWith(index + 1, FEATURE_KEY, featureName);
    });

    expect(mockSetMetadata).toHaveBeenCalledTimes(featureNames.length);
  });

  it('should handle empty string feature name', () => {
    const featureName = '';

    RequireFeature(featureName);

    expect(mockSetMetadata).toHaveBeenCalledWith(FEATURE_KEY, featureName);
  });

  it('should handle special characters in feature name', () => {
    const specialFeatureNames = [
      'feature-with-dashes',
      'feature_with_underscores',
      'feature.with.dots',
      'feature123',
      'UPPERCASE_FEATURE',
      'mixedCaseFeature',
    ];

    specialFeatureNames.forEach((featureName, index) => {
      RequireFeature(featureName);

      expect(mockSetMetadata).toHaveBeenNthCalledWith(index + 1, FEATURE_KEY, featureName);
    });
  });

  it('should return the result of SetMetadata', () => {
    const mockResult = Symbol('mock-decorator');
    mockSetMetadata.mockReturnValue(mockResult as unknown as ReturnType<typeof SetMetadata>);

    const result = RequireFeature('test-feature');

    expect(result).toBe(mockResult);
  });

  it('should be usable as a class decorator', () => {
    const decorator = RequireFeature('class-level-feature');

    // The decorator should return what SetMetadata returns
    expect(decorator).toBeDefined();
    expect(mockSetMetadata).toHaveBeenCalled();
  });

  it('should be usable as a method decorator', () => {
    const decorator = RequireFeature('method-level-feature');

    // The decorator should return what SetMetadata returns
    expect(decorator).toBeDefined();
    expect(mockSetMetadata).toHaveBeenCalled();
  });

  it('should maintain consistency between multiple calls', () => {
    const featureName = 'consistent-feature';

    RequireFeature(featureName);
    RequireFeature(featureName);

    expect(mockSetMetadata).toHaveBeenNthCalledWith(1, FEATURE_KEY, featureName);
    expect(mockSetMetadata).toHaveBeenNthCalledWith(2, FEATURE_KEY, featureName);
    expect(mockSetMetadata).toHaveBeenCalledTimes(2);
  });

  describe('Integration with Reflector', () => {
    it('should use the same FEATURE_KEY that the guard expects', () => {
      // This ensures consistency between decorator and guard
      expect(FEATURE_KEY).toBe('feature');

      // The guard imports and uses this same constant
      RequireFeature('integration-test');

      expect(mockSetMetadata).toHaveBeenCalledWith('feature', 'integration-test');
    });
  });

  describe('Type safety', () => {
    it('should accept string parameter', () => {
      // This test ensures TypeScript compilation works correctly
      const validFeatures: string[] = ['dashboard', 'teams', 'standups'];

      validFeatures.forEach((feature) => {
        expect(() => RequireFeature(feature)).not.toThrow();
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle very long feature names', () => {
      const longFeatureName = 'a'.repeat(1000);

      RequireFeature(longFeatureName);

      expect(mockSetMetadata).toHaveBeenCalledWith(FEATURE_KEY, longFeatureName);
    });

    it('should handle Unicode characters in feature names', () => {
      const unicodeFeatures = ['feature-🚀', 'feature-émoji', 'feature-中文', 'feature-العربية'];

      unicodeFeatures.forEach((featureName, index) => {
        RequireFeature(featureName);

        expect(mockSetMetadata).toHaveBeenNthCalledWith(index + 1, FEATURE_KEY, featureName);
      });
    });

    it('should handle null and undefined gracefully', () => {
      // TypeScript would normally prevent this, but test runtime behavior
      RequireFeature(null as unknown as string);
      RequireFeature(undefined as unknown as string);

      expect(mockSetMetadata).toHaveBeenNthCalledWith(1, FEATURE_KEY, null);
      expect(mockSetMetadata).toHaveBeenNthCalledWith(2, FEATURE_KEY, undefined);
    });
  });
});
