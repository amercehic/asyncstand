import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';

interface RequestWithUser extends Request {
  user?: {
    id?: string;
    organizationId?: string;
    sessionId?: string;
  };
  session?: {
    id?: string;
  };
}

// Global async local storage for correlation IDs
export const correlationStore = new AsyncLocalStorage<{
  correlationId: string;
  requestId: string;
  userId?: string;
  organizationId?: string;
  sessionId?: string;
  startTime: number;
}>();

// Custom request interface to include correlation context
export interface CorrelationRequest extends Request {
  correlationId: string;
  requestId: string;
  startTime: number;
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: CorrelationRequest, res: Response, next: NextFunction): void {
    // Generate or extract correlation ID
    const correlationId = this.extractCorrelationId(req);
    const requestId = randomUUID();
    const startTime = Date.now();

    // Add to request object
    req.correlationId = correlationId;
    req.requestId = requestId;
    req.startTime = startTime;

    // Set response headers
    res.setHeader('X-Correlation-ID', correlationId);
    res.setHeader('X-Request-ID', requestId);

    // Create correlation context for async local storage
    const context = {
      correlationId,
      requestId,
      startTime,
      userId: (req as RequestWithUser).user?.id,
      organizationId: (req as RequestWithUser).user?.organizationId,
      sessionId: this.extractSessionId(req),
    };

    // Run the rest of the request within the correlation context
    correlationStore.run(context, () => {
      next();
    });
  }

  /**
   * Extract correlation ID from various sources
   */
  private extractCorrelationId(req: Request): string {
    // Priority order:
    // 1. X-Correlation-ID header (from client or upstream services)
    // 2. X-Request-ID header (alternative header name)
    // 3. Generate new UUID

    const headerCorrelationId =
      req.headers['x-correlation-id'] ||
      req.headers['x-request-id'] ||
      req.headers['correlation-id'] ||
      req.headers['request-id'];

    if (headerCorrelationId && typeof headerCorrelationId === 'string') {
      // Validate the format (should be UUID-like)
      if (this.isValidCorrelationId(headerCorrelationId)) {
        return headerCorrelationId;
      }
    }

    // Generate new correlation ID
    return randomUUID();
  }

  /**
   * Extract session ID from request
   */
  private extractSessionId(req: Request): string | undefined {
    // Try various session sources
    const expressSession = (req as RequestWithUser).session?.id;
    if (expressSession) return expressSession;

    const sessionHeader = req.headers['x-session-id'];
    if (sessionHeader && typeof sessionHeader === 'string') return sessionHeader;

    const jwtPayload = (req as RequestWithUser).user;
    if (jwtPayload?.sessionId) return jwtPayload.sessionId;

    return undefined;
  }

  /**
   * Validate correlation ID format
   */
  private isValidCorrelationId(id: string): boolean {
    // Check if it's a valid UUID or at least a reasonable identifier
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const alphanumericRegex = /^[a-zA-Z0-9\-_]{8,64}$/;

    return uuidRegex.test(id) || alphanumericRegex.test(id);
  }
}

/**
 * Utility functions to access correlation context
 */
export class CorrelationContext {
  /**
   * Get current correlation ID
   */
  static getCorrelationId(): string | undefined {
    return correlationStore.getStore()?.correlationId;
  }

  /**
   * Get current request ID
   */
  static getRequestId(): string | undefined {
    return correlationStore.getStore()?.requestId;
  }

  /**
   * Get current user ID
   */
  static getUserId(): string | undefined {
    return correlationStore.getStore()?.userId;
  }

  /**
   * Get current organization ID
   */
  static getOrganizationId(): string | undefined {
    return correlationStore.getStore()?.organizationId;
  }

  /**
   * Get current session ID
   */
  static getSessionId(): string | undefined {
    return correlationStore.getStore()?.sessionId;
  }

  /**
   * Get request start time
   */
  static getStartTime(): number | undefined {
    return correlationStore.getStore()?.startTime;
  }

  /**
   * Get full correlation context
   */
  static getContext() {
    return correlationStore.getStore();
  }

  /**
   * Update user context (for when user logs in mid-request)
   */
  static updateUserContext(userId: string, organizationId?: string) {
    const store = correlationStore.getStore();
    if (store) {
      store.userId = userId;
      if (organizationId) {
        store.organizationId = organizationId;
      }
    }
  }

  /**
   * Create a child correlation ID for sub-operations
   */
  static createChildCorrelationId(): string {
    const parentId = this.getCorrelationId();
    const childId = randomUUID();

    if (parentId) {
      // Create a hierarchical correlation ID
      return `${parentId}:${childId.substring(0, 8)}`;
    }

    return childId;
  }
}

/**
 * Decorator to ensure a function runs within correlation context
 */
export function WithCorrelation() {
  return function (_target: unknown, _propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: unknown[]) {
      const context = correlationStore.getStore();

      if (context) {
        // Already in context, just call the method
        return originalMethod.apply(this, args);
      } else {
        // No context, create one
        const newContext = {
          correlationId: randomUUID(),
          requestId: randomUUID(),
          startTime: Date.now(),
        };

        return correlationStore.run(newContext, () => {
          return originalMethod.apply(this, args);
        });
      }
    };

    return descriptor;
  };
}

/**
 * Enhanced logger that automatically includes correlation information
 */
export class CorrelationLogger {
  constructor(private context: string) {}

  private getLogContext() {
    const correlation = CorrelationContext.getContext();
    return {
      context: this.context,
      correlationId: correlation?.correlationId,
      requestId: correlation?.requestId,
      userId: correlation?.userId,
      organizationId: correlation?.organizationId,
      sessionId: correlation?.sessionId,
    };
  }

  log(message: string, meta?: Record<string, unknown>) {
    // Use structured logging instead of console
    const logData = {
      level: 'info',
      message,
      ...this.getLogContext(),
      ...meta,
      timestamp: new Date().toISOString(),
    };
    // In production, this would be sent to a proper logging service
    if (process.env.NODE_ENV !== 'test') {
      process.stdout.write(JSON.stringify(logData) + '\n');
    }
  }

  error(message: string, error?: Error | string, meta?: Record<string, unknown>) {
    const logData = {
      level: 'error',
      message,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : error,
      ...this.getLogContext(),
      ...meta,
      timestamp: new Date().toISOString(),
    };
    if (process.env.NODE_ENV !== 'test') {
      process.stderr.write(JSON.stringify(logData) + '\n');
    }
  }

  warn(message: string, meta?: Record<string, unknown>) {
    const logData = {
      level: 'warn',
      message,
      ...this.getLogContext(),
      ...meta,
      timestamp: new Date().toISOString(),
    };
    if (process.env.NODE_ENV !== 'test') {
      process.stderr.write(JSON.stringify(logData) + '\n');
    }
  }

  debug(message: string, meta?: Record<string, unknown>) {
    if (process.env.NODE_ENV === 'development') {
      const logData = {
        level: 'debug',
        message,
        ...this.getLogContext(),
        ...meta,
        timestamp: new Date().toISOString(),
      };
      process.stdout.write(JSON.stringify(logData) + '\n');
    }
  }
}
