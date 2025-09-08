import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeatureGate, MultiFeatureGate } from '@/components/FeatureGate';

// Mock the useFeature hook
vi.mock('@/contexts/FeatureContext', () => ({
  useFeature: vi.fn(),
}));

const mockUseFeature = vi.mocked(await import('@/contexts/FeatureContext')).useFeature;

describe('FeatureGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render children when feature is enabled', () => {
    mockUseFeature.mockReturnValue(true);

    render(
      <FeatureGate feature="test-feature">
        <div>Feature content</div>
      </FeatureGate>
    );

    expect(screen.getByText('Feature content')).toBeInTheDocument();
    expect(mockUseFeature).toHaveBeenCalledWith('test-feature');
  });

  it('should not render children when feature is disabled', () => {
    mockUseFeature.mockReturnValue(false);

    render(
      <FeatureGate feature="test-feature">
        <div>Feature content</div>
      </FeatureGate>
    );

    expect(screen.queryByText('Feature content')).not.toBeInTheDocument();
    expect(mockUseFeature).toHaveBeenCalledWith('test-feature');
  });

  it('should render fallback when feature is disabled and fallback is provided', () => {
    mockUseFeature.mockReturnValue(false);

    render(
      <FeatureGate feature="test-feature" fallback={<div>Coming soon!</div>}>
        <div>Feature content</div>
      </FeatureGate>
    );

    expect(screen.queryByText('Feature content')).not.toBeInTheDocument();
    expect(screen.getByText('Coming soon!')).toBeInTheDocument();
  });

  it('should render nothing when feature is disabled and no fallback provided', () => {
    mockUseFeature.mockReturnValue(false);

    const { container } = render(
      <FeatureGate feature="test-feature">
        <div>Feature content</div>
      </FeatureGate>
    );

    expect(container.firstChild).toBeNull();
  });

  it('should handle multiple children', () => {
    mockUseFeature.mockReturnValue(true);

    render(
      <FeatureGate feature="test-feature">
        <div>First child</div>
        <div>Second child</div>
      </FeatureGate>
    );

    expect(screen.getByText('First child')).toBeInTheDocument();
    expect(screen.getByText('Second child')).toBeInTheDocument();
  });

  it('should handle complex JSX children', () => {
    mockUseFeature.mockReturnValue(true);

    render(
      <FeatureGate feature="advanced-analytics">
        <div>
          <h1>Analytics Dashboard</h1>
          <p>Complex analytics content</p>
        </div>
      </FeatureGate>
    );

    expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Complex analytics content')).toBeInTheDocument();
  });
});

describe('MultiFeatureGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render children when requireAll=true and all features are enabled', () => {
    mockUseFeature.mockImplementation((feature: string) => {
      return ['feature1', 'feature2', 'feature3'].includes(feature);
    });

    render(
      <MultiFeatureGate features={['feature1', 'feature2', 'feature3']} requireAll>
        <div>All features enabled</div>
      </MultiFeatureGate>
    );

    expect(screen.getByText('All features enabled')).toBeInTheDocument();
    expect(mockUseFeature).toHaveBeenCalledWith('feature1');
    expect(mockUseFeature).toHaveBeenCalledWith('feature2');
    expect(mockUseFeature).toHaveBeenCalledWith('feature3');
    expect(mockUseFeature).toHaveBeenCalledTimes(3);
  });

  it('should not render children when requireAll=true and some features are disabled', () => {
    mockUseFeature.mockImplementation((feature: string) => {
      return feature !== 'feature2'; // feature2 is disabled
    });

    render(
      <MultiFeatureGate features={['feature1', 'feature2', 'feature3']} requireAll>
        <div>All features enabled</div>
      </MultiFeatureGate>
    );

    expect(screen.queryByText('All features enabled')).not.toBeInTheDocument();
  });

  it('should render children when requireAll=false and at least one feature is enabled', () => {
    mockUseFeature.mockImplementation((feature: string) => {
      return feature === 'feature1'; // Only feature1 is enabled
    });

    render(
      <MultiFeatureGate features={['feature1', 'feature2', 'feature3']}>
        <div>Some features enabled</div>
      </MultiFeatureGate>
    );

    expect(screen.getByText('Some features enabled')).toBeInTheDocument();
  });

  it('should not render children when requireAll=false and no features are enabled', () => {
    mockUseFeature.mockReturnValue(false);

    render(
      <MultiFeatureGate features={['feature1', 'feature2', 'feature3']}>
        <div>Some features enabled</div>
      </MultiFeatureGate>
    );

    expect(screen.queryByText('Some features enabled')).not.toBeInTheDocument();
  });

  it('should render fallback when no features are enabled and fallback is provided', () => {
    mockUseFeature.mockReturnValue(false);

    render(
      <MultiFeatureGate
        features={['feature1', 'feature2']}
        fallback={<div>Features coming soon!</div>}
      >
        <div>Feature content</div>
      </MultiFeatureGate>
    );

    expect(screen.queryByText('Feature content')).not.toBeInTheDocument();
    expect(screen.getByText('Features coming soon!')).toBeInTheDocument();
  });

  it('should default requireAll to false', () => {
    mockUseFeature.mockImplementation((feature: string) => {
      return feature === 'feature1'; // Only feature1 is enabled
    });

    render(
      <MultiFeatureGate features={['feature1', 'feature2']}>
        <div>Content shown</div>
      </MultiFeatureGate>
    );

    expect(screen.getByText('Content shown')).toBeInTheDocument();
  });

  it('should handle empty features array', () => {
    render(
      <MultiFeatureGate features={[]}>
        <div>No features required</div>
      </MultiFeatureGate>
    );

    // With empty array, no features are checked, so some() returns false
    expect(screen.queryByText('No features required')).not.toBeInTheDocument();
    expect(mockUseFeature).not.toHaveBeenCalled();
  });

  it('should handle single feature', () => {
    mockUseFeature.mockReturnValue(true);

    render(
      <MultiFeatureGate features={['single-feature']}>
        <div>Single feature content</div>
      </MultiFeatureGate>
    );

    expect(screen.getByText('Single feature content')).toBeInTheDocument();
    expect(mockUseFeature).toHaveBeenCalledWith('single-feature');
    expect(mockUseFeature).toHaveBeenCalledTimes(1);
  });

  it('should handle complex scenarios with requireAll=true', () => {
    mockUseFeature.mockImplementation((feature: string) => {
      const enabledFeatures = ['analytics', 'reports', 'exports'];
      return enabledFeatures.includes(feature);
    });

    // All features enabled - should render
    render(
      <MultiFeatureGate features={['analytics', 'reports']} requireAll>
        <div>Analytics and reports enabled</div>
      </MultiFeatureGate>
    );

    expect(screen.getByText('Analytics and reports enabled')).toBeInTheDocument();
  });

  it('should handle complex scenarios with requireAll=false', () => {
    mockUseFeature.mockImplementation((feature: string) => {
      const enabledFeatures = ['analytics'];
      return enabledFeatures.includes(feature);
    });

    // Only analytics enabled, but that's enough with requireAll=false
    render(
      <MultiFeatureGate features={['analytics', 'reports', 'exports']}>
        <div>At least one feature enabled</div>
      </MultiFeatureGate>
    );

    expect(screen.getByText('At least one feature enabled')).toBeInTheDocument();
  });
});
