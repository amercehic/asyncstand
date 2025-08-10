import type { LoginFormData, SignUpFormData } from '@/types';
import type { ValidationRule } from '@/hooks/useFormValidation';

export const loginValidationRules: ValidationRule<LoginFormData> = {
  email: value => {
    if (!value) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return 'Please enter a valid email address';
    }
    return undefined;
  },
  password: value => {
    if (!value) return 'Password is required';
    if (value.length < 6) {
      return 'Password must be at least 6 characters';
    }
    return undefined;
  },
};

export const signUpValidationRules: ValidationRule<SignUpFormData> = {
  name: value => {
    if (!value) return 'Name is required';
    if (value.length < 2) return 'Name must be at least 2 characters';
    return undefined;
  },
  email: value => {
    if (!value) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return 'Please enter a valid email address';
    }
    return undefined;
  },
  password: value => {
    if (!value) return 'Password is required';
    if (value.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(value)) return 'Password must contain an uppercase letter';
    if (!/[a-z]/.test(value)) return 'Password must contain a lowercase letter';
    if (!/\d/.test(value)) return 'Password must contain a number';
    return undefined;
  },
  agreeToTerms: value => {
    if (!value) return 'You must agree to the terms and conditions';
    return undefined;
  },
};

export const passwordRequirements = [
  { text: 'At least 8 characters', test: (pwd: string) => pwd.length >= 8 },
  { text: 'Contains uppercase letter', test: (pwd: string) => /[A-Z]/.test(pwd) },
  { text: 'Contains lowercase letter', test: (pwd: string) => /[a-z]/.test(pwd) },
  { text: 'Contains number', test: (pwd: string) => /\d/.test(pwd) },
];
