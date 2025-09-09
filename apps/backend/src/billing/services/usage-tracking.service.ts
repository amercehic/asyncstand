import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';
import { CurrentUsageDto, UsageLimitDto, BillingPeriodDto } from '@/billing/dto/usage.dto';
import { Plan } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class UsageTrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(UsageTrackingService.name);
  }

  /**
   * Get current usage for an organization
   */
  async getCurrentUsage(orgId: string): Promise<CurrentUsageDto> {
    this.logger.debug('Getting current usage', { orgId });

    // Get organization with billing info
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        billingAccount: {
          include: {
            subscription: {
              include: {
                plan: true,
              },
            },
          },
        },
      },
    });

    if (!org) {
      throw new Error(`Organization ${orgId} not found`);
    }

    // Get current plan (default to free plan if no subscription)
    let plan: Plan;
    if (org.billingAccount?.subscription?.plan) {
      plan = org.billingAccount.subscription.plan;
    } else {
      // Try to get free plan from database
      plan = await this.prisma.plan.findFirst({
        where: { key: 'free' },
      });

      if (!plan) {
        // If no free plan exists, create a default in-memory plan with the specified limits
        this.logger.warn('No free plan found in database, using default limits');
        plan = {
          id: 'default-free',
          key: 'free',
          name: 'Free',
          displayName: 'Free Plan',
          description: 'Default free plan',
          price: new Decimal(0),
          interval: 'month',
          stripePriceId: null,
          isActive: true,
          sortOrder: 0,
          memberLimit: 5,
          teamLimit: 2,
          standupConfigLimit: 5,
          standupLimit: 50,
          storageLimit: null,
          integrationLimit: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Plan;
      }
    }

    // Calculate billing period
    const billingPeriod = await this.getBillingPeriod(orgId);

    // Get current counts
    const [teamsCount, membersCount, standupConfigsCount, standupsThisMonth] = await Promise.all([
      this.getTeamsCount(orgId),
      this.getMembersCount(orgId),
      this.getStandupConfigsCount(orgId),
      this.getStandupsCountForPeriod(orgId, billingPeriod.periodStart, billingPeriod.periodEnd),
    ]);

    // Build usage response
    const usage: CurrentUsageDto = {
      orgId,
      teams: this.buildUsageLimit(teamsCount, plan.teamLimit),
      members: this.buildUsageLimit(membersCount, plan.memberLimit),
      standupConfigs: this.buildUsageLimit(standupConfigsCount, plan.standupConfigLimit),
      standupsThisMonth: this.buildUsageLimit(standupsThisMonth, plan.standupLimit),
      nextResetDate: billingPeriod.periodEnd,
      planName: plan.name,
      isFreePlan: plan.name === 'Free',
    };

    this.logger.debug('Current usage calculated', {
      orgId,
      teamsCount,
      membersCount,
      standupConfigsCount,
      standupsThisMonth,
      planName: plan.name,
    });

    return usage;
  }

  /**
   * Get billing period for an organization
   */
  async getBillingPeriod(orgId: string): Promise<BillingPeriodDto> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        billingAccount: {
          include: {
            subscription: true,
          },
        },
      },
    });

    if (!org) {
      throw new Error(`Organization ${orgId} not found`);
    }

    let periodStart: Date;
    let periodEnd: Date;

    if (org.billingAccount?.subscription) {
      // Use subscription billing period
      periodStart = org.billingAccount.subscription.currentPeriodStart;
      periodEnd = org.billingAccount.subscription.currentPeriodEnd;
    } else {
      // Use registration-based monthly period
      const registrationDate = org.createdAt;
      periodStart = this.getMonthlyPeriodStart(registrationDate);
      periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const now = new Date();
    const daysUntilReset = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
      orgId,
      periodStart,
      periodEnd,
      daysUntilReset,
      isInTrial: !org.billingAccount?.subscription,
    };
  }

  /**
   * Check if organization can perform an action based on limits
   */
  async canPerformAction(
    orgId: string,
    actionType: 'create_team' | 'invite_member' | 'create_standup_config' | 'create_standup',
  ): Promise<{ allowed: boolean; reason?: string; upgradeRequired: boolean }> {
    const usage = await this.getCurrentUsage(orgId);

    switch (actionType) {
      case 'create_team':
        if (usage.teams.overLimit) {
          return {
            allowed: false,
            reason: 'Free plan includes 1 team. Upgrade to create more teams.',
            upgradeRequired: true,
          };
        }
        break;

      case 'invite_member':
        if (usage.members.overLimit) {
          return {
            allowed: false,
            reason: 'Free plan includes 5 members. Upgrade for unlimited members.',
            upgradeRequired: true,
          };
        }
        break;

      case 'create_standup_config':
        if (usage.standupConfigs.overLimit) {
          return {
            allowed: false,
            reason: 'Free plan includes 1 standup configuration. Upgrade for unlimited configs.',
            upgradeRequired: true,
          };
        }
        break;

      case 'create_standup':
        if (usage.standupsThisMonth.overLimit) {
          return {
            allowed: false,
            reason: `You've reached your monthly standup limit. Resets in ${usage.nextResetDate.toLocaleDateString()}. Upgrade for unlimited standups.`,
            upgradeRequired: true,
          };
        }
        break;

      default:
        return { allowed: true, upgradeRequired: false };
    }

    return { allowed: true, upgradeRequired: false };
  }

  /**
   * Record a usage event
   */
  async recordUsage(
    orgId: string,
    eventType: 'team_created' | 'member_added' | 'standup_config_created' | 'standup_created',
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    this.logger.debug('Recording usage event', {
      orgId,
      eventType,
      metadata,
    });

    // For now, we rely on direct database counts
    // In the future, we could implement event-based tracking here
  }

  // Private helper methods

  private buildUsageLimit(used: number, limit: number | null): UsageLimitDto {
    // Handle unlimited plans (null limit)
    if (limit === null || limit === -1) {
      return {
        used,
        limit: null,
        available: null,
        percentage: 0,
        nearLimit: false,
        overLimit: false,
      };
    }

    const available = Math.max(0, limit - used);
    const percentage = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

    return {
      used,
      limit,
      available,
      percentage,
      nearLimit: percentage >= 80,
      overLimit: used >= limit && limit > 0,
    };
  }

  private async getTeamsCount(orgId: string): Promise<number> {
    return await this.prisma.team.count({
      where: { orgId },
    });
  }

  private async getMembersCount(orgId: string): Promise<number> {
    return await this.prisma.orgMember.count({
      where: {
        orgId,
        status: 'active',
      },
    });
  }

  private async getStandupConfigsCount(orgId: string): Promise<number> {
    return await this.prisma.standupConfig.count({
      where: {
        team: {
          orgId,
        },
      },
    });
  }

  private async getStandupsCountForPeriod(
    orgId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<number> {
    return await this.prisma.standupInstance.count({
      where: {
        team: {
          orgId,
        },
        createdAt: {
          gte: periodStart,
          lt: periodEnd,
        },
      },
    });
  }

  private getMonthlyPeriodStart(registrationDate: Date): Date {
    const now = new Date();
    const registrationDay = registrationDate.getDate();

    let periodStart = new Date(now.getFullYear(), now.getMonth(), registrationDay);

    // If we're before the registration day this month, use last month
    if (now.getDate() < registrationDay) {
      periodStart = new Date(now.getFullYear(), now.getMonth() - 1, registrationDay);
    }

    return periodStart;
  }
}
