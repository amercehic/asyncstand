import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

export class CorsConfig {
  private readonly logger = new Logger('CorsConfig');
  private readonly isDevelopment: boolean;
  private readonly allowedOrigins: string[];
  private readonly allowedPatterns: RegExp[];

  constructor(private readonly configService: ConfigService) {
    this.isDevelopment = configService.get<string>('NODE_ENV') === 'development';
    this.allowedOrigins = this.parseAllowedOrigins();
    this.allowedPatterns = this.parseAllowedPatterns();
    this.logConfiguration();
  }

  private parseAllowedOrigins(): string[] {
    const origins: Set<string> = new Set();

    // Development origins
    if (this.isDevelopment) {
      ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'].forEach(
        (origin) => origins.add(origin),
      );
    }

    // Frontend URL from environment
    const frontendUrl = this.configService.get<string>('frontendUrl');
    if (frontendUrl) {
      origins.add(frontendUrl.replace(/\/$/, ''));
    }

    // Additional allowed origins from environment (comma-separated)
    const envOrigins = this.configService.get<string>('CORS_ALLOWED_ORIGINS', '');
    if (envOrigins) {
      envOrigins
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
        .forEach((origin) => origins.add(origin.replace(/\/$/, '')));
    }

    return Array.from(origins);
  }

  private parseAllowedPatterns(): RegExp[] {
    const patterns: RegExp[] = [];

    // Additional patterns from environment
    const envPatterns = this.configService.get<string>('CORS_ALLOWED_PATTERNS', '');
    if (envPatterns) {
      envPatterns
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
        .forEach((pattern) => {
          try {
            patterns.push(new RegExp(pattern));
          } catch {
            this.logger.warn(`Invalid CORS pattern ignored: ${pattern}`);
          }
        });
    }

    // Support ngrok for development/testing
    if (this.isDevelopment || this.configService.get<string>('NGROK_URL')) {
      patterns.push(
        /^https?:\/\/[\w-]+\.ngrok-free\.(app|com)$/,
        /^https?:\/\/[\w-]+\.ngrok\.(io|app)$/,
      );
    }

    return patterns;
  }

  private logConfiguration(): void {
    this.logger.log(`🔒 CORS Configuration:`);
    this.logger.log(`   Environment: ${this.isDevelopment ? 'development' : 'production'}`);
    this.logger.log(`   Allowed Origins: ${this.allowedOrigins.join(', ') || '(none)'}`);
    this.logger.log(`   Pattern Matchers: ${this.allowedPatterns.length} patterns configured`);
  }

  public getCorsOptions(): CorsOptions {
    return {
      origin: (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void,
      ) => {
        // Allow requests with no origin (mobile apps, Postman, same-origin)
        if (!origin) {
          return callback(null, true);
        }

        // Check exact matches
        if (this.allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        // Check pattern matches
        if (this.allowedPatterns.some((pattern) => pattern.test(origin))) {
          return callback(null, true);
        }

        // Log rejected origins for debugging
        this.logger.warn(`⚠️ CORS rejected origin: ${origin}`);
        return callback(new Error(`Origin ${origin} not allowed by CORS`), false);
      },
      credentials: true, // Enable cookies/authorization headers
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-Session-Id',
        'X-CSRF-Token',
        'X-XSRF-TOKEN',
        'ngrok-skip-browser-warning', // For ngrok testing
      ],
      exposedHeaders: [
        'X-Request-Id',
        'X-Correlation-Id',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
      ],
      maxAge: 86400, // Cache preflight for 24 hours
    };
  }

  // Helper method to check if an origin is allowed (for manual checks)
  public isOriginAllowed(origin: string): boolean {
    if (!origin) return true;
    return (
      this.allowedOrigins.includes(origin) ||
      this.allowedPatterns.some((pattern) => pattern.test(origin))
    );
  }
}
