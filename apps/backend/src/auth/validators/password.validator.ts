import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  ValidationOptions,
  registerDecorator,
} from 'class-validator';

@ValidatorConstraint({ name: 'IsStrongPassword', async: false })
export class IsStrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(password: string) {
    // Skip validation if password is empty - let @IsNotEmpty handle that
    if (!password || password.length === 0) return true;

    // Check minimum length
    if (password.length < 8) {
      return false;
    }

    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      return false;
    }

    // Check for at least one lowercase letter
    if (!/[a-z]/.test(password)) {
      return false;
    }

    // Check for at least one number
    if (!/\d/.test(password)) {
      return false;
    }

    // Check for at least one special character
    if (!/[@$!%*?&]/.test(password)) {
      return false;
    }

    return true;
  }

  defaultMessage(args: ValidationArguments) {
    const password = args.value as string;

    // Skip message if password is empty - let @IsNotEmpty handle that
    if (!password || password.length === 0) {
      return '';
    }

    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('at least 8 characters');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('one number');
    }

    if (!/[@$!%*?&]/.test(password)) {
      errors.push('one special character (@$!%*?&)');
    }

    return `Password must contain ${errors.join(', ')}`;
  }
}

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsStrongPasswordConstraint,
    });
  };
}
