import { Module } from '@nestjs/common';
import { TeamsController } from '@/teams/teams.controller';
import { TeamManagementService } from '@/teams/team-management.service';
import { TeamMemberMappingService } from '@/teams/services/team-member-mapping.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { SlackModule } from '@/integrations/slack/slack.module';
import { AuditModule } from '@/common/audit/audit.module';
import { CacheModule } from '@/common/cache/cache.module';
import { ErrorRecoveryService } from '@/common/services/error-recovery.service';
import { LoggerService } from '@/common/logger.service';

@Module({
  imports: [PrismaModule, SlackModule, AuditModule, CacheModule],
  controllers: [TeamsController],
  providers: [TeamManagementService, TeamMemberMappingService, ErrorRecoveryService, LoggerService],
  exports: [TeamManagementService, TeamMemberMappingService],
})
export class TeamsModule {}
