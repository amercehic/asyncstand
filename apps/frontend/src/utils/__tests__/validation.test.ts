import { describe, it, expect } from 'vitest';
import {
  loginValidationRules,
  signUpValidationRules,
  passwordRequirements,
} from '@/utils/validation';

describe('loginValidationRules', () => {
  describe('email validation', () => {
    it('should return error for empty email', () => {
      expect(loginValidationRules.email?.('')).toBe('Email is required');
    });

    it('should return error for invalid email format', () => {
      expect(loginValidationRules.email?.('invalid-email')).toBe(
        'Please enter a valid email address'
      );
      expect(loginValidationRules.email?.('@example.com')).toBe(
        'Please enter a valid email address'
      );
      expect(loginValidationRules.email?.('test@')).toBe('Please enter a valid email address');
      expect(loginValidationRules.email?.('test@example')).toBe(
        'Please enter a valid email address'
      );
      expect(loginValidationRules.email?.('test.example.com')).toBe(
        'Please enter a valid email address'
      );
    });

    it('should pass for valid email', () => {
      expect(loginValidationRules.email?.('test@example.com')).toBeUndefined();
      expect(loginValidationRules.email?.('user.name+tag@example.co.uk')).toBeUndefined();
      expect(loginValidationRules.email?.('test123@domain-name.com')).toBeUndefined();
    });
  });

  describe('password validation', () => {
    it('should return error for empty password', () => {
      expect(loginValidationRules.password?.('')).toBe('Password is required');
    });

    it('should return error for short password', () => {
      expect(loginValidationRules.password?.('12345')).toBe(
        'Password must be at least 6 characters'
      );
      expect(loginValidationRules.password?.('abc')).toBe('Password must be at least 6 characters');
    });

    it('should pass for valid password', () => {
      expect(loginValidationRules.password?.('123456')).toBeUndefined();
      expect(loginValidationRules.password?.('password123')).toBeUndefined();
      expect(loginValidationRules.password?.('MySecurePass!')).toBeUndefined();
    });
  });
});

describe('signUpValidationRules', () => {
  describe('name validation', () => {
    it('should return error for empty name', () => {
      expect(signUpValidationRules.name?.('')).toBe('Name is required');
    });

    it('should return error for short name', () => {
      expect(signUpValidationRules.name?.('a')).toBe('Name must be at least 2 characters');
    });

    it('should pass for valid name', () => {
      expect(signUpValidationRules.name?.('John')).toBeUndefined();
      expect(signUpValidationRules.name?.('Jane Doe')).toBeUndefined();
      expect(signUpValidationRules.name?.('Li')).toBeUndefined();
    });
  });

  describe('email validation', () => {
    it('should return error for empty email', () => {
      expect(signUpValidationRules.email?.('')).toBe('Email is required');
    });

    it('should return error for invalid email format', () => {
      expect(signUpValidationRules.email?.('invalid-email')).toBe(
        'Please enter a valid email address'
      );
    });

    it('should pass for valid email', () => {
      expect(signUpValidationRules.email?.('test@example.com')).toBeUndefined();
    });
  });

  describe('password validation', () => {
    it('should return error for empty password', () => {
      expect(signUpValidationRules.password?.('')).toBe('Password is required');
    });

    it('should return error for short password', () => {
      expect(signUpValidationRules.password?.('1234567')).toBe(
        'Password must be at least 8 characters'
      );
    });

    it('should return error for password without uppercase letter', () => {
      expect(signUpValidationRules.password?.('password123')).toBe(
        'Password must contain an uppercase letter'
      );
    });

    it('should return error for password without lowercase letter', () => {
      expect(signUpValidationRules.password?.('PASSWORD123')).toBe(
        'Password must contain a lowercase letter'
      );
    });

    it('should return error for password without number', () => {
      expect(signUpValidationRules.password?.('Password')).toBe('Password must contain a number');
    });

    it('should pass for valid password', () => {
      expect(signUpValidationRules.password?.('Password123')).toBeUndefined();
      expect(signUpValidationRules.password?.('MySecure1Pass')).toBeUndefined();
      expect(signUpValidationRules.password?.('P@ssw0rd')).toBeUndefined();
    });
  });

  describe('agreeToTerms validation', () => {
    it('should return error when not agreed', () => {
      expect(signUpValidationRules.agreeToTerms?.(false)).toBe(
        'You must agree to the terms and conditions'
      );
    });

    it('should pass when agreed', () => {
      expect(signUpValidationRules.agreeToTerms?.(true)).toBeUndefined();
    });
  });
});

describe('passwordRequirements', () => {
  it('should have correct requirement tests', () => {
    const requirements = passwordRequirements;

    // Test length requirement
    expect(requirements[0].test('1234567')).toBe(false);
    expect(requirements[0].test('12345678')).toBe(true);

    // Test uppercase requirement
    expect(requirements[1].test('password')).toBe(false);
    expect(requirements[1].test('Password')).toBe(true);

    // Test lowercase requirement
    expect(requirements[2].test('PASSWORD')).toBe(false);
    expect(requirements[2].test('Password')).toBe(true);

    // Test number requirement
    expect(requirements[3].test('Password')).toBe(false);
    expect(requirements[3].test('Password1')).toBe(true);
  });

  it('should have correct requirement texts', () => {
    expect(passwordRequirements[0].text).toBe('At least 8 characters');
    expect(passwordRequirements[1].text).toBe('Contains uppercase letter');
    expect(passwordRequirements[2].text).toBe('Contains lowercase letter');
    expect(passwordRequirements[3].text).toBe('Contains number');
  });

  it('should validate complex passwords', () => {
    const validPassword = 'MySecure1Pass';
    const invalidPassword = 'weak';

    expect(
      passwordRequirements.every((req: { text: string; test: (pwd: string) => boolean }) =>
        req.test(validPassword)
      )
    ).toBe(true);
    expect(
      passwordRequirements.every((req: { text: string; test: (pwd: string) => boolean }) =>
        req.test(invalidPassword)
      )
    ).toBe(false);
  });
});
