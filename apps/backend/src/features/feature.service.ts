import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';
import { Cacheable } from '@/common/cache/decorators/cacheable.decorator';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { Feature, FeatureOverride, PlanFeature } from '@prisma/client';
import { CreateFeatureDto } from '@/features/dto/create-feature.dto';
import { UpdateFeatureDto } from '@/features/dto/update-feature.dto';

export interface FeatureCheckResult {
  enabled: boolean;
  source: 'global' | 'environment' | 'plan' | 'override' | 'rollout';
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
   * 1. Organization override (if exists)
   * 2. Plan-based feature (if applicable)
   * 3. Rollout configuration
   * 4. Environment check
   * 5. Global enable flag
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

      // Check organization-specific override
      if (orgId) {
        const override = await this.getOrgOverride(orgId, featureKey);
        if (override) {
          // Check if override has expired
          if (override.expiresAt && override.expiresAt < new Date()) {
            await this.prisma.featureOverride.delete({ where: { id: override.id } });
          } else {
            return {
              enabled: override.enabled,
              source: 'override',
              value: override.value || undefined,
              reason: override.reason || undefined,
            };
          }
        }

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

  /**
   * Enable a feature override for an organization
   */
  async setFeatureOverride(
    orgId: string,
    featureKey: string,
    enabled: boolean,
    options?: {
      value?: string;
      reason?: string;
      expiresAt?: Date;
    },
  ): Promise<FeatureOverride> {
    return this.prisma.featureOverride.upsert({
      where: {
        orgId_featureKey: { orgId, featureKey },
      },
      create: {
        orgId,
        featureKey,
        enabled,
        ...options,
      },
      update: {
        enabled,
        ...options,
      },
    });
  }

  /**
   * Remove a feature override
   */
  async removeFeatureOverride(orgId: string, featureKey: string): Promise<void> {
    await this.prisma.featureOverride.delete({
      where: {
        orgId_featureKey: { orgId, featureKey },
      },
    });
  }

  // Private helper methods

  @Cacheable('feature') // Cache for 5 minutes
  private async getFeatureWithCache(featureKey: string): Promise<Feature | null> {
    return this.prisma.feature.findUnique({
      where: { key: featureKey },
    });
  }

  private async getOrgOverride(orgId: string, featureKey: string): Promise<FeatureOverride | null> {
    return this.prisma.featureOverride.findUnique({
      where: {
        orgId_featureKey: { orgId, featureKey },
      },
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
        _count: {
          select: { orgOverrides: true },
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

  async createFeatureOverride(
    orgId: string,
    featureKey: string,
    enabled: boolean,
    options?: {
      value?: string;
      reason?: string;
      expiresAt?: Date;
    },
  ) {
    // Verify the feature exists
    const feature = await this.prisma.feature.findUnique({
      where: { key: featureKey },
    });

    if (!feature) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Feature not found', HttpStatus.NOT_FOUND);
    }

    return this.setFeatureOverride(orgId, featureKey, enabled, options);
  }

  async listFeatureOverrides(orgId: string) {
    return this.prisma.featureOverride.findMany({
      where: { orgId },
      include: { feature: true },
    });
  }
}
