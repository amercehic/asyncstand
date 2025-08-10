import { useState, useCallback } from 'react';
import type { FormFieldError } from '@/types';

export type ValidationRule<T> = {
  [K in keyof T]?: (value: T[K]) => string | undefined;
};

export function useFormValidation<T extends Record<string, unknown>>(rules: ValidationRule<T>) {
  const [errors, setErrors] = useState<FormFieldError>({});

  const validateField = useCallback(
    (field: keyof T, value: T[keyof T]): string | undefined => {
      const rule = rules[field];
      if (!rule) return undefined;

      return rule(value);
    },
    [rules]
  );

  const validateForm = useCallback(
    (data: T): boolean => {
      const newErrors: FormFieldError = {};
      let isValid = true;

      Object.keys(rules).forEach(key => {
        const field = key as keyof T;
        const error = validateField(field, data[field]);
        if (error) {
          newErrors[key] = error;
          isValid = false;
        }
      });

      setErrors(newErrors);
      return isValid;
    },
    [rules, validateField]
  );

  const clearFieldError = useCallback((field: keyof T) => {
    setErrors(prev => ({ ...prev, [field as string]: '' }));
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  return {
    errors,
    validateForm,
    validateField,
    clearFieldError,
    clearAllErrors,
    setErrors,
  };
}
