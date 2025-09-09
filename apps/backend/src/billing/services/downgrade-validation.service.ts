import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';
import { Plan } from '@prisma/client';

export interface ValidationError {
  type: 'teams' | 'members' | 'standupConfigs' | 'standupsPerMonth';
  current: number;
  newLimit: number;
  message: string;
}

export interface DowngradeValidationResult {
  canDowngrade: boolean;
  warnings: ValidationError[];
  blockers: ValidationError[];
}

@Injectable()
export class DowngradeValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(DowngradeValidationService.name);
  }

  /**
   * Validate if an organization can downgrade to a specific plan
   */
  async validateDowngrade(orgId: string, targetPlan: Plan): Promise<DowngradeValidationResult> {
    this.logger.debug('Validating downgrade', { orgId, targetPlan: targetPlan.key });

    const warnings: ValidationError[] = [];
    const blockers: ValidationError[] = [];

    // Get current usage
    const [teamCount, memberCount, standupConfigCount] = await Promise.all([
      this.getTeamCount(orgId),
      this.getMemberCount(orgId),
      this.getStandupConfigCount(orgId),
    ]);

    // Check team limits
    if (targetPlan.teamLimit !== null && targetPlan.teamLimit > 0) {
      if (teamCount > targetPlan.teamLimit) {
        blockers.push({
          type: 'teams',
          current: teamCount,
          newLimit: targetPlan.teamLimit,
          message: `You have ${teamCount} teams but the ${targetPlan.name} allows only ${targetPlan.teamLimit}. Please delete ${teamCount - targetPlan.teamLimit} team(s) before downgrading.`,
        });
      }
    }

    // Check member limits
    if (targetPlan.memberLimit !== null && targetPlan.memberLimit > 0) {
      if (memberCount > targetPlan.memberLimit) {
        blockers.push({
          type: 'members',
          current: memberCount,
          newLimit: targetPlan.memberLimit,
          message: `You have ${memberCount} team members but the ${targetPlan.name} allows only ${targetPlan.memberLimit}. Please remove ${memberCount - targetPlan.memberLimit} member(s) before downgrading.`,
        });
      }
    }

    // Check standup config limits
    if (targetPlan.standupConfigLimit !== null && targetPlan.standupConfigLimit > 0) {
      if (standupConfigCount > targetPlan.standupConfigLimit) {
        blockers.push({
          type: 'standupConfigs',
          current: standupConfigCount,
          newLimit: targetPlan.standupConfigLimit,
          message: `You have ${standupConfigCount} standup configurations but the ${targetPlan.name} allows only ${targetPlan.standupConfigLimit}. Please delete ${standupConfigCount - targetPlan.standupConfigLimit} configuration(s) before downgrading.`,
        });
      }
    }

    const canDowngrade = blockers.length === 0;

    this.logger.debug('Downgrade validation result', {
      orgId,
      targetPlan: targetPlan.key,
      canDowngrade,
      blockersCount: blockers.length,
      warningsCount: warnings.length,
    });

    return {
      canDowngrade,
      warnings,
      blockers,
    };
  }

  /**
   * Get the number of teams for an organization
   */
  private async getTeamCount(orgId: string): Promise<number> {
    return await this.prisma.team.count({
      where: { orgId },
    });
  }

  /**
   * Get the number of members for an organization
   */
  private async getMemberCount(orgId: string): Promise<number> {
    return await this.prisma.orgMember.count({
      where: { orgId },
    });
  }

  /**
   * Get the number of standup configurations for an organization
   */
  private async getStandupConfigCount(orgId: string): Promise<number> {
    return await this.prisma.standupConfig.count({
      where: {
        team: {
          orgId,
        },
      },
    });
  }
}
