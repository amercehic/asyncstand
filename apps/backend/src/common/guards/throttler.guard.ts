import { Injectable, ExecutionContext } from '@nestjs/common';
import {
  ThrottlerGuard,
  ThrottlerException,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { LoggerService } from '@/common/logger.service';

interface RequestWithUser extends Request {
  user?: {
    id?: string;
    organizationId?: string;
  };
}

interface ThrottlerRequestProps {
  context: ExecutionContext;
  limit: number;
  ttl: number;
  throttler: { name?: string };
}

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    protected readonly logger: LoggerService,
  ) {
    super(options, storageService, reflector);
    this.logger.setContext(CustomThrottlerGuard.name);
  }

  protected handleRequest(requestProps: ThrottlerRequestProps): Promise<boolean> {
    const request = requestProps.context.switchToHttp().getRequest() as RequestWithUser;
    const response = requestProps.context.switchToHttp().getResponse();

    // Convert our interface to the expected ThrottlerRequest format
    const throttlerRequest = {
      ...requestProps,
      blockDuration: 0,
      getTracker: () => this.getTracker(request as unknown as Record<string, unknown>),
      generateKey: (suffix: string) => this.generateKey(requestProps.context, suffix, 'default'),
      throttler: {
        ...requestProps.throttler,
        limit: requestProps.limit,
        ttl: requestProps.ttl,
      },
    };

    try {
      // Type assertion needed due to NestJS throttler internal interface mismatch
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return super.handleRequest(throttlerRequest as any);
    } catch (error) {
      if (error instanceof ThrottlerException) {
        // Log rate limit exceeded
        this.logger.warn('Rate limit exceeded', {
          ip: request.ip,
          userAgent: request.get('user-agent'),
          userId: request.user?.id,
          organizationId: request.user?.organizationId,
          endpoint: `${request.method} ${request.path}`,
          limit: requestProps.limit,
          ttl: requestProps.ttl,
          throttlerName: requestProps.throttler.name || 'default',
        });

        // Add rate limit headers
        response.header('X-RateLimit-Limit', requestProps.limit);
        response.header('X-RateLimit-Remaining', '0');
        response.header('X-RateLimit-Reset', new Date(Date.now() + requestProps.ttl * 1000));
      }
      throw error;
    }
  }

  protected generateKey(context: ExecutionContext, suffix: string, name: string): string {
    const request = context.switchToHttp().getRequest() as RequestWithUser;

    // Create a unique key that considers:
    // 1. IP address for anonymous users
    // 2. User ID for authenticated users
    // 3. Organization ID for organization-scoped limits
    // 4. Endpoint for endpoint-specific limits

    const ip = request.ip;
    const userId = request.user?.id;
    const orgId = request.user?.organizationId;
    const endpoint = `${request.method}:${request.route?.path || request.path}`;

    // For authenticated users, use user-based limiting
    if (userId) {
      return `throttle:${name}:user:${userId}:${orgId}:${endpoint}${suffix}`;
    }

    // For anonymous users, use IP-based limiting
    return `throttle:${name}:ip:${ip}:${endpoint}${suffix}`;
  }

  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    // Custom tracker that considers authentication status
    const user = req.user as { id?: string } | undefined;
    const userId = user?.id;
    if (userId) {
      return `user:${userId}`;
    }
    return (req.ip as string) || 'unknown';
  }
}
