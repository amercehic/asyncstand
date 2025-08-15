import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { ConfigService } from '@nestjs/config';
import { AllExceptionsFilter } from '@/common/http-exception.filter';
import { ValidationPipe, INestApplication, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

  app.useGlobalFilters(new AllExceptionsFilter());

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  // Enable CORS for development
  if (nodeEnv === 'development') {
    const frontendUrl = configService.get<string>('frontendUrl');
    const allowedOrigins = [
      'http://localhost:5173', // Local development
      'http://localhost:3000', // Alternative local port
    ];

    // Add configured frontend URL if available
    if (frontendUrl && !allowedOrigins.includes(frontendUrl)) {
      allowedOrigins.push(frontendUrl);
    }

    app.enableCors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or Postman)
        if (!origin) return callback(null, true);

        // Check if origin is in allowed list or matches ngrok pattern
        if (
          allowedOrigins.includes(origin) ||
          origin.includes('.ngrok-free.app') ||
          origin.includes('.ngrok.io') ||
          origin.includes('.ngrok.app')
        ) {
          return callback(null, true);
        }

        return callback(new Error('Not allowed by CORS'), false);
      },
      credentials: true,
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
