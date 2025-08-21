import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { performance } from 'perf_hooks';

interface PerformanceMetrics {
  method: string;
  controller: string;
  endpoint: string;
  duration: number;
  timestamp: Date;
  userId?: string;
  organizationId?: string;
  slow: boolean;
}

@Injectable()
export class QueryPerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger(QueryPerformanceInterceptor.name);
  private readonly slowQueryThreshold = 1000; // 1 second
  private readonly warningThreshold = 500; // 500ms

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = performance.now();
    const request = context.switchToHttp().getRequest();
    const controller = context.getClass().name;
    const method = context.getHandler().name;
    const endpoint = `${request.method} ${request.url}`;

    return next.handle().pipe(
      tap(() => {
        const end = performance.now();
        const duration = Math.round(end - start);

        const metrics: PerformanceMetrics = {
          method,
          controller,
          endpoint,
          duration,
          timestamp: new Date(),
          userId: request.user?.id,
          organizationId: request.user?.organizationId,
          slow: duration > this.slowQueryThreshold,
        };

        this.logPerformanceMetrics(metrics);
        this.trackPerformanceMetrics(metrics);
      }),
    );
  }

  private logPerformanceMetrics(metrics: PerformanceMetrics): void {
    const { controller, method, endpoint, duration, slow } = metrics;
    const logMessage = `${controller}.${method} - ${endpoint} - ${duration}ms`;

    if (slow) {
      this.logger.error(`🐌 SLOW QUERY: ${logMessage}`, {
        ...metrics,
        alert: 'PERFORMANCE_ISSUE',
      });
    } else if (duration > this.warningThreshold) {
      this.logger.warn(`⚠️ Slow response: ${logMessage}`, metrics);
    } else {
      this.logger.debug(`✅ ${logMessage}`, metrics);
    }
  }

  private trackPerformanceMetrics(metrics: PerformanceMetrics): void {
    // In a production environment, you would send these metrics to
    // a monitoring service like DataDog, New Relic, or Prometheus

    // For now, we'll track some basic stats in memory
    // This could be extended to use Redis for persistence
    this.updatePerformanceStats(metrics);
  }

  private updatePerformanceStats(metrics: PerformanceMetrics): void {
    // Simple in-memory stats tracking
    // In production, use a proper metrics collection service

    const statsKey = `${metrics.controller}.${metrics.method}`;

    // Log significant performance events
    if (metrics.slow) {
      this.logger.error(`Performance alert for ${statsKey}: ${metrics.duration}ms`, {
        endpoint: metrics.endpoint,
        userId: metrics.userId,
        organizationId: metrics.organizationId,
        timestamp: metrics.timestamp,
        severity: 'HIGH',
      });
    }
  }

  /**
   * Get performance statistics (for health check endpoints)
   */
  getPerformanceStats(): { slowQueries: number; averageResponseTime?: number } {
    // This would return actual stats in a real implementation
    return {
      slowQueries: 0, // Placeholder
      averageResponseTime: undefined,
    };
  }
}
