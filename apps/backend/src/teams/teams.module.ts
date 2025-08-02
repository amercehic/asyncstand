import { Module } from '@nestjs/common';
import { TeamsController } from '@/teams/teams.controller';
import { TeamManagementService } from '@/teams/team-management.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { SlackModule } from '@/integrations/slack/slack.module';
import { AuditModule } from '@/common/audit/audit.module';
import { LoggerService } from '@/common/logger.service';

@Module({
  imports: [PrismaModule, SlackModule, AuditModule],
  controllers: [TeamsController],
  providers: [TeamManagementService, LoggerService],
  exports: [TeamManagementService],
})
export class TeamsModule {}
