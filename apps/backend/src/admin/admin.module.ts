import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { LoggerService } from '@/common/logger.service';
import { PlanManagementController } from '@/admin/controllers/plan-management.controller';
import { PlanManagementService } from '@/admin/services/plan-management.service';

@Module({
  imports: [PrismaModule],
  controllers: [PlanManagementController],
  providers: [PlanManagementService, LoggerService],
  exports: [PlanManagementService],
})
export class AdminModule {}
