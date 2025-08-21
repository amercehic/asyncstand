import React, { useMemo, useCallback, useRef, useEffect } from 'react';

interface OptimizedProviderProps<T> {
  children: React.ReactNode;
  context: React.Context<T | undefined>;
  value: T;
  dependencies?: unknown[];
}

/**
 * Optimized context provider that prevents unnecessary re-renders
 * Uses stable references and memoization
 */
export function OptimizedProvider<T>({
  children,
  context: Context,
  value,
  dependencies = [],
}: OptimizedProviderProps<T>) {
  // Use ref to track previous value for comparison
  const previousValueRef = useRef<T>(value);

  // Memoize the context value based on dependencies
  const memoizedValue = useMemo(() => {
    // Deep equality check could be added here if needed
    const hasChanged = dependencies.some(
      (dep, index) => dep !== previousValueRef.current?.[index as keyof T]
    );

    if (hasChanged) {
      previousValueRef.current = value;
    }

    return previousValueRef.current;
  }, [value, ...dependencies]);

  return <Context.Provider value={memoizedValue}>{children}</Context.Provider>;
}

/**
 * Hook for creating optimized context with automatic memoization
 */
export function createOptimizedContext<T>(displayName: string) {
  const Context = React.createContext<T | undefined>(undefined);
  Context.displayName = displayName;

  const useContext = () => {
    const context = React.useContext(Context);
    if (!context) {
      throw new Error(`use${displayName} must be used within ${displayName}Provider`);
    }
    return context;
  };

  return [Context, useContext] as const;
}

/**
 * Hook for stable callback references in contexts
 */
export function useStableCallback<T extends (...args: never[]) => unknown>(callback: T): T {
  const callbackRef = useRef<T>(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  return useCallback(((...args) => callbackRef.current(...args)) as T, []);
}

/**
 * Context value selector hook for fine-grained subscriptions
 */
export function useContextSelector<TContext, TSelected>(
  context: React.Context<TContext>,
  selector: (value: TContext) => TSelected
): TSelected {
  const contextValue = React.useContext(context);

  if (!contextValue) {
    throw new Error('Context value is undefined');
  }

  // Use ref to track previous selected value
  const selectedRef = useRef<TSelected | undefined>(undefined);
  const selectorRef = useRef(selector);

  // Update selector ref
  useEffect(() => {
    selectorRef.current = selector;
  });

  // Memoize selected value
  const selected = useMemo(() => {
    const newSelected = selectorRef.current(contextValue);

    // Simple equality check - could be enhanced with deep equality
    if (selectedRef.current !== newSelected) {
      selectedRef.current = newSelected;
    }

    return selectedRef.current as TSelected;
  }, [contextValue]);

  return selected;
}
