import { SetMetadata } from '@nestjs/common';
import { CSRF_PROTECTED_KEY, CSRF_SKIP_KEY } from '@/common/security/csrf.guard';

/**
 * Mark a controller method or class as requiring CSRF protection
 */
export const CsrfProtected = () => SetMetadata(CSRF_PROTECTED_KEY, true);

/**
 * Skip CSRF protection for a controller method or class
 * Use this carefully and only for endpoints that don't modify state
 */
export const SkipCsrf = () => SetMetadata(CSRF_SKIP_KEY, true);

/**
 * Decorator for endpoints that generate and return CSRF tokens
 * These endpoints should skip CSRF validation but generate tokens
 */
export const CsrfTokenEndpoint = () => SetMetadata(CSRF_SKIP_KEY, true);
