import { applyDecorators } from '@nestjs/common';
import { Throttle as NestThrottle } from '@nestjs/throttler';

/**
 * Enhanced throttle decorator with predefined configurations
 */
export const Throttle = (config: ThrottleConfig) => {
  return applyDecorators(
    NestThrottle({
      default: {
        ttl: config.ttl,
        limit: config.limit,
      },
    }),
  );
};

/**
 * Predefined throttle configurations for common scenarios
 */
export const ThrottleConfig = {
  // Authentication endpoints - very strict
  AUTH_STRICT: {
    limit: 3,
    ttl: 60000, // 1 minute
  },

  // Login attempts - progressive limiting
  LOGIN: {
    limit: 5,
    ttl: 300000, // 5 minutes
  },

  // Password reset - prevent abuse
  PASSWORD_RESET: {
    limit: 2,
    ttl: 900000, // 15 minutes
  },

  // API endpoints - moderate limiting
  API_MODERATE: {
    limit: 30,
    ttl: 60000, // 1 minute
  },

  // Data modification - careful limiting
  WRITE_OPERATIONS: {
    limit: 10,
    ttl: 60000, // 1 minute
  },

  // File upload - strict due to resource usage
  FILE_UPLOAD: {
    limit: 5,
    ttl: 300000, // 5 minutes
  },

  // Search operations - prevent abuse
  SEARCH: {
    limit: 20,
    ttl: 60000, // 1 minute
  },

  // Integration webhooks - high volume but controlled
  WEBHOOK: {
    limit: 100,
    ttl: 60000, // 1 minute
  },

  // Public endpoints - very permissive
  PUBLIC: {
    limit: 60,
    ttl: 60000, // 1 minute
  },
} as const;

interface ThrottleConfig {
  limit: number;
  ttl: number;
}

/**
 * Convenience decorators for common scenarios
 */
export const AuthThrottle = () => Throttle(ThrottleConfig.AUTH_STRICT);
export const LoginThrottle = () => Throttle(ThrottleConfig.LOGIN);
export const PasswordResetThrottle = () => Throttle(ThrottleConfig.PASSWORD_RESET);
export const ApiThrottle = () => Throttle(ThrottleConfig.API_MODERATE);
export const WriteThrottle = () => Throttle(ThrottleConfig.WRITE_OPERATIONS);
export const SearchThrottle = () => Throttle(ThrottleConfig.SEARCH);
export const WebhookThrottle = () => Throttle(ThrottleConfig.WEBHOOK);
export const PublicThrottle = () => Throttle(ThrottleConfig.PUBLIC);
