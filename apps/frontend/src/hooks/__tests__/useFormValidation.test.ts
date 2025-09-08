import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormValidation } from '@/hooks/useFormValidation';

interface TestFormData extends Record<string, unknown> {
  email: string;
  password: string;
  confirmPassword: string;
  age: number;
}

describe('useFormValidation', () => {
  const validationRules = {
    email: (value: unknown) => {
      if (!value) return 'Email is required';
      if (typeof value === 'string' && !/\S+@\S+\.\S+/.test(value)) return 'Email is invalid';
      return undefined;
    },
    password: (value: unknown) => {
      if (!value) return 'Password is required';
      if (typeof value === 'string' && value.length < 6)
        return 'Password must be at least 6 characters';
      return undefined;
    },
    confirmPassword: (value: unknown) => {
      if (!value) return 'Confirm password is required';
      return undefined;
    },
    age: (value: unknown) => {
      if (typeof value === 'number' && value < 18) return 'Must be 18 or older';
      return undefined;
    },
  };

  it('should initialize with empty errors', () => {
    const { result } = renderHook(() => useFormValidation<TestFormData>(validationRules));

    expect(result.current.errors).toEqual({});
  });

  it('should validate a single field', () => {
    const { result } = renderHook(() => useFormValidation<TestFormData>(validationRules));

    // Valid email
    expect(result.current.validateField('email', 'test@example.com')).toBeUndefined();

    // Invalid email
    expect(result.current.validateField('email', 'invalid-email')).toBe('Email is invalid');

    // Empty email
    expect(result.current.validateField('email', '')).toBe('Email is required');

    // Valid password
    expect(result.current.validateField('password', 'password123')).toBeUndefined();

    // Short password
    expect(result.current.validateField('password', '123')).toBe(
      'Password must be at least 6 characters'
    );

    // Valid age
    expect(result.current.validateField('age', 25)).toBeUndefined();

    // Invalid age
    expect(result.current.validateField('age', 16)).toBe('Must be 18 or older');
  });

  it('should validate entire form and return validity', () => {
    const { result } = renderHook(() => useFormValidation<TestFormData>(validationRules));

    const validData: TestFormData = {
      email: 'test@example.com',
      password: 'password123',
      confirmPassword: 'password123',
      age: 25,
    };

    const invalidData: TestFormData = {
      email: 'invalid-email',
      password: '123',
      confirmPassword: '',
      age: 16,
    };

    // Valid form
    let isValid: boolean;
    act(() => {
      isValid = result.current.validateForm(validData);
    });

    expect(isValid!).toBe(true);
    expect(result.current.errors).toEqual({});

    // Invalid form
    act(() => {
      isValid = result.current.validateForm(invalidData);
    });

    expect(isValid!).toBe(false);
    expect(result.current.errors).toEqual({
      email: 'Email is invalid',
      password: 'Password must be at least 6 characters',
      confirmPassword: 'Confirm password is required',
      age: 'Must be 18 or older',
    });
  });

  it('should clear specific field error', () => {
    const { result } = renderHook(() => useFormValidation<TestFormData>(validationRules));

    const invalidData: TestFormData = {
      email: 'invalid-email',
      password: '123',
      confirmPassword: '',
      age: 16,
    };

    // Set errors first
    act(() => {
      result.current.validateForm(invalidData);
    });

    expect(result.current.errors.email).toBe('Email is invalid');
    expect(result.current.errors.password).toBe('Password must be at least 6 characters');

    // Clear email error
    act(() => {
      result.current.clearFieldError('email');
    });

    expect(result.current.errors.email).toBe('');
    expect(result.current.errors.password).toBe('Password must be at least 6 characters');
  });

  it('should clear all errors', () => {
    const { result } = renderHook(() => useFormValidation<TestFormData>(validationRules));

    const invalidData: TestFormData = {
      email: 'invalid-email',
      password: '123',
      confirmPassword: '',
      age: 16,
    };

    // Set errors first
    act(() => {
      result.current.validateForm(invalidData);
    });

    expect(Object.keys(result.current.errors)).toHaveLength(4);

    // Clear all errors
    act(() => {
      result.current.clearAllErrors();
    });

    expect(result.current.errors).toEqual({});
  });

  it('should set custom errors', () => {
    const { result } = renderHook(() => useFormValidation<TestFormData>(validationRules));

    const customErrors = {
      email: 'Custom email error',
      password: 'Custom password error',
    };

    act(() => {
      result.current.setErrors(customErrors);
    });

    expect(result.current.errors).toEqual(customErrors);
  });

  it('should handle fields without validation rules', () => {
    const { result } = renderHook(() => useFormValidation<TestFormData>(validationRules));

    // Field not in rules should return undefined
    expect(
      result.current.validateField('nonExistentField' as keyof TestFormData, 'any value')
    ).toBeUndefined();
  });

  it('should handle validation rules that return undefined for valid values', () => {
    const { result } = renderHook(() => useFormValidation<TestFormData>(validationRules));

    const validData: TestFormData = {
      email: 'test@example.com',
      password: 'validpassword',
      confirmPassword: 'validpassword',
      age: 25,
    };

    let isValid: boolean;
    act(() => {
      isValid = result.current.validateForm(validData);
    });

    expect(isValid!).toBe(true);
    expect(result.current.errors).toEqual({});
  });

  it('should validate form with partial data', () => {
    const partialRules = {
      email: (value: unknown) => {
        if (!value) return 'Email is required';
        return undefined;
      },
    };

    const { result } = renderHook(() =>
      useFormValidation<Pick<TestFormData, 'email'>>(partialRules)
    );

    let isValid: boolean;
    act(() => {
      isValid = result.current.validateForm({ email: '' });
    });

    expect(isValid!).toBe(false);
    expect(result.current.errors.email).toBe('Email is required');

    act(() => {
      isValid = result.current.validateForm({ email: 'test@example.com' });
    });

    expect(isValid!).toBe(true);
    expect(result.current.errors).toEqual({});
  });
});
