import {
  CanActivate,
  ExecutionContext,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LoggerService } from '@/common/logger.service';

const REQUEST_SIZE_LIMIT_KEY = 'request_size_limit';

/**
 * Decorator to set request size limit for an endpoint
 */
export const RequestSizeLimit = (sizeInBytes: number) =>
  Reflect.metadata(REQUEST_SIZE_LIMIT_KEY, sizeInBytes);

@Injectable()
export class RequestSizeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(RequestSizeGuard.name);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const sizeLimit =
      this.reflector.get<number>(REQUEST_SIZE_LIMIT_KEY, context.getHandler()) || 10 * 1024 * 1024; // Default 10MB

    const contentLength = parseInt(request.get('content-length') || '0', 10);

    if (contentLength > sizeLimit) {
      this.logger.warn('Request payload too large', {
        url: request.url,
        method: request.method,
        contentLength,
        sizeLimit,
        userAgent: request.get('user-agent'),
        ip: request.ip,
      });

      throw new PayloadTooLargeException(
        `Request payload too large. Maximum allowed size is ${sizeLimit} bytes.`,
      );
    }

    // Also check for potential JSON bomb attacks
    if (request.body && typeof request.body === 'object') {
      const bodyString = JSON.stringify(request.body);
      if (bodyString.length > sizeLimit) {
        this.logger.warn('Request body too large after parsing', {
          url: request.url,
          method: request.method,
          bodySize: bodyString.length,
          sizeLimit,
        });

        throw new PayloadTooLargeException('Request body too large');
      }

      // Check for deeply nested objects (potential DoS)
      const maxDepth = 10;
      if (this.getObjectDepth(request.body) > maxDepth) {
        this.logger.warn('Request body too deeply nested', {
          url: request.url,
          method: request.method,
          maxDepth,
        });

        throw new PayloadTooLargeException('Request body structure too complex');
      }
    }

    return true;
  }

  private getObjectDepth(obj: unknown, depth = 0): number {
    if (depth > 50) return depth; // Prevent stack overflow

    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      return (
        1 + Math.max(...Object.values(obj).map((value) => this.getObjectDepth(value, depth + 1)))
      );
    }

    if (Array.isArray(obj)) {
      return 1 + Math.max(...obj.map((item) => this.getObjectDepth(item, depth + 1)));
    }

    return 0;
  }
}
