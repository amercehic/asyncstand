import { Injectable, ForbiddenException } from '@nestjs/common';
import { LoggerService } from '@/common/logger.service';
import { UsageTrackingService } from '@/billing/services/usage-tracking.service';

@Injectable()
export class PlanEnforcementService {
  constructor(
    private readonly usageTrackingService: UsageTrackingService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(PlanEnforcementService.name);
  }

  /**
   * Enforce team creation limits
   */
  async enforceTeamCreation(orgId: string): Promise<void> {
    const check = await this.usageTrackingService.canPerformAction(orgId, 'create_team');

    if (!check.allowed) {
      this.logger.warn('Team creation blocked by plan limits', {
        orgId,
        reason: check.reason,
      });

      throw new ForbiddenException({
        message: check.reason,
        upgradeRequired: check.upgradeRequired,
        actionType: 'create_team',
      });
    }

    this.logger.debug('Team creation allowed', { orgId });
  }

  /**
   * Enforce member invitation limits
   */
  async enforceMemberInvitation(orgId: string): Promise<void> {
    const check = await this.usageTrackingService.canPerformAction(orgId, 'invite_member');

    if (!check.allowed) {
      this.logger.warn('Member invitation blocked by plan limits', {
        orgId,
        reason: check.reason,
      });

      throw new ForbiddenException({
        message: check.reason,
        upgradeRequired: check.upgradeRequired,
        actionType: 'invite_member',
      });
    }

    this.logger.debug('Member invitation allowed', { orgId });
  }

  /**
   * Enforce standup config creation limits
   */
  async enforceStandupConfigCreation(orgId: string): Promise<void> {
    const check = await this.usageTrackingService.canPerformAction(orgId, 'create_standup_config');

    if (!check.allowed) {
      this.logger.warn('Standup config creation blocked by plan limits', {
        orgId,
        reason: check.reason,
      });

      throw new ForbiddenException({
        message: check.reason,
        upgradeRequired: check.upgradeRequired,
        actionType: 'create_standup_config',
      });
    }

    this.logger.debug('Standup config creation allowed', { orgId });
  }

  /**
   * Enforce standup creation limits
   */
  async enforceStandupCreation(orgId: string): Promise<void> {
    const check = await this.usageTrackingService.canPerformAction(orgId, 'create_standup');

    if (!check.allowed) {
      this.logger.warn('Standup creation blocked by plan limits', {
        orgId,
        reason: check.reason,
      });

      throw new ForbiddenException({
        message: check.reason,
        upgradeRequired: check.upgradeRequired,
        actionType: 'create_standup',
      });
    }

    this.logger.debug('Standup creation allowed', { orgId });
  }

  /**
   * Get usage warnings for near-limit situations
   */
  async getUsageWarnings(orgId: string): Promise<{
    warnings: Array<{
      type: string;
      message: string;
      severity: 'info' | 'warning' | 'error';
    }>;
  }> {
    const usage = await this.usageTrackingService.getCurrentUsage(orgId);
    const warnings: Array<{
      type: string;
      message: string;
      severity: 'info' | 'warning' | 'error';
    }> = [];

    // Check teams
    if (usage.teams.overLimit) {
      warnings.push({
        type: 'teams_limit_exceeded',
        message: 'You have reached your team limit. Upgrade to create more teams.',
        severity: 'error',
      });
    } else if (usage.teams.nearLimit) {
      warnings.push({
        type: 'teams_limit_near',
        message: `You're using ${usage.teams.used} of ${usage.teams.limit} teams.`,
        severity: 'warning',
      });
    }

    // Check members
    if (usage.members.overLimit) {
      warnings.push({
        type: 'members_limit_exceeded',
        message: 'You have reached your member limit. Upgrade for unlimited members.',
        severity: 'error',
      });
    } else if (usage.members.nearLimit) {
      warnings.push({
        type: 'members_limit_near',
        message: `You're using ${usage.members.used} of ${usage.members.limit} team members.`,
        severity: 'warning',
      });
    }

    // Check standup configs
    if (usage.standupConfigs.overLimit) {
      warnings.push({
        type: 'configs_limit_exceeded',
        message:
          'You have reached your standup configuration limit. Upgrade for unlimited configs.',
        severity: 'error',
      });
    }

    // Check monthly standups
    if (usage.standupsThisMonth.overLimit) {
      warnings.push({
        type: 'standups_limit_exceeded',
        message: `You've used all ${usage.standupsThisMonth.limit} standups this month. Resets on ${usage.nextResetDate.toLocaleDateString()}.`,
        severity: 'error',
      });
    } else if (usage.standupsThisMonth.nearLimit) {
      warnings.push({
        type: 'standups_limit_near',
        message: `You've used ${usage.standupsThisMonth.used} of ${usage.standupsThisMonth.limit} standups this month.`,
        severity: 'warning',
      });
    }

    this.logger.debug('Generated usage warnings', {
      orgId,
      warningCount: warnings.length,
    });

    return { warnings };
  }

  /**
   * Check if organization needs to upgrade (at any limit)
   */
  async needsUpgrade(orgId: string): Promise<boolean> {
    const usage = await this.usageTrackingService.getCurrentUsage(orgId);

    return (
      usage.teams.overLimit ||
      usage.members.overLimit ||
      usage.standupConfigs.overLimit ||
      usage.standupsThisMonth.overLimit
    );
  }
}
