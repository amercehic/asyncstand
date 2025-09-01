import React from 'react';
import { useFeature } from '@/contexts/FeatureContext';

interface FeatureGateProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Component that conditionally renders children based on feature flag
 *
 * @example
 * <FeatureGate feature="advanced_analytics">
 *   <AdvancedAnalytics />
 * </FeatureGate>
 *
 * @example with fallback
 * <FeatureGate
 *   feature="ai_insights"
 *   fallback={<div>AI Insights coming soon!</div>}
 * >
 *   <AIInsights />
 * </FeatureGate>
 */
export const FeatureGate: React.FC<FeatureGateProps> = ({ feature, children, fallback = null }) => {
  const hasFeature = useFeature(feature);

  return <>{hasFeature ? children : fallback}</>;
};

interface MultiFeatureGateProps {
  features: string[];
  requireAll?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Component that conditionally renders based on multiple feature flags
 *
 * @example Require all features
 * <MultiFeatureGate features={["feature1", "feature2"]} requireAll>
 *   <Component />
 * </MultiFeatureGate>
 *
 * @example Require any feature
 * <MultiFeatureGate features={["feature1", "feature2"]}>
 *   <Component />
 * </MultiFeatureGate>
 */
export const MultiFeatureGate: React.FC<MultiFeatureGateProps> = ({
  features,
  requireAll = false,
  children,
  fallback = null,
}) => {
  const hasFeatures = features.map(f => useFeature(f));

  const shouldRender = requireAll ? hasFeatures.every(Boolean) : hasFeatures.some(Boolean);

  return <>{shouldRender ? children : fallback}</>;
};
