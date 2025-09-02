import { validate } from 'class-validator';
import { SignupDto } from '@/auth/dto/signup.dto';
import { LoginDto } from '@/auth/dto/login.dto';
import { ForgotPasswordDto } from '@/auth/dto/forgot-password.dto';
import { InviteMemberDto } from '@/auth/dto/invite-member.dto';
import { ResetPasswordDto } from '@/auth/dto/reset-password.dto';
import { OrgRole } from '@prisma/client';

describe('Email Validation Messages', () => {
  describe('SignupDto', () => {
    it('should provide helpful error message for invalid email', async () => {
      const dto = new SignupDto();
      dto.email = 'invalid-email';
      dto.password = 'ValidPassword123!';
      dto.name = 'Test User';

      const errors = await validate(dto);
      const emailError = errors.find((error) => error.property === 'email');

      expect(emailError).toBeDefined();
      expect(emailError?.constraints?.isEmail).toBe(
        'Please provide a valid email address (e.g., user@example.com)',
      );
    });

    it('should provide helpful error message for missing email', async () => {
      const dto = new SignupDto();
      dto.password = 'ValidPassword123!';
      dto.name = 'Test User';

      const errors = await validate(dto);
      const emailError = errors.find((error) => error.property === 'email');

      expect(emailError).toBeDefined();
      expect(emailError?.constraints?.isNotEmpty).toBe('Email is required');
    });

    it('should accept valid email', async () => {
      const dto = new SignupDto();
      dto.email = 'test@example.com';
      dto.password = 'ValidPassword123!';
      dto.name = 'Test User';

      const errors = await validate(dto);
      const emailError = errors.find((error) => error.property === 'email');

      expect(emailError).toBeUndefined();
    });
  });

  describe('LoginDto', () => {
    it('should provide helpful error message for invalid email', async () => {
      const dto = new LoginDto();
      dto.email = 'not-an-email';
      dto.password = 'password123';

      const errors = await validate(dto);
      const emailError = errors.find((error) => error.property === 'email');

      expect(emailError).toBeDefined();
      expect(emailError?.constraints?.isEmail).toBe(
        'Please provide a valid email address (e.g., user@example.com)',
      );
    });
  });

  describe('ForgotPasswordDto', () => {
    it('should provide helpful error message for invalid email', async () => {
      const dto = new ForgotPasswordDto();
      dto.email = 'invalid@';

      const errors = await validate(dto);
      const emailError = errors.find((error) => error.property === 'email');

      expect(emailError).toBeDefined();
      expect(emailError?.constraints?.isEmail).toBe(
        'Please provide a valid email address (e.g., user@example.com)',
      );
    });
  });

  describe('InviteMemberDto', () => {
    it('should provide helpful error message for invalid email', async () => {
      const dto = new InviteMemberDto();
      dto.email = '@example.com';
      dto.role = OrgRole.member;

      const errors = await validate(dto);
      const emailError = errors.find((error) => error.property === 'email');

      expect(emailError).toBeDefined();
      expect(emailError?.constraints?.isEmail).toBe(
        'Please provide a valid email address (e.g., john.doe@example.com)',
      );
    });
  });

  describe('ResetPasswordDto', () => {
    it('should provide helpful error message for invalid email', async () => {
      const dto = new ResetPasswordDto();
      dto.token = 'valid-token';
      dto.password = 'newPassword123!';
      dto.email = 'user@';

      const errors = await validate(dto);
      const emailError = errors.find((error) => error.property === 'email');

      expect(emailError).toBeDefined();
      expect(emailError?.constraints?.isEmail).toBe(
        'Please provide a valid email address (e.g., user@example.com)',
      );
    });

    it('should now validate email format (previously only checked if string)', async () => {
      const dto = new ResetPasswordDto();
      dto.token = 'valid-token';
      dto.password = 'newPassword123!';
      dto.email = 'not-an-email-at-all';

      const errors = await validate(dto);
      const emailError = errors.find((error) => error.property === 'email');

      expect(emailError).toBeDefined();
      expect(emailError?.constraints?.isEmail).toBe(
        'Please provide a valid email address (e.g., user@example.com)',
      );
    });
  });

  describe('Common Invalid Email Formats', () => {
    const testCases = [
      'plaintext',
      '@domain.com',
      'user@',
      'user..double.dot@domain.com',
      'user @domain.com', // space
      'user@domain',
      'user@.com',
      '',
      ' ',
    ];

    testCases.forEach((invalidEmail) => {
      it(`should reject invalid email: "${invalidEmail}"`, async () => {
        const dto = new LoginDto();
        dto.email = invalidEmail;
        dto.password = 'password123';

        const errors = await validate(dto);
        const emailError = errors.find((error) => error.property === 'email');

        expect(emailError).toBeDefined();
        if (invalidEmail === '') {
          expect(emailError?.constraints?.isNotEmpty).toBe('Email is required');
        } else {
          expect(emailError?.constraints?.isEmail).toBe(
            'Please provide a valid email address (e.g., user@example.com)',
          );
        }
      });
    });
  });

  describe('Valid Email Formats', () => {
    const testCases = [
      'user@example.com',
      'test.email@domain.org',
      'user+tag@example.co.uk',
      'firstname.lastname@company.com',
      'user123@test-domain.com',
    ];

    testCases.forEach((validEmail) => {
      it(`should accept valid email: "${validEmail}"`, async () => {
        const dto = new LoginDto();
        dto.email = validEmail;
        dto.password = 'password123';

        const errors = await validate(dto);
        const emailError = errors.find((error) => error.property === 'email');

        expect(emailError).toBeUndefined();
      });
    });
  });
});
