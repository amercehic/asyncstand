// Common types used across the application

export type PageKey = 'landing' | 'login' | 'signup';

export interface NavigationProps {
  onNavigate?: (page: PageKey) => void;
}

// API Response types
export interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
  success: boolean;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

// Form types
export interface FormFieldError {
  [key: string]: string;
}

export interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface SignUpFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
}

// UI Component types
export interface ButtonVariant {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export interface FeatureItem {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

export interface StatItem {
  value: string;
  label: string;
}

// Theme types
export type Theme = 'light' | 'dark' | 'system';

// Event handler types
export type InputChangeHandler = (e: React.ChangeEvent<HTMLInputElement>) => void;
export type FormSubmitHandler = (e: React.FormEvent<HTMLFormElement>) => void;
export type ButtonClickHandler = (e: React.MouseEvent<HTMLButtonElement>) => void;
