# Logging Configuration

This document describes the logging setup for the AsyncStand backend application.

## Overview

The application uses [Pino](https://getpino.io/) as the underlying logging library with [nestjs-pino](https://github.com/iamolegga/nestjs-pino) for NestJS integration. The logging system is fully configurable through environment variables and provides structured JSON logging.

## Configuration

### Environment Variables

| Variable     | Default                      | Description                                        |
| ------------ | ---------------------------- | -------------------------------------------------- |
| `LOG_LEVEL`  | `debug` (dev), `info` (prod) | Log level (trace, debug, info, warn, error, fatal) |
| `LOG_PRETTY` | `true` (dev), `false` (prod) | Enable pretty printing for development             |
| `NODE_ENV`   | `development`                | Environment (development, production, test)        |

### Log Levels

- **trace**: Most verbose logging
- **debug**: Debug information
- **info**: General information
- **warn**: Warning messages
- **error**: Error messages
- **fatal**: Critical errors

## Usage

### Using LoggerService

The `LoggerService` provides a consistent logging interface across the application:

```typescript
import { Injectable } from '@nestjs/common';
import { LoggerService } from '@/common/logger.service';

@Injectable()
export class MyService {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext(MyService.name);
  }

  async someMethod() {
    this.logger.info('Operation started', { userId: '123' });

    try {
      // ... some operation
      this.logger.info('Operation completed successfully');
    } catch (error) {
      this.logger.logError(error, { userId: '123' });
    }
  }
}
```

### Convenience Methods

The `LoggerService` provides several convenience methods for common logging patterns:

```typescript
// Log HTTP requests
this.logger.logRequest('GET', '/api/users', 150, 200);

// Log errors with context
this.logger.logError(error, { userId: '123', action: 'login' });

// Log database queries
this.logger.logDatabaseQuery('SELECT * FROM users', 25, { id: 123 });

// Log user actions
this.logger.logUserAction('user.login', '123', 'org-456', { ip: '192.168.1.1' });
```

### Direct Pino Logger

You can also inject the Pino logger directly:

```typescript
import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

@Injectable()
export class MyService {
  constructor(@InjectPinoLogger(MyService.name) private readonly logger: PinoLogger) {
    this.logger.setContext(MyService.name);
  }

  async someMethod() {
    this.logger.info('Message', { context: 'data' });
  }
}
```

## Configuration Details

### Request Logging

HTTP requests are automatically logged with the following information:

- Method (GET, POST, etc.)
- URL
- Headers (with sensitive data redacted)
- Request body
- Query parameters
- Response status code
- Response headers

### Security

Sensitive data is automatically redacted from logs:

- Authorization headers
- Cookies
- API keys
- Passwords
- Tokens
- Secrets

### Serialization

Custom serializers are configured for:

- HTTP requests and responses
- Error objects (with stack traces)
- Database queries
- User actions

## Environment-Specific Behavior

### Development

- Pretty-printed logs for readability
- Debug level logging
- Full request/response logging
- Stack traces for errors

### Production

- JSON format for log aggregation
- Info level logging
- Redacted sensitive information
- Optimized for performance

### Testing

- Minimal logging to avoid noise
- Error level for failures
- No pretty printing

## Examples

### Basic Logging

```typescript
this.logger.info('User logged in', { userId: '123', email: 'user@example.com' });
```

### Error Logging

```typescript
try {
  // ... some operation
} catch (error) {
  this.logger.logError(error, {
    userId: '123',
    action: 'password_reset',
    email: 'user@example.com',
  });
}
```

### Request Logging

```typescript
// Automatically logged by nestjs-pino
// Custom request logging
this.logger.logRequest('POST', '/api/auth/login', 250, 200);
```

### Database Logging

```typescript
const startTime = Date.now();
const result = await this.prisma.user.findUnique({ where: { id: userId } });
const duration = Date.now() - startTime;

this.logger.logDatabaseQuery('findUnique', duration, { userId });
```

## Best Practices

1. **Use structured logging**: Always pass context as objects, not strings
2. **Set appropriate log levels**: Use debug for development, info for production
3. **Include relevant context**: Add user IDs, request IDs, etc. for traceability
4. **Don't log sensitive data**: Let the redaction system handle it
5. **Use convenience methods**: Use `logError`, `logRequest`, etc. for consistency
6. **Set context**: Always set the logger context to the service name

## Troubleshooting

### Logs not appearing

- Check `LOG_LEVEL` environment variable
- Verify `NODE_ENV` is set correctly
- Ensure logger is properly injected

### Performance issues

- Use appropriate log levels for production
- Avoid logging large objects
- Use structured logging instead of string concatenation

### Missing context

- Always call `setContext()` in constructor
- Use the service name as context
- Pass relevant data in log calls
