import { PrismaClient } from '@prisma/client';

/**
 * Provides data isolation for parallel test execution using unique prefixes
 */
export class DataIsolation {
  private testId: string;
  private createdRecords: Map<string, Set<string>> = new Map();

  constructor() {
    // Create unique prefix using worker ID, timestamp, random string, and process ID
    const workerId = process.env.JEST_WORKER_ID || '1';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15); // Longer random string
    const pid = process.pid;
    const nanoTime = process.hrtime.bigint();
    this.testId = `test_${workerId}_${pid}_${timestamp}_${nanoTime}_${random}`;
  }

  /**
   * Get the unique test ID for this test run
   */
  getTestId(): string {
    return this.testId;
  }

  /**
   * Prefix a value with the test ID for isolation
   */
  prefix(value: string): string {
    return `${this.testId}_${value}`;
  }

  /**
   * Track a created record for cleanup
   */
  trackRecord(table: string, id: string): void {
    if (!this.createdRecords.has(table)) {
      this.createdRecords.set(table, new Set());
    }
    this.createdRecords.get(table)!.add(id);
  }

  /**
   * Clean up all data created with this test's prefix
   */
  async cleanup(prisma: PrismaClient): Promise<void> {
    const errors: Error[] = [];

    try {
      // Use transaction for atomic cleanup
      await prisma.$transaction(async (tx) => {
        // Clean up in reverse dependency order

        // Clean up standup-related tables first
        // Get standup instances that belong to our test data
        const standupInstances = await tx.standupInstance.findMany({
          where: {
            OR: [{ team: { name: { contains: this.testId } } }],
          },
          select: { id: true },
        });

        const standupInstanceIds = standupInstances.map((si) => si.id);

        if (standupInstanceIds.length > 0) {
          await tx.answer.deleteMany({
            where: { standupInstanceId: { in: standupInstanceIds } },
          });

          await tx.participationSnapshot.deleteMany({
            where: { standupInstanceId: { in: standupInstanceIds } },
          });

          await tx.standupDigestPost.deleteMany({
            where: { standupInstanceId: { in: standupInstanceIds } },
          });
        }

        await tx.standupInstance.deleteMany({
          where: {
            OR: [{ team: { name: { contains: this.testId } } }],
          },
        });

        // Get standup configs that belong to our test data
        const standupConfigs = await tx.standupConfig.findMany({
          where: { name: { contains: this.testId } },
          select: { id: true },
        });

        const standupConfigIds = standupConfigs.map((sc) => sc.id);

        if (standupConfigIds.length > 0) {
          await tx.standupConfigMember.deleteMany({
            where: { standupConfigId: { in: standupConfigIds } },
          });
        }

        await tx.standupConfig.deleteMany({
          where: { name: { contains: this.testId } },
        });

        // Clean up team-related tables
        await tx.teamMember.deleteMany({
          where: { team: { name: { contains: this.testId } } },
        });

        await tx.team.deleteMany({
          where: { name: { contains: this.testId } },
        });

        // Clean up integration-related tables
        await tx.integrationUser.deleteMany({
          where: {
            OR: [
              { email: { contains: this.testId } },
              { name: { contains: this.testId } },
              { displayName: { contains: this.testId } },
            ],
          },
        });

        await tx.channel.deleteMany({
          where: { name: { contains: this.testId } },
        });

        await tx.integrationSyncState.deleteMany({
          where: { integration: { externalTeamId: { contains: this.testId } } },
        });

        await tx.tokenRefreshJob.deleteMany({
          where: { integration: { externalTeamId: { contains: this.testId } } },
        });

        await tx.integration.deleteMany({
          where: { externalTeamId: { contains: this.testId } },
        });

        // Clean up user/org related tables
        await tx.auditLog.deleteMany({
          where: {
            OR: [{ actorUser: { email: { contains: this.testId } } }],
          },
        });

        await tx.orgMember.deleteMany({
          where: {
            OR: [{ user: { email: { contains: this.testId } } }],
          },
        });

        await tx.passwordResetToken.deleteMany({
          where: { user: { email: { contains: this.testId } } },
        });

        await tx.refreshToken.deleteMany({
          where: { user: { email: { contains: this.testId } } },
        });

        await tx.session.deleteMany({
          where: { user: { email: { contains: this.testId } } },
        });

        await tx.user.deleteMany({
          where: {
            OR: [{ email: { contains: this.testId } }, { name: { contains: this.testId } }],
          },
        });

        await tx.organization.deleteMany({
          where: { name: { contains: this.testId } },
        });
      });
    } catch (error) {
      console.warn(`Cleanup failed for test ${this.testId}:`, error);
      errors.push(error as Error);
    }

    // Clear tracked records
    this.createdRecords.clear();

    if (errors.length > 0) {
      console.warn(`${errors.length} cleanup errors occurred`);
    }
  }

  /**
   * Generate a unique email for testing
   */
  generateEmail(prefix: string = 'user'): string {
    return this.prefix(`${prefix}@test.com`);
  }

  /**
   * Generate a unique organization name
   */
  generateOrgName(prefix: string = 'org'): string {
    return this.prefix(`Test ${prefix}`);
  }

  /**
   * Generate a unique team name
   */
  generateTeamName(prefix: string = 'team'): string {
    return this.prefix(`Team ${prefix}`);
  }

  /**
   * Generate a unique external ID for integrations
   */
  generateExternalId(prefix: string = ''): string {
    return this.prefix(`EXT${prefix}${Date.now()}`);
  }
}
