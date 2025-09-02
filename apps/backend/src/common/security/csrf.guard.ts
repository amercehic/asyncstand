import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { CsrfService } from '@/common/security/csrf.service';
import { ConfigService } from '@nestjs/config';
import { SessionIdentifierService } from '@/common/session/session-identifier.service';

interface RequestWithUser extends Request {
  user?: {
    id?: string;
    organizationId?: string;
  };
  session?: {
    id?: string;
  };
}
import { LoggerService } from '@/common/logger.service';

export const CSRF_PROTECTED_KEY = 'csrf_protected';
export const CSRF_SKIP_KEY = 'csrf_skip';

@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly publicAuthEndpoints: string[];

  constructor(
    private readonly csrfService: CsrfService,
    private readonly reflector: Reflector,
    private readonly logger: LoggerService,
    private readonly configService: ConfigService,
    private readonly sessionIdentifierService: SessionIdentifierService,
  ) {
    this.logger.setContext(CsrfGuard.name);

    // Parse public auth endpoints from environment variables
    const envEndpoints = this.configService.get<string>('CSRF_PUBLIC_ENDPOINTS', '');
    const defaultEndpoints = ['/auth/signup', '/auth/forgot-password', '/auth/reset-password'];

    this.publicAuthEndpoints = envEndpoints
      ? envEndpoints
          .split(',')
          .map((path) => path.trim())
          .filter(Boolean)
      : defaultEndpoints;

    this.logger.debug(`CSRF public endpoints configured: ${this.publicAuthEndpoints.join(', ')}`);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Skip CSRF protection in test environment
    if (process.env.NODE_ENV === 'test') {
      return true;
    }

    // Check if CSRF protection is explicitly skipped
    const skipCsrf = this.reflector.getAllAndOverride<boolean>(CSRF_SKIP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipCsrf) {
      return true;
    }

    // Check if CSRF protection is explicitly enabled
    const csrfProtected = this.reflector.getAllAndOverride<boolean>(CSRF_PROTECTED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Only protect state-changing methods by default, or if explicitly marked
    const method = request.method.toLowerCase();
    const needsCsrfProtection =
      csrfProtected || ['post', 'put', 'patch', 'delete'].includes(method);

    if (!needsCsrfProtection) {
      return true;
    }

    // Check if this is a public auth endpoint that doesn't require sessions
    const isPublicAuthEndpoint = this.publicAuthEndpoints.includes(request.path);

    // For public auth endpoints, skip CSRF since there's no session to protect
    if (isPublicAuthEndpoint) {
      this.logger.debug('Skipping CSRF for public auth endpoint', {
        path: request.path,
        method: request.method,
      });
      return true;
    }

    // Get session ID using the centralized service
    const sessionId = this.sessionIdentifierService.extractSessionId(request);
    if (!sessionId) {
      this.logger.warn('CSRF check failed: no session ID', {
        method: request.method,
        path: request.path,
        ip: request.ip,
        userAgent: request.get('user-agent'),
      });

      throw new BadRequestException({
        error: 'CSRF_NO_SESSION',
        message: 'No session found for CSRF validation',
        statusCode: 400,
      });
    }

    // Extract CSRF token from request
    const csrfToken = this.extractCsrfToken(request);
    if (!csrfToken) {
      this.logger.warn('CSRF check failed: no token provided', {
        method: request.method,
        path: request.path,
        sessionId,
        ip: request.ip,
        userAgent: request.get('user-agent'),
      });

      throw new ForbiddenException({
        error: 'CSRF_TOKEN_MISSING',
        message: 'CSRF token is required for this operation',
        statusCode: 403,
      });
    }

    // Validate the CSRF token
    try {
      const isValid = await this.csrfService.validateToken(sessionId, csrfToken, false);

      if (!isValid) {
        this.logger.warn('CSRF validation failed', {
          method: request.method,
          path: request.path,
          sessionId,
          tokenProvided: !!csrfToken,
          ip: request.ip,
          userAgent: request.get('user-agent'),
          userId: (request as RequestWithUser).user?.id,
        });

        throw new ForbiddenException({
          error: 'CSRF_TOKEN_INVALID',
          message: 'Invalid CSRF token',
          statusCode: 403,
        });
      }

      // Log successful validation
      this.logger.debug('CSRF validation successful', {
        method: request.method,
        path: request.path,
        sessionId,
        userId: (request as RequestWithUser).user?.id,
      });

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error('CSRF validation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        method: request.method,
        path: request.path,
        sessionId,
      });

      throw new ForbiddenException({
        error: 'CSRF_VALIDATION_ERROR',
        message: 'CSRF token validation failed',
        statusCode: 403,
      });
    }
  }

  /**
   * Extract CSRF token from various sources
   */
  private extractCsrfToken(request: Request): string | null {
    // Try to extract CSRF token from various locations:
    // 1. X-CSRF-Token header (most common)
    // 2. X-XSRF-TOKEN header (Angular default)
    // 3. _csrf body parameter
    // 4. csrf_token body parameter

    const token =
      request.headers['x-csrf-token'] ||
      request.headers['x-xsrf-token'] ||
      request.body?._csrf ||
      request.body?.csrf_token ||
      request.query?.csrf_token;

    return typeof token === 'string' ? token : null;
  }
}
