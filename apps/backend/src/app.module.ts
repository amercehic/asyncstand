import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { validate } from '@/config/env';
import { AuthModule } from '@/auth/auth.module';
import { PrismaService } from '@/prisma/prisma.service';
import { createLoggerModule } from '@/config/logger.config';
import { LoggerService } from '@/common/logger.service';
import { AuditModule } from '@/common/audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: '.env',
    }),
    createLoggerModule(),
    AuditModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService, LoggerService],
})
export class AppModule {}
