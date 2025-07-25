import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { validate } from '@/config/env';
import { AuthModule } from '@/auth/auth.module';
import { PrismaService } from '@/prisma/prisma.service';
import { createLoggerModule } from '@/config/logger.config';
import { LoggerService } from '@/common/logger.service';
import { AuditLogService } from '@/common/audit-log.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: '.env',
    }),
    createLoggerModule(),
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService, LoggerService, AuditLogService],
})
export class AppModule {}
