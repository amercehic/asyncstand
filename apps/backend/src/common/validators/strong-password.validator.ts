import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Injectable } from '@nestjs/common';

export interface StrongPasswordOptions {
  minLength?: number;
  maxLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumbers?: boolean;
  requireSpecialChars?: boolean;
  specialCharsPattern?: string;
  forbiddenPasswords?: string[];
  forbiddenPatterns?: RegExp[];
  maxRepeatingChars?: number;
  noUserInfo?: boolean; // When implemented, would check against user info
}

interface PasswordStrengthResult {
  isValid: boolean;
  score: number; // 0-100
  feedback: string[];
  requirements: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    numbers: boolean;
    specialChars: boolean;
    notCommon: boolean;
    notRepeating: boolean;
  };
}

@ValidatorConstraint({ name: 'StrongPassword', async: false })
@Injectable()
export class StrongPasswordConstraint implements ValidatorConstraintInterface {
  private commonPasswords = [
    'password',
    'password123',
    '123456',
    '123456789',
    'qwerty',
    'abc123',
    'password1',
    'admin',
    'letmein',
    'welcome',
    'monkey',
    'dragon',
    'passw0rd',
    'master',
    'hello',
    'freedom',
    'sunshine',
    'iloveyou',
    'princess',
    'rockyou',
    'football',
    'baseball',
    'superman',
    'trustno1',
  ];

  validate(password: string, args: ValidationArguments): boolean {
    if (!password || typeof password !== 'string') {
      return false;
    }

    const options = (args.constraints[0] as StrongPasswordOptions) || {};
    const result = this.checkPasswordStrength(password, options);

    return result.isValid && result.score >= 70; // Require at least 70/100 score
  }

  defaultMessage(args: ValidationArguments): string {
    const options = (args.constraints[0] as StrongPasswordOptions) || {};
    const requirements = [];

    if (options.minLength !== undefined) {
      requirements.push(`at least ${options.minLength} characters`);
    }
    if (options.requireUppercase !== false) {
      requirements.push('uppercase letters');
    }
    if (options.requireLowercase !== false) {
      requirements.push('lowercase letters');
    }
    if (options.requireNumbers !== false) {
      requirements.push('numbers');
    }
    if (options.requireSpecialChars !== false) {
      requirements.push('special characters');
    }

    return `Password must contain ${requirements.join(', ')}`;
  }

  checkPasswordStrength(
    password: string,
    options: StrongPasswordOptions = {},
  ): PasswordStrengthResult {
    const opts = {
      minLength: 8,
      maxLength: 128,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      specialCharsPattern: '[!@#$%^&*()_+\\-=\\[\\]{};\':"\\\\|,.<>\\/?]',
      maxRepeatingChars: 3,
      forbiddenPasswords: this.commonPasswords,
      forbiddenPatterns: [
        /^(.)\1+$/, // All same character
        /^(..)\1+$/, // Repeating pairs
        /^(012|123|234|345|456|567|678|789|890)+$/, // Sequential numbers
        /^(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)+$/i, // Sequential letters
      ],
      ...options,
    };

    const result: PasswordStrengthResult = {
      isValid: false,
      score: 0,
      feedback: [],
      requirements: {
        length: false,
        uppercase: false,
        lowercase: false,
        numbers: false,
        specialChars: false,
        notCommon: false,
        notRepeating: false,
      },
    };

    let score = 0;

    // Check length
    if (password.length >= opts.minLength && password.length <= opts.maxLength) {
      result.requirements.length = true;
      score += 20;
    } else {
      result.feedback.push(
        `Password must be between ${opts.minLength} and ${opts.maxLength} characters`,
      );
    }

    // Check character types
    if (opts.requireUppercase) {
      if (/[A-Z]/.test(password)) {
        result.requirements.uppercase = true;
        score += 15;
      } else {
        result.feedback.push('Password must contain uppercase letters');
      }
    }

    if (opts.requireLowercase) {
      if (/[a-z]/.test(password)) {
        result.requirements.lowercase = true;
        score += 15;
      } else {
        result.feedback.push('Password must contain lowercase letters');
      }
    }

    if (opts.requireNumbers) {
      if (/[0-9]/.test(password)) {
        result.requirements.numbers = true;
        score += 15;
      } else {
        result.feedback.push('Password must contain numbers');
      }
    }

    if (opts.requireSpecialChars) {
      const specialCharsRegex = new RegExp(opts.specialCharsPattern);
      if (specialCharsRegex.test(password)) {
        result.requirements.specialChars = true;
        score += 15;
      } else {
        result.feedback.push('Password must contain special characters');
      }
    }

    // Check for common passwords
    const isCommonPassword = opts.forbiddenPasswords?.some((forbidden) =>
      password.toLowerCase().includes(forbidden.toLowerCase()),
    );

    if (!isCommonPassword) {
      result.requirements.notCommon = true;
      score += 10;
    } else {
      result.feedback.push('Password is too common');
    }

    // Check for forbidden patterns
    const hasForbiddenPattern = opts.forbiddenPatterns?.some((pattern) => pattern.test(password));

    if (!hasForbiddenPattern) {
      score += 5;
    } else {
      result.feedback.push('Password contains forbidden patterns');
    }

    // Check for repeating characters
    const hasRepeatingChars = this.hasRepeatingCharacters(password, opts.maxRepeatingChars);
    if (!hasRepeatingChars) {
      result.requirements.notRepeating = true;
      score += 5;
    } else {
      result.feedback.push(
        `Password has too many repeating characters (max ${opts.maxRepeatingChars})`,
      );
    }

    // Bonus points for complexity
    const uniqueChars = new Set(password).size;
    const complexityBonus = Math.min(10, (uniqueChars / password.length) * 10);
    score += complexityBonus;

    // Length bonus
    if (password.length > opts.minLength) {
      const lengthBonus = Math.min(10, (password.length - opts.minLength) * 2);
      score += lengthBonus;
    }

    result.score = Math.min(100, Math.round(score));
    result.isValid = score >= 70 && result.feedback.length === 0;

    // Add positive feedback
    if (result.score >= 90) {
      result.feedback.unshift('Excellent password strength');
    } else if (result.score >= 80) {
      result.feedback.unshift('Good password strength');
    } else if (result.score >= 70) {
      result.feedback.unshift('Acceptable password strength');
    } else {
      result.feedback.unshift('Weak password');
    }

    return result;
  }

  private hasRepeatingCharacters(password: string, maxRepeating: number): boolean {
    let count = 1;
    for (let i = 1; i < password.length; i++) {
      if (password[i] === password[i - 1]) {
        count++;
        if (count > maxRepeating) {
          return true;
        }
      } else {
        count = 1;
      }
    }
    return false;
  }
}

export function StrongPassword(
  options?: StrongPasswordOptions,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [options],
      validator: StrongPasswordConstraint,
    });
  };
}

/**
 * Basic password requirements (minimum security)
 */
export const PasswordBasic = (validationOptions?: ValidationOptions) =>
  StrongPassword(
    {
      minLength: 6,
      requireUppercase: false,
      requireSpecialChars: false,
    },
    validationOptions,
  );

/**
 * Standard password requirements (recommended)
 */
export const PasswordStandard = (validationOptions?: ValidationOptions) =>
  StrongPassword(
    {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: false,
    },
    validationOptions,
  );

/**
 * Strong password requirements (high security)
 */
export const PasswordStrong = (validationOptions?: ValidationOptions) =>
  StrongPassword(
    {
      minLength: 12,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      maxRepeatingChars: 2,
    },
    validationOptions,
  );
