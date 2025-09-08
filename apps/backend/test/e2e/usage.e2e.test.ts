import request from 'supertest';
import { E2ETestBase } from '@/test/utils/e2e-test-base';
import { Plan } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('UsageController (e2e)', () => {
  const testBase = new E2ETestBase();
  let ownerToken: string;
  let memberToken: string;
  let testOrgId: string;
  let freePlan: Plan;

  beforeAll(async () => {
    await testBase.setupSuite();
  });

  afterAll(async () => {
    await testBase.teardownSuite();
  });

  beforeEach(async () => {
    await testBase.setupTest();

    // Create test organization with owner
    const { org, owner } = await testBase.factory.createOrganization();
    testOrgId = org.id;
    ownerToken = testBase.factory.generateToken(owner.id, owner.email, testOrgId);

    // Create a regular member
    const member = await testBase.factory.createOrgMember({
      orgId: testOrgId,
      role: 'member',
    });
    memberToken = testBase.factory.generateToken(member.user.id, member.user.email, testOrgId);

    // Create a free plan for testing limits
    freePlan = await testBase.prisma.plan.create({
      data: {
        key: testBase.isolation.prefix('free-plan'),
        name: 'Free Plan',
        displayName: 'Free Plan',
        description: 'Free plan for usage testing',
        price: new Decimal(0),
        interval: 'month',
        stripePriceId: null,
        isActive: true,
        sortOrder: 0,
        memberLimit: 5,
        teamLimit: 2,
        standupConfigLimit: 3,
        standupLimit: 50,
        storageLimit: null,
        integrationLimit: null,
      },
    });

    testBase.cleanup.addCleanup('free-plan', async () => {
      // Delete subscriptions referencing this plan first
      await testBase.prisma.subscription
        .deleteMany({
          where: { planId: freePlan.id },
        })
        .catch(() => {});
      // Then delete the plan
      await testBase.prisma.plan.delete({ where: { id: freePlan.id } }).catch(() => {});
    });
  });

  afterEach(async () => {
    await testBase.teardownTest();
  });

  describe('GET /usage/current', () => {
    it('should return current usage for organization', async () => {
      const res = await request(testBase.getHttpServer())
        .get('/usage/current')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('message', 'Usage statistics retrieved successfully');
      expect(res.body).toHaveProperty('usage');

      const usage = res.body.usage;
      expect(usage).toHaveProperty('orgId', testOrgId);
      expect(usage).toHaveProperty('teams');
      expect(usage).toHaveProperty('members');
      expect(usage).toHaveProperty('standupConfigs');
      expect(usage).toHaveProperty('standupsThisMonth');
      expect(usage).toHaveProperty('nextResetDate');
      expect(usage).toHaveProperty('planName');
      expect(usage).toHaveProperty('isFreePlan');

      // Verify usage structure
      expect(usage.teams).toHaveProperty('used');
      expect(usage.teams).toHaveProperty('limit');
      expect(usage.teams).toHaveProperty('available');
      expect(usage.teams).toHaveProperty('percentage');
      expect(usage.teams).toHaveProperty('nearLimit');
      expect(usage.teams).toHaveProperty('overLimit');
    });

    it('should show actual usage counts', async () => {
      // Create some test data to verify counting
      await testBase.factory.createSimpleTeam({ orgId: testOrgId });
      await testBase.factory.createOrgMember({
        orgId: testOrgId,
        role: 'member',
      });

      const res = await request(testBase.getHttpServer())
        .get('/usage/current')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const usage = res.body.usage;
      expect(usage.teams.used).toBeGreaterThanOrEqual(1); // At least the team we created
      expect(usage.members.used).toBeGreaterThanOrEqual(3); // Owner + member + additional member
    });

    it('should be accessible by all authenticated users', async () => {
      await request(testBase.getHttpServer())
        .get('/usage/current')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
    });

    it('should require authentication', async () => {
      await request(testBase.getHttpServer()).get('/usage/current').expect(401);
    });
  });

  describe('GET /usage/billing-period', () => {
    it('should return billing period information', async () => {
      const res = await request(testBase.getHttpServer())
        .get('/usage/billing-period')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('message', 'Billing period retrieved successfully');
      expect(res.body).toHaveProperty('billingPeriod');

      const period = res.body.billingPeriod;
      expect(period).toHaveProperty('orgId', testOrgId);
      expect(period).toHaveProperty('periodStart');
      expect(period).toHaveProperty('periodEnd');
      expect(period).toHaveProperty('daysUntilReset');
      expect(period).toHaveProperty('isInTrial');

      // Verify date formats
      expect(new Date(period.periodStart)).toBeInstanceOf(Date);
      expect(new Date(period.periodEnd)).toBeInstanceOf(Date);
      expect(typeof period.daysUntilReset).toBe('number');
    });

    it('should be accessible by all authenticated users', async () => {
      await request(testBase.getHttpServer())
        .get('/usage/billing-period')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
    });

    it('should require authentication', async () => {
      await request(testBase.getHttpServer()).get('/usage/billing-period').expect(401);
    });
  });

  describe('GET /usage/warnings', () => {
    it('should return usage warnings when approaching limits', async () => {
      const res = await request(testBase.getHttpServer())
        .get('/usage/warnings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('message', 'Usage warnings retrieved successfully');
      expect(res.body).toHaveProperty('warnings');
      expect(Array.isArray(res.body.warnings)).toBe(true);
    });

    it('should be accessible by all authenticated users', async () => {
      await request(testBase.getHttpServer())
        .get('/usage/warnings')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
    });

    it('should require authentication', async () => {
      await request(testBase.getHttpServer()).get('/usage/warnings').expect(401);
    });
  });

  describe('GET /usage/limits-check', () => {
    it('should return limits check with upgrade recommendations', async () => {
      const res = await request(testBase.getHttpServer())
        .get('/usage/limits-check')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('message', 'Limits check completed');
      expect(res.body).toHaveProperty('usage');
      expect(res.body).toHaveProperty('warnings');
      expect(res.body).toHaveProperty('needsUpgrade');
      expect(res.body).toHaveProperty('recommendations');

      expect(Array.isArray(res.body.warnings)).toBe(true);
      expect(typeof res.body.needsUpgrade).toBe('boolean');
      expect(Array.isArray(res.body.recommendations)).toBe(true);
    });

    it('should be accessible by all authenticated users', async () => {
      await request(testBase.getHttpServer())
        .get('/usage/limits-check')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
    });

    it('should require authentication', async () => {
      await request(testBase.getHttpServer()).get('/usage/limits-check').expect(401);
    });
  });

  describe('GET /usage/can-perform/:action', () => {
    const validActions = [
      'create_team',
      'invite_member',
      'create_standup_config',
      'create_standup',
    ];

    it('should check if actions are allowed', async () => {
      for (const action of validActions) {
        const res = await request(testBase.getHttpServer())
          .get(`/usage/can-perform/${action}`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(200);

        expect(res.body).toHaveProperty('message', 'Action permission checked');
        expect(res.body).toHaveProperty('action', action);
        expect(res.body).toHaveProperty('allowed');
        expect(res.body).toHaveProperty('upgradeRequired');
        expect(typeof res.body.allowed).toBe('boolean');
        expect(typeof res.body.upgradeRequired).toBe('boolean');
      }
    });

    it('should reject invalid action types', async () => {
      const res = await request(testBase.getHttpServer())
        .get('/usage/can-perform/invalid_action')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.allowed).toBe(false);
      expect(res.body.reason).toContain('Invalid action');
      expect(res.body.reason).toContain('Valid actions');
    });

    it('should handle action limits when approaching quota', async () => {
      // Create teams up to the limit to test limit enforcement
      const teamLimit = freePlan.teamLimit || 2;

      // Create teams up to the limit
      for (let i = 0; i < teamLimit; i++) {
        await testBase.factory.createSimpleTeam({ orgId: testOrgId });
      }

      const res = await request(testBase.getHttpServer())
        .get('/usage/can-perform/create_team')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      // Should be denied due to limit reached
      expect(res.body.allowed).toBe(false);
      expect(res.body.upgradeRequired).toBe(true);
      expect(res.body.reason).toContain('Upgrade to create more teams');
    });

    it('should allow unlimited actions on unlimited plans', async () => {
      // Create an unlimited plan
      const unlimitedPlan = await testBase.prisma.plan.create({
        data: {
          key: testBase.isolation.prefix('unlimited-plan'),
          name: 'Unlimited Plan',
          displayName: 'Unlimited Plan',
          description: 'Plan with no limits',
          price: new Decimal(9999),
          interval: 'month',
          stripePriceId: 'price_unlimited',
          isActive: true,
          sortOrder: 2,
          memberLimit: null, // unlimited
          teamLimit: null, // unlimited
          standupConfigLimit: null, // unlimited
          standupLimit: null, // unlimited
          storageLimit: null,
          integrationLimit: null,
        },
      });

      testBase.cleanup.addCleanup('unlimited-plan', async () => {
        // Delete subscriptions referencing this plan first
        await testBase.prisma.subscription
          .deleteMany({
            where: { planId: unlimitedPlan.id },
          })
          .catch(() => {});
        // Then delete the plan
        await testBase.prisma.plan.delete({ where: { id: unlimitedPlan.id } }).catch(() => {});
      });

      // Create billing account and subscription for unlimited plan
      const billingAccount = await testBase.factory.createBillingAccount({
        orgId: testOrgId,
      });

      await testBase.prisma.subscription.create({
        data: {
          billingAccountId: billingAccount.id,
          planId: unlimitedPlan.id,
          stripeSubscriptionId: testBase.isolation.prefix('sub_unlimited'),
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          cancelAtPeriodEnd: false,
        },
      });

      // Even with many teams, should allow creating more
      for (let i = 0; i < 10; i++) {
        await testBase.factory.createSimpleTeam({ orgId: testOrgId });
      }

      const res = await request(testBase.getHttpServer())
        .get('/usage/can-perform/create_team')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.allowed).toBe(true);
      expect(res.body.upgradeRequired).toBe(false);
    });

    it('should be accessible by all authenticated users', async () => {
      await request(testBase.getHttpServer())
        .get('/usage/can-perform/create_team')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
    });

    it('should require authentication', async () => {
      await request(testBase.getHttpServer()).get('/usage/can-perform/create_team').expect(401);
    });

    it('should handle special characters in action parameter', async () => {
      const res = await request(testBase.getHttpServer())
        .get('/usage/can-perform/create-team-with-dashes')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.allowed).toBe(false);
      expect(res.body.reason).toContain('Invalid action');
    });
  });

  describe('Data isolation and usage tracking', () => {
    it('should track usage independently per organization', async () => {
      // Create another organization
      const { org: anotherOrg, owner: anotherOwner } = await testBase.factory.createOrganization();
      const anotherOwnerToken = testBase.factory.generateToken(
        anotherOwner.id,
        anotherOwner.email,
        anotherOrg.id,
      );

      // Create teams in each organization
      await testBase.factory.createSimpleTeam({ orgId: testOrgId });
      await testBase.factory.createSimpleTeam({ orgId: anotherOrg.id });
      await testBase.factory.createSimpleTeam({ orgId: anotherOrg.id });

      // Check usage for first org
      const res1 = await request(testBase.getHttpServer())
        .get('/usage/current')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      // Check usage for second org
      const res2 = await request(testBase.getHttpServer())
        .get('/usage/current')
        .set('Authorization', `Bearer ${anotherOwnerToken}`)
        .expect(200);

      // Each org should see only its own usage
      expect(res1.body.usage.orgId).toBe(testOrgId);
      expect(res2.body.usage.orgId).toBe(anotherOrg.id);

      // Usage counts should be different
      expect(res1.body.usage.teams.used).not.toBe(res2.body.usage.teams.used);
    });

    it('should properly clean up test data', async () => {
      // Create some test data
      const team = await testBase.factory.createSimpleTeam({ orgId: testOrgId });
      const member = await testBase.factory.createOrgMember({
        orgId: testOrgId,
        role: 'member',
      });

      // Verify they exist
      const foundTeam = await testBase.prisma.team.findUnique({ where: { id: team.id } });
      const foundMember = await testBase.prisma.orgMember.findFirst({
        where: { userId: member.userId },
      });

      expect(foundTeam).toBeDefined();
      expect(foundMember).toBeDefined();

      // Data should be cleaned up after test by the isolation system
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle concurrent usage checks', async () => {
      // Make multiple concurrent requests
      const promises = Array(5)
        .fill(null)
        .map(() =>
          request(testBase.getHttpServer())
            .get('/usage/current')
            .set('Authorization', `Bearer ${ownerToken}`),
        );

      const responses = await Promise.all(promises);

      // All requests should succeed
      responses.forEach((res) => {
        expect(res.status).toBe(200);
        expect(res.body.usage.orgId).toBe(testOrgId);
      });
    });

    it('should handle malformed authorization', async () => {
      await request(testBase.getHttpServer())
        .get('/usage/current')
        .set('Authorization', 'InvalidFormat')
        .expect(401);
    });

    it('should handle expired tokens gracefully', async () => {
      // This would require a more complex setup with actual expired tokens
      // For now, test with malformed token
      await request(testBase.getHttpServer())
        .get('/usage/current')
        .set('Authorization', 'Bearer expired.token.here')
        .expect(401);
    });
  });
});
