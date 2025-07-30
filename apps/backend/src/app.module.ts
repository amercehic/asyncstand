import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { validate, envConfig } from '@/config/env';
import { AuthModule } from '@/auth/auth.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { createLoggerModule } from '@/config/logger.config';
import { LoggerService } from '@/common/logger.service';
import { AuditModule } from '@/common/audit/audit.module';
import { IntegrationsModule } from '@/integrations/integrations.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: '.env',
      load: [envConfig],
    }),
    createLoggerModule(),
    PrismaModule,
    AuditModule,
    AuthModule,
    IntegrationsModule,
  ],
  controllers: [AppController],
  providers: [AppService, LoggerService],
})
export class AppModule {}
