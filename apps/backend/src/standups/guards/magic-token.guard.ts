import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { MagicTokenService, MagicTokenPayload } from '@/standups/services/magic-token.service';
import { LoggerService } from '@/common/logger.service';

export interface RequestWithMagicToken extends Request {
  magicTokenPayload?: MagicTokenPayload;
}

@Injectable()
export class MagicTokenGuard implements CanActivate {
  constructor(
    private readonly magicTokenService: MagicTokenService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(MagicTokenGuard.name);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithMagicToken>();

    // Extract token from multiple sources
    const token = this.extractTokenFromRequest(request);

    if (!token || token.trim() === '') {
      this.logger.warn('Magic token not provided in request', {
        path: request.path,
        method: request.method,
      });
      throw new UnauthorizedException('Magic token is required');
    }

    try {
      // Validate the magic token
      const payload = await this.magicTokenService.validateMagicToken(token);

      if (!payload) {
        this.logger.warn('Invalid magic token provided', {
          path: request.path,
          method: request.method,
          tokenProvided: !!token,
        });
        throw new UnauthorizedException('Invalid or expired magic token');
      }

      // Attach the validated payload to the request
      request.magicTokenPayload = payload;

      this.logger.debug('Magic token validated successfully', {
        instanceId: payload.standupInstanceId,
        teamMemberId: payload.teamMemberId,
        orgId: payload.orgId,
        path: request.path,
      });

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error('Error validating magic token', {
        error: error instanceof Error ? error.message : String(error),
        path: request.path,
        method: request.method,
      });

      throw new UnauthorizedException('Token validation failed');
    }
  }

  /**
   * Extract magic token from various sources in request
   * Priority: Authorization header > Query parameter > Request body
   */
  private extractTokenFromRequest(request: RequestWithMagicToken): string | null {
    // 1. Check Authorization header (Bearer token)
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // 2. Check query parameter
    const queryToken = request.query.token as string;
    if (queryToken) {
      return queryToken;
    }

    // 3. Check request body (for POST requests)
    const bodyToken = (request.body as Record<string, unknown>)?.magicToken as string;
    if (bodyToken) {
      return bodyToken;
    }

    // 4. Check path parameter (for GET requests like /standup/respond/:token)
    const pathToken = request.params.token as string;
    if (pathToken) {
      return pathToken;
    }

    return null;
  }
}
