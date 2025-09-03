import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';
import { Cacheable } from '@/common/cache/decorators/cacheable.decorator';
import { Feature, PlanFeature } from '@prisma/client';
import { CreateFeatureDto } from '@/features/dto/create-feature.dto';
import { UpdateFeatureDto } from '@/features/dto/update-feature.dto';

export interface FeatureCheckResult {
  enabled: boolean;
  source: 'global' | 'environment' | 'plan' | 'rollout';
  value?: string;
  reason?: string;
}

interface RolloutValue {
  percentage?: number;
  orgIds?: string[];
  userIds?: string[];
}

@Injectable()
export class FeatureService {
  private readonly environment: string;

  constructor(
    private prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(FeatureService.name);
    this.environment = process.env.NODE_ENV || 'development';
  }

  /**
   * Check if a feature is enabled for an organization
   * Priority order:
   * 1. Plan-based feature (if applicable)
   * 2. Rollout configuration
   * 3. Environment check
   * 4. Global enable flag
   */
  async isFeatureEnabled(
    featureKey: string,
    orgId?: string,
    userId?: string,
  ): Promise<FeatureCheckResult> {
    try {
      // Get feature definition
      const feature = await this.getFeatureWithCache(featureKey);

      if (!feature) {
        this.logger.warn(`Feature ${featureKey} not found`);
        return { enabled: false, source: 'global', reason: 'Feature not found' };
      }

      // Check global kill switch
      if (!feature.isEnabled) {
        return { enabled: false, source: 'global', reason: 'Feature globally disabled' };
      }

      // Check environment
      if (feature.environment.length > 0 && !feature.environment.includes(this.environment)) {
        return {
          enabled: false,
          source: 'environment',
          reason: `Not available in ${this.environment} environment`,
        };
      }

      if (orgId) {
        // Check plan-based features
        if (feature.isPlanBased) {
          const planFeature = await this.getPlanFeature(orgId, featureKey);
          if (planFeature !== null) {
            return {
              enabled: planFeature.enabled,
              source: 'plan',
              value: planFeature.value || undefined,
            };
          }
        }

        // Check rollout configuration
        const rolloutResult = await this.checkRollout(feature, orgId, userId);
        if (rolloutResult !== null) {
          return {
            enabled: rolloutResult,
            source: 'rollout',
          };
        }
      }

      // Default to enabled if all checks pass
      return { enabled: true, source: 'global' };
    } catch (error) {
      this.logger.error(`Error checking feature ${featureKey}:`, error as Record<string, unknown>);
      return { enabled: false, source: 'global', reason: 'Error checking feature' };
    }
  }

  /**
   * Get all features enabled for an organization
   */
  async getEnabledFeatures(orgId: string): Promise<string[]> {
    const allFeatures = await this.prisma.feature.findMany({
      where: { isEnabled: true },
    });

    const enabledFeatures: string[] = [];

    for (const feature of allFeatures) {
      const result = await this.isFeatureEnabled(feature.key, orgId);
      if (result.enabled) {
        enabledFeatures.push(feature.key);
      }
    }

    return enabledFeatures;
  }

  /**
   * Check quota limits for an organization
   */
  async checkQuota(
    orgId: string,
    quotaType: 'members' | 'teams' | 'standups' | 'storage' | 'integrations',
  ): Promise<{ current: number; limit: number | null; exceeded: boolean }> {
    const subscription = await this.getSubscriptionWithPlan(orgId);

    if (!subscription || !subscription.plan) {
      return { current: 0, limit: 0, exceeded: true };
    }

    const plan = subscription.plan;
    let current = 0;
    let limit: number | null = null;

    switch (quotaType) {
      case 'members':
        current = await this.prisma.orgMember.count({
          where: { orgId, status: 'active' },
        });
        limit = plan.memberLimit;
        break;
      case 'teams':
        current = await this.prisma.team.count({ where: { orgId } });
        limit = plan.teamLimit;
        break;
      case 'standups': {
        // Count standups in current month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        current = await this.prisma.standupInstance.count({
          where: {
            team: { orgId },
            targetDate: { gte: startOfMonth },
          },
        });
        limit = plan.standupLimit;
        break;
      }
      case 'integrations':
        current = await this.prisma.integration.count({ where: { orgId } });
        limit = plan.integrationLimit;
        break;
      case 'storage':
        // This would need implementation based on your storage tracking
        current = 0;
        limit = plan.storageLimit;
        break;
    }

    return {
      current,
      limit,
      exceeded: limit !== null && current >= limit,
    };
  }

  // Private helper methods

  @Cacheable('feature') // Cache for 5 minutes
  private async getFeatureWithCache(featureKey: string): Promise<Feature | null> {
    return this.prisma.feature.findUnique({
      where: { key: featureKey },
    });
  }

  private async getPlanFeature(orgId: string, featureKey: string): Promise<PlanFeature | null> {
    const subscription = await this.getSubscriptionWithPlan(orgId);

    if (!subscription) {
      return null;
    }

    return this.prisma.planFeature.findUnique({
      where: {
        planId_featureKey: {
          planId: subscription.planId,
          featureKey,
        },
      },
    });
  }

  private async getSubscriptionWithPlan(orgId: string) {
    const billingAccount = await this.prisma.billingAccount.findUnique({
      where: { orgId },
      include: {
        subscription: {
          include: { plan: true },
        },
      },
    });

    return billingAccount?.subscription;
  }

  private async checkRollout(
    feature: Feature,
    orgId: string,
    userId?: string,
  ): Promise<boolean | null> {
    if (!feature.rolloutValue) {
      return null;
    }

    const rolloutValue = feature.rolloutValue as RolloutValue;

    switch (feature.rolloutType) {
      case 'percentage': {
        // Simple percentage rollout based on org ID hash
        const percentage = rolloutValue.percentage || 0;
        const hash = this.hashString(orgId);
        return hash % 100 < percentage;
      }

      case 'org_list': {
        // Check if org is in the allowed list
        const orgList = rolloutValue.orgIds || [];
        return orgList.includes(orgId);
      }

      case 'user_list': {
        // Check if user is in the allowed list
        if (!userId) return false;
        const userList = rolloutValue.userIds || [];
        return userList.includes(userId);
      }

      default:
        return null;
    }
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Admin methods

  async listAllFeatures(category?: string) {
    const where = category ? { category } : {};
    return this.prisma.feature.findMany({
      where,
      include: {
        planFeatures: {
          include: { plan: true },
        },
      },
      orderBy: { key: 'asc' },
    });
  }

  async createFeature(createFeatureDto: CreateFeatureDto) {
    return this.prisma.feature.create({
      data: createFeatureDto,
    });
  }

  async updateFeature(featureKey: string, updateFeatureDto: UpdateFeatureDto) {
    return this.prisma.feature.update({
      where: { key: featureKey },
      data: updateFeatureDto,
    });
  }
}
