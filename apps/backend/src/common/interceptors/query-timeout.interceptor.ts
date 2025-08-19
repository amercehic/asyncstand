import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { QUERY_TIMEOUT_KEY } from '@/common/decorators/query-timeout.decorator';
import { LoggerService } from '@/common/logger.service';

@Injectable()
export class QueryTimeoutInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(QueryTimeoutInterceptor.name);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const timeoutValue =
      this.reflector.get<number>(QUERY_TIMEOUT_KEY, context.getHandler()) || 30000; // Default 30s

    const startTime = Date.now();

    return next.handle().pipe(
      timeout(timeoutValue),
      catchError((err) => {
        const duration = Date.now() - startTime;

        if (err instanceof TimeoutError) {
          this.logger.error('Request timeout', {
            url: request.url,
            method: request.method,
            timeout: timeoutValue,
            duration,
            userAgent: request.get('user-agent'),
            ip: request.ip,
          });

          return throwError(() => new RequestTimeoutException('Request timeout'));
        }

        // Log other errors with timing info
        if (duration > 5000) {
          // Log slow requests
          this.logger.warn('Slow request detected', {
            url: request.url,
            method: request.method,
            duration,
            error: err.message,
          });
        }

        return throwError(() => err);
      }),
    );
  }
}
