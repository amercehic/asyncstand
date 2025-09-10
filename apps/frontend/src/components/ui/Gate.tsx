import React from 'react';
import { useFlag } from '@/contexts/FlagsProvider';

interface GateProps {
  /**
   * Feature flag key to check
   */
  flag: string;
  /**
   * Children to render when flag is enabled
   */
  children: React.ReactNode;
  /**
   * Optional fallback content when flag is disabled
   */
  fallback?: React.ReactNode;
  /**
   * Invert the gate logic (render when flag is disabled)
   */
  invert?: boolean;
  /**
   * Show debug info in development
   */
  debug?: boolean;
}

/**
 * Gate component that conditionally renders children based on feature flags
 *
 * Prevents flicker by returning null when flag is disabled, avoiding
 * "appear then disappear" behavior
 */
export function Gate({
  flag,
  children,
  fallback = null,
  invert = false,
  debug = false,
}: GateProps) {
  const isEnabled = useFlag(flag);
  const shouldRender = invert ? !isEnabled : isEnabled;

  // Debug logging in development
  if (debug && process.env.NODE_ENV === 'development') {
    console.log(
      `Gate[${flag}]: enabled=${isEnabled}, shouldRender=${shouldRender}, invert=${invert}`
    );
  }

  if (shouldRender) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

/**
 * Multiple flags gate - all flags must be enabled
 */
interface MultiGateProps {
  /**
   * Array of flag keys that must ALL be enabled
   */
  flags: string[];
  /**
   * Children to render when all flags are enabled
   */
  children: React.ReactNode;
  /**
   * Optional fallback content when any flag is disabled
   */
  fallback?: React.ReactNode;
  /**
   * Logic mode: 'and' (all must be true) or 'or' (any can be true)
   */
  mode?: 'and' | 'or';
  /**
   * Show debug info in development
   */
  debug?: boolean;
}

/**
 * Gate for multiple flags with AND/OR logic
 */
export function MultiGate({
  flags,
  children,
  fallback = null,
  mode = 'and',
  debug = false,
}: MultiGateProps) {
  // Get all flag values
  const flagValues = flags.map(flag => ({ flag, enabled: useFlag(flag) }));

  // Calculate result based on mode
  const shouldRender =
    mode === 'and'
      ? flagValues.every(({ enabled }) => enabled)
      : flagValues.some(({ enabled }) => enabled);

  // Debug logging in development
  if (debug && process.env.NODE_ENV === 'development') {
    console.log(`MultiGate[${mode}]:`, flagValues, 'shouldRender:', shouldRender);
  }

  if (shouldRender) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

/**
 * Experimental feature gate with A/B test support
 */
interface ExperimentGateProps {
  /**
   * Experiment flag key
   */
  experiment: string;
  /**
   * Content for treatment group (flag enabled)
   */
  treatment: React.ReactNode;
  /**
   * Content for control group (flag disabled)
   */
  control: React.ReactNode;
  /**
   * Force a specific variant (for testing)
   */
  forceVariant?: 'treatment' | 'control';
  /**
   * Show debug info in development
   */
  debug?: boolean;
}

/**
 * A/B experiment gate that renders different content based on flag state
 */
export function ExperimentGate({
  experiment,
  treatment,
  control,
  forceVariant,
  debug = false,
}: ExperimentGateProps) {
  const isEnabled = useFlag(experiment);

  // Allow forcing variant for testing
  const variant = forceVariant || (isEnabled ? 'treatment' : 'control');

  // Debug logging in development
  if (debug && process.env.NODE_ENV === 'development') {
    console.log(`ExperimentGate[${experiment}]: variant=${variant}, forced=${!!forceVariant}`);
  }

  return variant === 'treatment' ? <>{treatment}</> : <>{control}</>;
}

/**
 * Development-only gate (only renders in development)
 */
interface DevGateProps {
  children: React.ReactNode;
  /**
   * Also check a feature flag in addition to NODE_ENV
   */
  flag?: string;
}

/**
 * Gate that only renders in development environment
 */
export function DevGate({ children, flag }: DevGateProps) {
  const isDev = process.env.NODE_ENV === 'development';
  const flagEnabled = flag ? useFlag(flag) : true;

  if (isDev && flagEnabled) {
    return <>{children}</>;
  }

  return null;
}

/**
 * Role-based gate that works with feature flags
 */
interface RoleGateProps {
  /**
   * Required roles (user must have at least one)
   */
  roles: string[];
  /**
   * User's current role
   */
  userRole?: string;
  /**
   * Optional feature flag that must also be enabled
   */
  flag?: string;
  /**
   * Children to render when authorized
   */
  children: React.ReactNode;
  /**
   * Fallback when not authorized
   */
  fallback?: React.ReactNode;
}

/**
 * Combined role and feature flag gate
 */
export function RoleGate({ roles, userRole, flag, children, fallback = null }: RoleGateProps) {
  const hasRole = userRole && roles.includes(userRole);
  const flagEnabled = flag ? useFlag(flag) : true;

  if (hasRole && flagEnabled) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
