import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

@Injectable()
export class LoggerService {
  constructor(@InjectPinoLogger(LoggerService.name) private readonly logger: PinoLogger) {
    this.logger.setContext(LoggerService.name);
  }

  setContext(context: string) {
    this.logger.setContext(context);
  }

  trace(message: string, context?: Record<string, unknown>) {
    this.logger.trace(message, context);
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.logger.debug(message, context);
  }

  info(message: string, context?: Record<string, unknown>) {
    this.logger.info(message, context);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.logger.warn(message, context);
  }

  error(message: string, context?: Record<string, unknown>) {
    this.logger.error(message, context);
  }

  fatal(message: string, context?: Record<string, unknown>) {
    this.logger.fatal(message, context);
  }

  // Convenience methods for common logging patterns
  logRequest(method: string, url: string, duration?: number, statusCode?: number) {
    this.info('HTTP Request', {
      method,
      url,
      duration: duration ? `${duration}ms` : undefined,
      statusCode,
    });
  }

  logError(error: Error, context?: Record<string, unknown>) {
    this.error('Application Error', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...context,
    });
  }

  logDatabaseQuery(query: string, duration?: number, params?: unknown) {
    this.debug('Database Query', {
      query,
      duration: duration ? `${duration}ms` : undefined,
      params,
    });
  }

  logUserAction(
    action: string,
    userId?: string,
    orgId?: string,
    details?: Record<string, unknown>,
  ) {
    this.info('User Action', {
      action,
      userId,
      orgId,
      ...details,
    });
  }
}
