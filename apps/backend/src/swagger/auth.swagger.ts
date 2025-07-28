import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { SignupDto } from '@/auth/dto/signup.dto';
import { LoginDto } from '@/auth/dto/login.dto';
import { ForgotPasswordDto } from '@/auth/dto/forgot-password.dto';
import { ResetPasswordDto } from '@/auth/dto/reset-password.dto';

export const SwaggerSignup = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Register a new user account',
      description:
        'Creates a new user account with email, password, and optional name. Supports organization invitation via invitation token. The password must meet strong security requirements including uppercase, lowercase, numbers, and special characters.',
    }),
    ApiBody({ type: SignupDto }),
    ApiResponse({
      status: 201,
      description: 'User successfully registered',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
          email: { type: 'string', example: 'user@example.com' },
          name: { type: 'string', example: 'John Doe' },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Bad request - validation failed',
    }),
    ApiResponse({
      status: 409,
      description: 'Conflict - user already exists',
    }),
  );

export const SwaggerLogin = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Authenticate user and get access token',
      description:
        'Authenticates a user with email and password. Returns a JWT access token for API authorization and sets a secure HTTP-only refresh token cookie. The access token should be included in subsequent requests as a Bearer token in the Authorization header.',
    }),
    ApiBody({ type: LoginDto }),
    ApiResponse({
      status: 200,
      description: 'User successfully authenticated',
      schema: {
        type: 'object',
        properties: {
          accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          expiresIn: { type: 'number', example: 900 },
          refreshToken: { type: 'string', example: 'refresh-token-value' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
              email: { type: 'string', example: 'user@example.com' },
              name: { type: 'string', example: 'John Doe' },
              role: { type: 'string', example: 'OWNER' },
            },
          },
          organization: {
            type: 'object',
            properties: {
              id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
              name: { type: 'string', example: 'Primary Organization' },
            },
          },
          organizations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
                name: { type: 'string', example: 'Organization Name' },
                role: { type: 'string', example: 'OWNER' },
                isPrimary: { type: 'boolean', example: true },
              },
            },
            example: [
              {
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Primary Organization',
                role: 'OWNER',
                isPrimary: true,
              },
              {
                id: '456e7890-e89b-12d3-a456-426614174000',
                name: 'Secondary Organization',
                role: 'MEMBER',
                isPrimary: false,
              },
            ],
          },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Bad request - validation failed',
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - invalid credentials',
    }),
  );

export const SwaggerLogout = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Logout user and invalidate refresh token',
      description:
        'Logs out the current user by invalidating the refresh token. Accepts the refresh token from either the request body or HTTP-only cookie. Clears the refresh token cookie and prevents further use of the token for authentication.',
    }),
    ApiResponse({
      status: 200,
      description: 'User successfully logged out',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Successfully logged out' },
          success: { type: 'boolean', example: true },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Bad request - refresh token required',
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - invalid refresh token',
    }),
  );

export const SwaggerForgotPassword = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Request password reset link via email',
      description:
        "Initiates the password reset process by sending a secure reset link to the user's email address. The link contains a time-limited token that can be used to reset the password. This endpoint is rate-limited to prevent abuse.",
    }),
    ApiBody({ type: ForgotPasswordDto }),
    ApiResponse({
      status: 200,
      description: 'Password reset link sent successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Password reset link has been sent to your email.' },
          success: { type: 'boolean', example: true },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Bad request - validation failed',
    }),
    ApiResponse({
      status: 429,
      description: 'Too many requests - rate limited',
    }),
  );

export const SwaggerResetPassword = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Reset password using token from email',
      description:
        "Resets the user's password using a valid reset token received via email. Requires the token, new password, and email address for verification. The token expires after a limited time for security. The new password must meet the same strong password requirements as account creation.",
    }),
    ApiBody({ type: ResetPasswordDto }),
    ApiResponse({
      status: 200,
      description: 'Password successfully reset',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Password has been successfully reset.' },
          success: { type: 'boolean', example: true },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Bad request - validation failed',
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - invalid or expired token',
    }),
  );
