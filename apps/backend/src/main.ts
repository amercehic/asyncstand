import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { ConfigService } from '@nestjs/config';
import { AllExceptionsFilter } from '@/common/http-exception.filter';
import { ValidationPipe, INestApplication, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

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
  app.use('/api/docs/api-json', (req: any, res: any) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(document);
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

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
    app.enableCors({
      origin: 'http://localhost:5173', // Frontend URL
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
  logger.error('❌ Failed to start the application:', error);
  process.exit(1);
});
