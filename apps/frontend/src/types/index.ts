// Re-export all types for easier imports
export * from '@/types/common';
export * from '@/types/api';
export * from '@/types/standup-metrics';

// Utility types
export type Nullable<T> = T | null;
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;

// React component props helpers
export type PropsWithClassName<T = object> = T & { className?: string };
export type PropsWithChildren<T = object> = T & { children: React.ReactNode };
export type PropsWithOptionalChildren<T = object> = T & { children?: React.ReactNode };
