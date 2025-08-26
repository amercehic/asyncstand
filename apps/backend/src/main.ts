import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { ConfigService } from '@nestjs/config';
import { AllExceptionsFilter } from '@/common/http-exception.filter';
import { ValidationPipe, INestApplication, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { CorrelationIdMiddleware } from '@/common/middleware/correlation-id.middleware';
import { LoggingInterceptor } from '@/common/interceptors/logging.interceptor';
import * as express from 'express';

function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('AsyncStand API')
    .setDescription('API documentation for the AsyncStand backend.')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Setup Swagger UI
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Expose OpenAPI JSON specification for Postman import
  app.use('/api/docs/api-json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(document);
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    bodyParser: false,
  });
  const logger = new Logger('Bootstrap');

  // Configure body parsing middleware for Slack webhooks
  // For JSON payloads (events endpoint)
  app.use('/slack/events', express.raw({ type: 'application/json' }));

  // For form-encoded payloads (interactive-components, slash-commands) - raw parsing only
  app.use(
    ['/slack/interactive-components', '/slack/slash-commands'],
    express.raw({ type: 'application/x-www-form-urlencoded' }),
  );

  // Standard body parsers for all other endpoints (exclude Slack endpoints)
  app.use((req, res, next) => {
    if (req.path.startsWith('/slack/')) {
      return next();
    }
    express.json()(req, res, next);
  });

  app.use((req, res, next) => {
    if (req.path.startsWith('/slack/')) {
      return next();
    }
    express.urlencoded({ extended: true })(req, res, next);
  });

  // Apply correlation ID middleware first (before any other middleware)
  app.use(new CorrelationIdMiddleware().use.bind(new CorrelationIdMiddleware()));

  // Configure validation pipe for DTO validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
      transform: true, // Transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Apply global interceptors
  app.useGlobalInterceptors(new LoggingInterceptor());

  app.useGlobalFilters(new AllExceptionsFilter());

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  // Enable CORS for all environments (with environment-specific origins)
  {
    // Read from both raw env and loaded config
    const frontendUrl =
      configService.get<string>('FRONTEND_URL') || configService.get<string>('frontendUrl');
    const ngrokUrl = configService.get<string>('NGROK_URL');

    // Base allowed origins differ by environment
    const allowedOrigins: string[] = nodeEnv === 'development'
      ? [
          'http://localhost:5173', // Local development
          'http://localhost:3000', // Alternative local port
          'http://localhost:5174', // Alternative Vite port
          'http://127.0.0.1:5173', // IPv4 localhost
          'http://127.0.0.1:3000', // IPv4 localhost alternative
        ]
      : [];

    // Add configured frontend URL if available
    if (frontendUrl) {
      const normalized = frontendUrl.replace(/\/$/, '');
      if (!allowedOrigins.includes(normalized)) {
        allowedOrigins.push(normalized);
      }
    }

    // Explicitly allow Render frontend origins for prod/staging
    const renderProd = 'https://asyncstand-frontend-prod.onrender.com';
    const renderStaging = 'https://asyncstand-frontend-staging.onrender.com';
    // Also allow backend origins for Swagger UI
    const renderBackendProd = 'https://asyncstand-backend-prod.onrender.com';
    const renderBackendStaging = 'https://asyncstand-backend-staging.onrender.com';
    [renderProd, renderStaging, renderBackendProd, renderBackendStaging].forEach((origin) => {
      if (!allowedOrigins.includes(origin)) {
        allowedOrigins.push(origin);
      }
    });

    // Add ngrok URL if available (without /api or other paths)
    if (ngrokUrl) {
      const ngrokOrigin = new URL(ngrokUrl).origin;
      if (!allowedOrigins.includes(ngrokOrigin)) {
        allowedOrigins.push(ngrokOrigin);
      }
    }

    // Allow dynamic Render preview subdomains for frontend and backend by default
    const defaultOriginPatterns: RegExp[] = [
      /^https:\/\/asyncstand-frontend[\w-]*\.onrender\.com$/, // frontend: prod, staging, and preview variants
      /^https:\/\/asyncstand-backend[\w-]*\.onrender\.com$/, // backend: prod, staging, and preview variants (for Swagger UI)
    ];

    // Allow additional exact origins from env (comma-separated)
    const extraOrigins =
      (configService.get<string>('CORS_ALLOWED_ORIGINS') || process.env.CORS_ALLOWED_ORIGINS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    extraOrigins.forEach((o) => {
      const normalized = o.replace(/\/$/, '');
      if (!allowedOrigins.includes(normalized)) {
        allowedOrigins.push(normalized);
      }
    });

    // Allow additional regex patterns from env (comma-separated)
    const patternEnv =
      configService.get<string>('CORS_ALLOWED_ORIGIN_PATTERNS') ||
      process.env.CORS_ALLOWED_ORIGIN_PATTERNS ||
      '';
    const originPatterns: RegExp[] = [
      ...defaultOriginPatterns,
      ...patternEnv
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((p) => {
          try {
            return new RegExp(p);
          } catch {
            logger.warn(`⚠️ Invalid CORS pattern skipped: ${p}`);
            return null;
          }
        })
        .filter((r): r is RegExp => r instanceof RegExp),
    ];

    logger.log(
      `🔒 CORS enabled. Exact origins: ${
        allowedOrigins.join(', ') || '(none)'
      } | Pattern origins: ${originPatterns.map((r) => r.source).join(', ')}`,
    );

    app.enableCors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or Postman)
        if (!origin) return callback(null, true);

        // Check if origin is in allowed list or matches ngrok pattern
        const inExactList = allowedOrigins.includes(origin);
        const isNgrok =
          origin.includes('.ngrok-free.app') ||
          origin.includes('.ngrok.io') ||
          origin.includes('.ngrok.app') ||
          origin.includes('.ngrok-free.com');
        const matchesPattern = originPatterns.some((re) => re.test(origin));

        if (inExactList || isNgrok || matchesPattern) {
          return callback(null, true);
        }

        logger.warn(`⚠️ CORS rejected origin: ${origin}`);
        return callback(new Error('Not allowed by CORS'), false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'ngrok-skip-browser-warning',
        'X-Session-Id',
        'X-CSRF-Token',
        'X-XSRF-TOKEN',
      ],
    });
  }

  // Setup Swagger documentation and OpenAPI JSON endpoint
  setupSwagger(app);

  await app.listen(port);

  logger.log(`🚀 AsyncStand Backend is running on port ${port} in ${nodeEnv} mode`);
  logger.log(`📖 API available at: http://localhost:${port}`);
  logger.log(`📚 Swagger UI available at: http://localhost:${port}/api/docs`);
  logger.log(`📋 Postman collection available at: http://localhost:${port}/api/docs/api-json`);
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('❌ Failed to start the application:', (error as Error)?.stack, error);
  process.exit(1);
});
