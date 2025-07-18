import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  await app.listen(port);

  console.log(`🚀 AsyncStand Backend is running on port ${port} in ${nodeEnv} mode`);
  console.log(`📖 API available at: http://localhost:${port}`);
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start the application:', error);
  process.exit(1);
});
