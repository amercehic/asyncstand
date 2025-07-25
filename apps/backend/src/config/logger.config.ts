import { LoggerModule } from 'nestjs-pino';

export interface LoggerConfig {
  level: string;
  prettyPrint: boolean;
  redact: string[];
  serializers?: Record<string, (value: unknown) => unknown>;
}

export const getLoggerConfig = (): LoggerConfig => {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
    prettyPrint:
      process.env.LOG_PRETTY === 'true' || (!isProduction && process.env.LOG_PRETTY !== 'false'),
    redact: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      'res.headers["set-cookie"]',
      'password',
      'token',
      'secret',
    ],
    serializers: {
      req: (req: unknown) => {
        const request = req as {
          method?: string;
          url?: string;
          headers?: unknown;
          body?: unknown;
          query?: unknown;
          params?: unknown;
        };
        return {
          method: request.method,
          url: request.url,
          headers: request.headers,
          body: request.body,
          query: request.query,
          params: request.params,
        };
      },
      res: (res: unknown) => {
        const response = res as { statusCode?: number; headers?: unknown };
        return {
          statusCode: response.statusCode,
          headers: response.headers || {},
        };
      },
      err: (err: unknown) => {
        const error = err as { constructor?: { name?: string }; message?: string; stack?: string };
        return {
          type: error.constructor?.name,
          message: error.message,
          stack: error.stack,
        };
      },
    },
  };
};

export const createLoggerModule = () => {
  const config = getLoggerConfig();

  return LoggerModule.forRoot({
    pinoHttp: {
      level: config.level,
      transport: config.prettyPrint ? { target: 'pino-pretty' } : undefined,
      serializers: config.serializers,
      redact: config.redact,
      // Additional Pino options
      timestamp: () => `,"time":"${new Date().toISOString()}"`,
      formatters: {
        level: (label: string) => ({ level: label }),
      },
      // Custom log levels
      customLevels: {
        trace: 10,
        debug: 20,
        info: 30,
        warn: 40,
        error: 50,
        fatal: 60,
      },
    },
  });
};
