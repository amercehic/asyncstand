import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '@/common/logger.service';

@Injectable()
export class AppService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(AppService.name);
  }

  getHello(): string {
    const appName = 'AsyncStand';
    const environment = this.configService.get<string>('NODE_ENV', 'development');

    return `Hello from ${appName} Backend! Running in ${environment} mode.`;
  }

  getEnvironmentInfo() {
    return {
      nodeEnv: this.configService.get<string>('NODE_ENV'),
      port: this.configService.get<number>('PORT'),
      // Don't expose sensitive data like JWT_SECRET or DATABASE_URL
      hasDatabase: !!this.configService.get<string>('DATABASE_URL'),
      hasJwtSecret: !!this.configService.get<string>('JWT_SECRET'),
    };
  }
}
