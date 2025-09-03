import { PrismaClient } from '@prisma/client';
import { DEFAULT_FEATURES, DEFAULT_PLANS } from '@/features/seeds/default-features';

interface PlanFeatureData {
  featureKey: string;
  enabled: boolean;
  value?: string | null;
}

const prisma = new PrismaClient();

async function seedFeatures() {
  console.log('🌱 Seeding features...');

  for (const feature of DEFAULT_FEATURES) {
    await prisma.feature.upsert({
      where: { key: feature.key },
      update: {
        name: feature.name,
        description: feature.description,
        isEnabled: feature.isEnabled,
        environment: feature.environment,
        category: feature.category,
        isPlanBased: feature.isPlanBased,
        requiresAdmin: feature.requiresAdmin,
        rolloutType: 'boolean',
        rolloutValue: null,
      },
      create: {
        ...feature,
        rolloutType: 'boolean',
        rolloutValue: null,
      },
    });
    console.log(`  ✅ Feature: ${feature.key}`);
  }

  console.log('\n🌱 Seeding plans...');

  for (const planData of DEFAULT_PLANS) {
    const { features, ...plan } = planData;

    // Create or update the plan
    const createdPlan = await prisma.plan.upsert({
      where: { key: plan.key },
      update: {
        name: plan.name,
        displayName: plan.displayName,
        description: plan.description,
        price: plan.price,
        interval: plan.interval,
        stripePriceId: plan.stripePriceId,
        isActive: plan.isActive,
        sortOrder: plan.sortOrder,
        memberLimit: plan.memberLimit,
        teamLimit: plan.teamLimit,
        standupLimit: plan.standupLimit,
        storageLimit: plan.storageLimit,
        integrationLimit: plan.integrationLimit,
      },
      create: plan,
    });

    console.log(`  ✅ Plan: ${plan.key}`);

    // Delete existing plan features and recreate them
    await prisma.planFeature.deleteMany({
      where: { planId: createdPlan.id },
    });

    // Create plan features
    for (const feature of features) {
      await prisma.planFeature.create({
        data: {
          planId: createdPlan.id,
          featureKey: feature.featureKey,
          enabled: feature.enabled,
          value: (feature as PlanFeatureData).value || null,
        },
      });
    }
    console.log(`     Added ${features.length} features to ${plan.key} plan`);
  }

  console.log('\n✨ Seeding completed successfully!');
}

async function main() {
  try {
    await seedFeatures();
  } catch (error) {
    console.error('❌ Error seeding features:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed script
if (require.main === module) {
  main();
}

export { seedFeatures };
