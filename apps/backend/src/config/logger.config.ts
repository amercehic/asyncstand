import { LoggerModule } from 'nestjs-pino';

export interface LoggerConfig {
  level: string;
  prettyPrint: boolean;
  redact: string[];
  serializers?: Record<string, (value: unknown) => unknown>;
}

export const getLoggerConfig = (): LoggerConfig => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';

  return {
    level: process.env.LOG_LEVEL || (isProduction ? 'info' : isTest ? 'error' : 'debug'),
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
        if (err instanceof Error) {
          const isDevelopment = process.env.NODE_ENV === 'development';
          return {
            type: err.constructor?.name,
            message: err.message,
            stack: err.stack,
            // In development, include additional debug information
            ...(isDevelopment && {
              cause: (err as Error & { cause?: unknown }).cause,
              name: err.name,
              constructor: err.constructor?.name,
            }),
          };
        }
        return err;
      },
    },
  };
};

export const createLoggerModule = () => {
  const config = getLoggerConfig();
  const isTest = process.env.NODE_ENV === 'test';
  const isSilent = process.env.LOG_LEVEL === 'silent';

  // If LOG_LEVEL is silent, return a minimal logger configuration
  if (isSilent) {
    return LoggerModule.forRoot({
      pinoHttp: {
        enabled: false,
        level: 'silent',
      },
    });
  }

  return LoggerModule.forRoot({
    pinoHttp: {
      level: config.level,
      transport: config.prettyPrint
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'hostname,pid',
              singleLine: false,
              hideObject: false,
              // Always render stacks when error-like objects are present
              errorLikeObjectKeys: ['err', 'error', 'exception'],
              errorProps: 'name,message,stack,cause',
              messageFormat:
                '{msg}{if err}\n{err.stack}{end}{if error}\n{error.stack}{end}{if exception}\n{exception.stack}{end}',
            },
          }
        : undefined,
      serializers: config.serializers,
      redact: config.redact,
      // Disable HTTP request/response logging completely for cleaner logs
      autoLogging: !isTest,
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
