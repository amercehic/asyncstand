import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { validate, envConfig } from '@/config/env';
import { AuthModule } from '@/auth/auth.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { createLoggerModule } from '@/config/logger.config';
import { LoggerService } from '@/common/logger.service';
import { AuditModule } from '@/common/audit/audit.module';
import { IntegrationsModule } from '@/integrations/integrations.module';
import { TeamsModule } from '@/teams/teams.module';
import { StandupsModule } from '@/standups/standups.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: '.env',
      load: [envConfig],
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD'),
          username: configService.get<string>('REDIS_USERNAME'),
          db: configService.get<number>('REDIS_DB', 0),
        },
        defaultJobOptions: {
          removeOnComplete: 10,
          removeOnFail: 5,
        },
      }),
    }),
    createLoggerModule(),
    PrismaModule,
    AuditModule,
    AuthModule,
    IntegrationsModule,
    TeamsModule,
    StandupsModule,
  ],
  controllers: [AppController],
  providers: [AppService, LoggerService],
})
export class AppModule {}
