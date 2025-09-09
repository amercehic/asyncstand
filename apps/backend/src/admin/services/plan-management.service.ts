import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';
import { CreatePlanDto, UpdatePlanDto, PlanResponseDto } from '@/admin/dto/plan.dto';
import { Plan, PlanFeature, Feature } from '@prisma/client';

type PlanWithFeatures = Plan & {
  features: (PlanFeature & {
    feature: Feature;
  })[];
  _count: {
    subscriptions: number;
  };
};

@Injectable()
export class PlanManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(PlanManagementService.name);
  }

  /**
   * Get all plans with their features and subscription counts
   */
  async getAllPlans(): Promise<PlanResponseDto[]> {
    this.logger.debug('Fetching all plans');

    const plans = await this.prisma.plan.findMany({
      include: {
        features: {
          include: {
            feature: true,
          },
        },
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return plans.map((plan) => this.mapPlanToResponse(plan));
  }

  /**
   * Get a single plan by ID
   */
  async getPlanById(planId: string): Promise<PlanResponseDto> {
    this.logger.debug('Fetching plan', { planId });

    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      include: {
        features: {
          include: {
            feature: true,
          },
        },
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException(`Plan with ID ${planId} not found`);
    }

    return this.mapPlanToResponse(plan);
  }

  /**
   * Get a single plan by key
   */
  async getPlanByKey(key: string): Promise<PlanResponseDto> {
    this.logger.debug('Fetching plan by key', { key });

    const plan = await this.prisma.plan.findUnique({
      where: { key },
      include: {
        features: {
          include: {
            feature: true,
          },
        },
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException(`Plan with key ${key} not found`);
    }

    return this.mapPlanToResponse(plan);
  }

  /**
   * Create a new plan
   */
  async createPlan(createPlanDto: CreatePlanDto): Promise<PlanResponseDto> {
    this.logger.debug('Creating new plan', { key: createPlanDto.key });

    // Check if plan key already exists
    const existingPlan = await this.prisma.plan.findUnique({
      where: { key: createPlanDto.key },
    });

    if (existingPlan) {
      throw new ConflictException(`Plan with key ${createPlanDto.key} already exists`);
    }

    // Validate features if provided
    if (createPlanDto.features) {
      await this.validateFeatures(createPlanDto.features.map((f) => f.featureKey));
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Create the plan
      const plan = await tx.plan.create({
        data: {
          key: createPlanDto.key,
          name: createPlanDto.name,
          displayName: createPlanDto.displayName,
          description: createPlanDto.description,
          price: createPlanDto.price,
          interval: createPlanDto.interval || 'month',
          stripePriceId: createPlanDto.stripePriceId,
          isActive: createPlanDto.isActive ?? true,
          sortOrder: createPlanDto.sortOrder ?? 0,
          memberLimit: createPlanDto.memberLimit,
          teamLimit: createPlanDto.teamLimit,
          standupConfigLimit: createPlanDto.standupConfigLimit,
          standupLimit: createPlanDto.standupLimit,
          storageLimit: createPlanDto.storageLimit,
          integrationLimit: createPlanDto.integrationLimit,
        },
      });

      // Add features if provided
      if (createPlanDto.features && createPlanDto.features.length > 0) {
        await tx.planFeature.createMany({
          data: createPlanDto.features.map((feature) => ({
            planId: plan.id,
            featureKey: feature.featureKey,
            enabled: feature.enabled,
            value: feature.value,
          })),
        });
      }

      return plan;
    });

    this.logger.debug('Created plan', { planId: result.id, key: result.key });

    // Return the created plan with features
    return this.getPlanById(result.id);
  }

  /**
   * Update an existing plan
   */
  async updatePlan(planId: string, updatePlanDto: UpdatePlanDto): Promise<PlanResponseDto> {
    this.logger.debug('Updating plan', { planId });

    // Check if plan exists
    const existingPlan = await this.prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!existingPlan) {
      throw new NotFoundException(`Plan with ID ${planId} not found`);
    }

    // Validate features if provided
    if (updatePlanDto.features) {
      await this.validateFeatures(updatePlanDto.features.map((f) => f.featureKey));
    }

    await this.prisma.$transaction(async (tx) => {
      // Update the plan
      await tx.plan.update({
        where: { id: planId },
        data: {
          name: updatePlanDto.name,
          displayName: updatePlanDto.displayName,
          description: updatePlanDto.description,
          price: updatePlanDto.price,
          interval: updatePlanDto.interval,
          stripePriceId: updatePlanDto.stripePriceId,
          isActive: updatePlanDto.isActive,
          sortOrder: updatePlanDto.sortOrder,
          memberLimit: updatePlanDto.memberLimit,
          teamLimit: updatePlanDto.teamLimit,
          standupConfigLimit: updatePlanDto.standupConfigLimit,
          standupLimit: updatePlanDto.standupLimit,
          storageLimit: updatePlanDto.storageLimit,
          integrationLimit: updatePlanDto.integrationLimit,
        },
      });

      // Update features if provided
      if (updatePlanDto.features) {
        // Delete existing features
        await tx.planFeature.deleteMany({
          where: { planId },
        });

        // Add new features
        if (updatePlanDto.features.length > 0) {
          await tx.planFeature.createMany({
            data: updatePlanDto.features.map((feature) => ({
              planId,
              featureKey: feature.featureKey,
              enabled: feature.enabled,
              value: feature.value,
            })),
          });
        }
      }
    });

    this.logger.debug('Updated plan', { planId });

    // Return the updated plan
    return this.getPlanById(planId);
  }

  /**
   * Delete a plan (soft delete by marking as inactive)
   */
  async deletePlan(planId: string): Promise<void> {
    this.logger.debug('Deleting plan', { planId });

    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      include: {
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException(`Plan with ID ${planId} not found`);
    }

    // Check if plan has active subscriptions
    if (plan._count.subscriptions > 0) {
      throw new BadRequestException(
        `Cannot delete plan ${plan.name} as it has ${plan._count.subscriptions} active subscription(s). Please migrate users to another plan first.`,
      );
    }

    // Soft delete by marking as inactive
    await this.prisma.plan.update({
      where: { id: planId },
      data: {
        isActive: false,
      },
    });

    this.logger.debug('Deleted plan', { planId });
  }

  /**
   * Get all available features for plan assignment
   */
  async getAvailableFeatures() {
    return this.prisma.feature.findMany({
      where: {
        isEnabled: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Get plan usage analytics
   */
  async getPlanAnalytics() {
    const plans = await this.prisma.plan.findMany({
      include: {
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });

    const totalSubscriptions = await this.prisma.subscription.count();

    return {
      plans: plans.map((plan) => ({
        id: plan.id,
        key: plan.key,
        name: plan.name,
        subscriptionCount: plan._count.subscriptions,
        percentage:
          totalSubscriptions > 0 ? (plan._count.subscriptions / totalSubscriptions) * 100 : 0,
        revenue: plan._count.subscriptions * Number(plan.price),
      })),
      totalSubscriptions,
      totalRevenue: plans.reduce(
        (sum, plan) => sum + plan._count.subscriptions * Number(plan.price),
        0,
      ),
    };
  }

  // Private helper methods

  private async validateFeatures(featureKeys: string[]): Promise<void> {
    const existingFeatures = await this.prisma.feature.findMany({
      where: {
        key: {
          in: featureKeys,
        },
      },
    });

    const existingKeys = existingFeatures.map((f) => f.key);
    const missingKeys = featureKeys.filter((key) => !existingKeys.includes(key));

    if (missingKeys.length > 0) {
      throw new BadRequestException(`Features not found: ${missingKeys.join(', ')}`);
    }
  }

  private mapPlanToResponse(plan: PlanWithFeatures): PlanResponseDto {
    return {
      id: plan.id,
      key: plan.key,
      name: plan.name,
      displayName: plan.displayName,
      description: plan.description || '',
      price: Number(plan.price),
      interval: plan.interval,
      stripePriceId: plan.stripePriceId || '',
      isActive: plan.isActive,
      sortOrder: plan.sortOrder,
      memberLimit: plan.memberLimit || 0,
      teamLimit: plan.teamLimit || 0,
      standupConfigLimit: plan.standupConfigLimit || 0,
      standupLimit: plan.standupLimit || 0,
      storageLimit: plan.storageLimit || 0,
      integrationLimit: plan.integrationLimit || 0,
      features: plan.features.map((pf) => ({
        featureKey: pf.featureKey,
        enabled: pf.enabled,
        value: pf.value || undefined,
      })),
      subscriptionCount: plan._count.subscriptions,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }
}
