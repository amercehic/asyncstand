import { Module } from '@nestjs/common';
import { StandupConfigController } from '@/standups/standup-config.controller';
import { StandupConfigService } from '@/standups/standup-config.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuditModule } from '@/common/audit/audit.module';
import { LoggerService } from '@/common/logger.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [StandupConfigController],
  providers: [StandupConfigService, LoggerService],
  exports: [StandupConfigService],
})
export class StandupsModule {}
