#!/usr/bin/env tsx

/**
 * Feature validation script
 * Ensures consistency between feature constants and database
 */

import { PrismaClient } from '@prisma/client';
import { FEATURES } from '../src/shared/feature-constants';

const prisma = new PrismaClient();

interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalCodeFeatures: number;
    totalDbFeatures: number;
    missingInDb: number;
    orphanedInDb: number;
  };
}

async function validateFeatures(): Promise<ValidationResult> {
  const result: ValidationResult = {
    success: true,
    errors: [],
    warnings: [],
    stats: {
      totalCodeFeatures: 0,
      totalDbFeatures: 0,
      missingInDb: 0,
      orphanedInDb: 0,
    },
  };

  try {
    console.log('🔍 Validating feature flags consistency...\n');

    // Get all features from code
    const codeFeatures = Object.values(FEATURES);
    result.stats.totalCodeFeatures = codeFeatures.length;

    // Get all features from database
    const dbFeatures = await prisma.feature.findMany({
      select: {
        key: true,
        name: true,
        isEnabled: true,
        environment: true,
        category: true,
      },
    });
    result.stats.totalDbFeatures = dbFeatures.length;

    console.log(`📊 Statistics:`);
    console.log(`   - Code features: ${result.stats.totalCodeFeatures}`);
    console.log(`   - Database features: ${result.stats.totalDbFeatures}\n`);

    // Check for features in code but missing in database
    const dbFeatureKeys = new Set(dbFeatures.map((f) => f.key));
    const missingInDb = codeFeatures.filter((key) => !dbFeatureKeys.has(key as string));
    result.stats.missingInDb = missingInDb.length;

    if (missingInDb.length > 0) {
      result.success = false;
      result.errors.push(`❌ Features defined in code but missing in database:`);
      missingInDb.forEach((key) => {
        result.errors.push(`   - ${key}`);
      });
      result.errors.push('');
    }

    // Check for features in database but not in code (orphaned)
    const codeFeatureSet = new Set(codeFeatures as string[]);
    const orphanedInDb = dbFeatures.map((f) => f.key).filter((key) => !codeFeatureSet.has(key));
    result.stats.orphanedInDb = orphanedInDb.length;

    if (orphanedInDb.length > 0) {
      result.warnings.push(`⚠️  Features in database but not in code (orphaned):`);
      orphanedInDb.forEach((key) => {
        result.warnings.push(`   - ${key}`);
      });
      result.warnings.push('');
    }

    // Check feature configurations
    const configIssues: string[] = [];

    for (const dbFeature of dbFeatures) {
      if (codeFeatureSet.has(dbFeature.key)) {
        // Check if production features are properly configured
        if (dbFeature.environment.includes('production') && !dbFeature.isEnabled) {
          configIssues.push(`   - ${dbFeature.key}: Disabled in production`);
        }

        // Check if experimental features are in production
        if (dbFeature.category === 'experimental' && dbFeature.environment.includes('production')) {
          configIssues.push(`   - ${dbFeature.key}: Experimental feature enabled in production`);
        }
      }
    }

    if (configIssues.length > 0) {
      result.warnings.push(`⚠️  Configuration warnings:`);
      result.warnings.push(...configIssues);
      result.warnings.push('');
    }

    // Display results
    if (result.errors.length > 0) {
      console.log(result.errors.join('\n'));
    }

    if (result.warnings.length > 0) {
      console.log(result.warnings.join('\n'));
    }

    if (result.success && result.warnings.length === 0) {
      console.log('✅ All feature flags are consistent!\n');
    } else if (result.success) {
      console.log('✅ Feature flags are consistent (with warnings)\n');
    }

    return result;
  } catch (error) {
    result.success = false;
    result.errors.push(
      `💥 Validation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return result;
  } finally {
    await prisma.$disconnect();
  }
}

async function generateMissingFeatures(missingFeatures: string[]): Promise<void> {
  if (missingFeatures.length === 0) return;

  console.log('🔧 Generating SQL to add missing features:\n');
  console.log('-- Add missing features to database');
  console.log('INSERT INTO "Feature" (');
  console.log('  "key", "name", "description", "isEnabled", "environment",');
  console.log('  "rolloutType", "category", "isPlanBased", "requiresAdmin",');
  console.log('  "createdAt", "updatedAt"');
  console.log(') VALUES');

  const values = missingFeatures.map((featureKey, index) => {
    const name = featureKey
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    // Determine category based on feature key
    let category = 'core';
    if (featureKey.includes('integration')) category = 'integration';
    else if (featureKey.includes('analytics')) category = 'analytics';
    else if (featureKey.includes('billing') || featureKey.includes('invoice')) category = 'billing';
    else if (featureKey.includes('ai_') || featureKey.includes('experimental'))
      category = 'experimental';

    const isLast = index === missingFeatures.length - 1;
    return `  ('${featureKey}', '${name}', 'TODO: Add description', true, ARRAY['development', 'staging', 'production'], 'boolean', '${category}', false, false, NOW(), NOW())${isLast ? '' : ','}`;
  });

  console.log(values.join('\n'));
  console.log('ON CONFLICT ("key") DO NOTHING;\n');
}

// CLI interface
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const shouldGenerateSQL = args.includes('--generate-sql');
  const shouldExitOnError = !args.includes('--no-exit');

  const result = await validateFeatures();

  if (shouldGenerateSQL && result.stats.missingInDb > 0) {
    // Get features from database to determine missing ones
    const dbFeatures = await prisma.feature.findMany({ select: { key: true } });
    const dbFeatureKeys = new Set(dbFeatures.map((f) => f.key));
    const missingFeatures = Object.values(FEATURES)
      .filter((key) => !dbFeatureKeys.has(key as string))
      .map((key) => key as string);
    await generateMissingFeatures(missingFeatures);
  }

  if (!result.success && shouldExitOnError) {
    process.exit(1);
  } else if (!result.success) {
    console.log('❌ Validation completed with errors');
  } else {
    console.log('✅ Validation completed successfully');
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Validation script failed:', error);
    process.exit(1);
  });
}

export { validateFeatures, type ValidationResult };
