import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { CorrelationContext } from '@/common/middleware/correlation-id.middleware';

interface RequestLogData {
  correlationId?: string;
  requestId?: string;
  method: string;
  url: string;
  userAgent?: string;
  ipAddress?: string;
  userId?: string;
  organizationId?: string;
  sessionId?: string;
  contentLength?: number;
  acceptLanguage?: string;
  referer?: string;
  startTime: number;
}

interface ResponseLogData extends RequestLogData {
  statusCode: number;
  responseTime: number;
  contentType?: string;
  responseSize?: number;
  errorMessage?: string;
  errorStack?: string;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  // URLs that should have minimal logging (to avoid log spam)
  private readonly minimalLogPaths = new Set(['/health', '/metrics', '/ping', '/favicon.ico']);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();

    const startTime = Date.now();
    const requestData = this.buildRequestLogData(request, startTime);

    // Skip detailed logging for health check endpoints
    const isMinimalLog = this.shouldUseMinimalLogging(request.path);

    if (!isMinimalLog) {
      this.logRequest(requestData);
    }

    return next.handle().pipe(
      tap((responseBody) => {
        const responseData = this.buildResponseLogData(
          requestData,
          response,
          Date.now() - startTime,
          responseBody,
        );

        this.logResponse(responseData, false);
      }),
      catchError((error) => {
        const responseData = this.buildResponseLogData(
          requestData,
          response,
          Date.now() - startTime,
          null,
          error,
        );

        this.logResponse(responseData, true);
        throw error; // Re-throw the error
      }),
    );
  }

  private buildRequestLogData(request: Request, startTime: number): RequestLogData {
    return {
      correlationId: CorrelationContext.getCorrelationId(),
      requestId: CorrelationContext.getRequestId(),
      method: request.method,
      url: this.sanitizeUrl(request.url),
      userAgent: request.get('user-agent'),
      ipAddress: this.getClientIpAddress(request),
      userId: CorrelationContext.getUserId(),
      organizationId: CorrelationContext.getOrganizationId(),
      sessionId: CorrelationContext.getSessionId(),
      contentLength: request.get('content-length')
        ? parseInt(request.get('content-length')!, 10)
        : undefined,
      acceptLanguage: request.get('accept-language'),
      referer: request.get('referer'),
      startTime,
    };
  }

  private buildResponseLogData(
    requestData: RequestLogData,
    response: Response,
    responseTime: number,
    responseBody?: unknown,
    error?: Error,
  ): ResponseLogData {
    return {
      ...requestData,
      statusCode: response.statusCode,
      responseTime,
      contentType: response.get('content-type'),
      responseSize: this.calculateResponseSize(responseBody),
      errorMessage: error?.message,
      errorStack: error?.stack,
    };
  }

  private logRequest(data: RequestLogData): void {
    const { correlationId, requestId, method, url, userAgent, ipAddress, userId } = data;

    this.logger.log(`🔵 ${method} ${url}`, {
      type: 'request',
      correlationId,
      requestId,
      method,
      url,
      userAgent,
      ipAddress,
      userId,
      timestamp: new Date(data.startTime).toISOString(),
    });
  }

  private logResponse(data: ResponseLogData, isError: boolean): void {
    const {
      correlationId,
      requestId,
      method,
      url,
      statusCode,
      responseTime,
      userId,
      errorMessage,
    } = data;

    const emoji = this.getStatusEmoji(statusCode, isError);
    const level = this.getLogLevel(statusCode, responseTime);

    const message = `${emoji} ${method} ${url} ${statusCode} - ${responseTime}ms`;
    const logData = {
      type: 'response',
      correlationId,
      requestId,
      method,
      url,
      statusCode,
      responseTime,
      userId,
      ...(isError && { errorMessage }),
    };

    switch (level) {
      case 'error':
        this.logger.error(message, data.errorStack || errorMessage, logData);
        break;
      case 'warn':
        this.logger.warn(message, logData);
        break;
      case 'debug':
        this.logger.debug(message, logData);
        break;
      default:
        this.logger.log(message, logData);
    }
  }

  private getStatusEmoji(statusCode: number, isError: boolean): string {
    if (isError) return '❌';

    if (statusCode >= 500) return '💥';
    if (statusCode >= 400) return '🔴';
    if (statusCode >= 300) return '🟡';
    if (statusCode >= 200) return '✅';

    return '🔵';
  }

  private getLogLevel(
    statusCode: number,
    responseTime: number,
  ): 'error' | 'warn' | 'log' | 'debug' {
    // Error level for server errors
    if (statusCode >= 500) return 'error';

    // Warn level for client errors and slow responses
    if (statusCode >= 400 || responseTime > 2000) return 'warn';

    // Debug level for very fast responses (likely health checks)
    if (responseTime < 10) return 'debug';

    return 'log';
  }

  private getClientIpAddress(request: Request): string {
    // Try to get the real IP address from various headers
    const xForwardedFor = request.headers['x-forwarded-for'];
    const xRealIp = request.headers['x-real-ip'];
    const xClientIp = request.headers['x-client-ip'];
    const forwardedFor = request.headers['forwarded'];

    if (xForwardedFor && typeof xForwardedFor === 'string') {
      // X-Forwarded-For can contain multiple IPs, take the first one
      return xForwardedFor.split(',')[0].trim();
    }

    if (xRealIp && typeof xRealIp === 'string') {
      return xRealIp;
    }

    if (xClientIp && typeof xClientIp === 'string') {
      return xClientIp;
    }

    if (forwardedFor && typeof forwardedFor === 'string') {
      // Parse forwarded header: for=192.0.2.60;proto=http;by=203.0.113.43
      const forMatch = forwardedFor.match(/for=([^;,\s]+)/);
      if (forMatch) {
        return forMatch[1];
      }
    }

    // Fall back to connection remote address
    return (
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      (request as unknown as { ip?: string }).ip ||
      'unknown'
    );
  }

  private sanitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url, 'http://localhost');

      // Remove sensitive query parameters
      const sensitiveParams = ['password', 'token', 'key', 'secret', 'csrf'];

      sensitiveParams.forEach((param) => {
        if (urlObj.searchParams.has(param)) {
          urlObj.searchParams.set(param, '[REDACTED]');
        }
      });

      return urlObj.pathname + urlObj.search;
    } catch {
      // If URL parsing fails, return original but sanitize obvious patterns
      return url.replace(/([?&])(password|token|key|secret|csrf)=[^&]*/gi, '$1$2=[REDACTED]');
    }
  }

  private calculateResponseSize(responseBody: unknown): number | undefined {
    if (!responseBody) return undefined;

    try {
      if (typeof responseBody === 'string') {
        return Buffer.byteLength(responseBody, 'utf8');
      }

      if (typeof responseBody === 'object') {
        return Buffer.byteLength(JSON.stringify(responseBody), 'utf8');
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  private shouldUseMinimalLogging(path: string): boolean {
    return this.minimalLogPaths.has(path) || path.startsWith('/health');
  }
}
