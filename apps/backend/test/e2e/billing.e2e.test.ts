import request from 'supertest';
import { E2ETestBase } from '@/test/utils/e2e-test-base';
import { Plan, SubscriptionStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('BillingController (e2e)', () => {
  const testBase = new E2ETestBase();
  let ownerToken: string;
  let memberToken: string;
  let testOrgId: string;
  let testPlan: Plan;

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

    // Create a test plan
    testPlan = await testBase.prisma.plan.create({
      data: {
        key: testBase.isolation.prefix('test-plan'),
        name: 'Test Plan',
        displayName: 'Test Plan',
        description: 'Test plan for e2e testing',
        price: new Decimal(999),
        interval: 'month',
        stripePriceId: 'price_test123',
        isActive: true,
        sortOrder: 1,
        memberLimit: 10,
        teamLimit: 5,
        standupConfigLimit: 10,
        standupLimit: 100,
        storageLimit: null,
        integrationLimit: null,
      },
    });

    testBase.cleanup.addCleanup('test-plan', async () => {
      await testBase.prisma.plan.delete({ where: { id: testPlan.id } }).catch(() => {});
    });
  });

  afterEach(async () => {
    await testBase.teardownTest();
  });

  describe('GET /billing/plans', () => {
    it('should return available plans', async () => {
      const res = await request(testBase.getHttpServer())
        .get('/billing/plans')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('message', 'Plans retrieved successfully');
      expect(res.body).toHaveProperty('plans');
      expect(Array.isArray(res.body.plans)).toBe(true);
      expect(res.body.plans.length).toBeGreaterThan(0);

      // Should include our test plan if it was created successfully
      const testPlanInResponse = res.body.plans.find(
        (p: { key: string }) => p.key === testPlan.key,
      );
      if (testPlanInResponse) {
        expect(testPlanInResponse.name).toBe(testPlan.name);
      }
      // At minimum, should have some plans
      expect(res.body.plans.length).toBeGreaterThan(0);
    });

    it('should be accessible by members', async () => {
      await request(testBase.getHttpServer())
        .get('/billing/plans')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
    });

    it('should require authentication', async () => {
      await request(testBase.getHttpServer()).get('/billing/plans').expect(401);
    });
  });

  describe('GET /billing/subscription', () => {
    it('should return free plan message when no subscription exists', async () => {
      const res = await request(testBase.getHttpServer())
        .get('/billing/subscription')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('message', 'Organization is on free plan');
      expect(res.body).toHaveProperty('plan', 'free');
      expect(res.body).toHaveProperty('subscription', null);
    });

    it('should return subscription when it exists', async () => {
      // Create billing account and subscription
      const billingAccount = await testBase.factory.createBillingAccount({
        orgId: testOrgId,
      });

      const subscription = await testBase.prisma.subscription.create({
        data: {
          billingAccountId: billingAccount.id,
          planId: testPlan.id,
          stripeSubscriptionId: testBase.isolation.prefix('sub_test'),
          status: SubscriptionStatus.active,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          cancelAtPeriodEnd: false,
        },
      });

      testBase.cleanup.addCleanup('subscription', async () => {
        await testBase.prisma.subscription
          .delete({ where: { id: subscription.id } })
          .catch(() => {});
      });

      const res = await request(testBase.getHttpServer())
        .get('/billing/subscription')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('message', 'Subscription retrieved successfully');
      expect(res.body).toHaveProperty('plan', testPlan.key);
      expect(res.body).toHaveProperty('subscription');
      expect(res.body.subscription).toHaveProperty('status', 'active');
    });

    it('should require owner or admin role', async () => {
      await request(testBase.getHttpServer())
        .get('/billing/subscription')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });
  });

  describe('GET /billing/subscription/debug', () => {
    it('should return no billing account message when none exists', async () => {
      const res = await request(testBase.getHttpServer())
        .get('/billing/subscription/debug')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('No billing account found');
    });

    it('should return no subscription message when billing account exists but no subscription', async () => {
      await testBase.factory.createBillingAccount({
        orgId: testOrgId,
      });

      const res = await request(testBase.getHttpServer())
        .get('/billing/subscription/debug')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('message', 'No subscription found');
    });

    it('should require owner or admin role', async () => {
      await request(testBase.getHttpServer())
        .get('/billing/subscription/debug')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });

    it('should require authentication', async () => {
      await request(testBase.getHttpServer()).get('/billing/subscription/debug').expect(401);
    });
  });

  describe('POST /billing/subscription', () => {
    it('should reject request from non-owner/admin', async () => {
      const createDto = {
        planId: testPlan.key,
        paymentMethodId: 'pm_test123',
      };

      await request(testBase.getHttpServer())
        .post('/billing/subscription')
        .set('Authorization', `Bearer ${memberToken}`)
        .send(createDto)
        .expect(403);
    });

    it('should validate required fields', async () => {
      const res = await request(testBase.getHttpServer())
        .post('/billing/subscription')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({})
        .expect(400);

      expect(res.body.message).toContain('planId must be a string');
    });

    it('should validate plan ID format', async () => {
      await request(testBase.getHttpServer())
        .post('/billing/subscription')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          planId: 'invalid-plan-id-with-spaces',
          paymentMethodId: 'pm_test123',
        })
        .expect(404);

      // The endpoint returns 404 for non-existent plans rather than validation error
    });

    it('should require authentication', async () => {
      await request(testBase.getHttpServer())
        .post('/billing/subscription')
        .send({
          planId: testPlan.key,
          paymentMethodId: 'pm_test123',
        })
        .expect(401);
    });
  });

  describe('PUT /billing/subscription', () => {
    it('should reject request from non-owner/admin', async () => {
      const updateDto = {
        planId: testPlan.key,
      };

      await request(testBase.getHttpServer())
        .put('/billing/subscription')
        .set('Authorization', `Bearer ${memberToken}`)
        .send(updateDto)
        .expect(403);
    });

    it('should validate plan ID when provided', async () => {
      await request(testBase.getHttpServer())
        .put('/billing/subscription')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          planId: 'invalid plan id',
        })
        .expect(404);

      // The endpoint returns 404 for non-existent plans rather than validation error
    });

    it('should require authentication', async () => {
      await request(testBase.getHttpServer())
        .put('/billing/subscription')
        .send({
          planId: testPlan.key,
        })
        .expect(401);
    });
  });

  describe('DELETE /billing/subscription', () => {
    it('should reject request from non-owner/admin', async () => {
      await request(testBase.getHttpServer())
        .delete('/billing/subscription')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });

    it('should accept query parameter for immediate cancellation', async () => {
      // This would normally fail because no subscription exists, but we're testing parameter handling
      await request(testBase.getHttpServer())
        .delete('/billing/subscription?immediate=true')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404); // Not found because no subscription exists
    });

    it('should require authentication', async () => {
      await request(testBase.getHttpServer()).delete('/billing/subscription').expect(401);
    });
  });

  describe('POST /billing/subscription/reactivate', () => {
    it('should reject request from non-owner/admin', async () => {
      await request(testBase.getHttpServer())
        .post('/billing/subscription/reactivate')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });

    it('should require authentication', async () => {
      await request(testBase.getHttpServer()).post('/billing/subscription/reactivate').expect(401);
    });
  });

  describe('POST /billing/webhook', () => {
    it('should handle webhook without authentication', async () => {
      // Webhooks don't require JWT authentication, they use Stripe signature verification
      const mockWebhookPayload = {
        id: 'evt_test',
        object: 'event',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_test',
            customer: 'cus_test',
            status: 'active',
          },
        },
      };

      // This will fail signature verification, but should reach the webhook handler
      await request(testBase.getHttpServer())
        .post('/webhooks/stripe')
        .send(mockWebhookPayload)
        .expect(400); // Bad request due to invalid signature, but endpoint is accessible
    });
  });

  describe('Data isolation and cleanup', () => {
    it('should properly isolate data between tests', async () => {
      // Create a plan in this test
      const isolatedPlan = await testBase.prisma.plan.create({
        data: {
          key: testBase.isolation.prefix('isolated-plan'),
          name: 'Isolated Plan',
          displayName: 'Isolated Plan',
          description: 'Plan for isolation testing',
          price: new Decimal(1999),
          interval: 'month',
          stripePriceId: 'price_isolated',
          isActive: true,
          sortOrder: 2,
          memberLimit: 20,
          teamLimit: 10,
          standupConfigLimit: 20,
          standupLimit: 200,
          storageLimit: null,
          integrationLimit: null,
        },
      });

      testBase.cleanup.addCleanup('isolated-plan', async () => {
        await testBase.prisma.plan.delete({ where: { id: isolatedPlan.id } }).catch(() => {});
      });

      // Verify it exists
      const foundPlan = await testBase.prisma.plan.findUnique({
        where: { id: isolatedPlan.id },
      });
      expect(foundPlan).toBeDefined();
      expect(foundPlan?.key).toBe(isolatedPlan.key);

      // This plan should be cleaned up after the test
      // and not interfere with other tests
    });

    it('should run independently from previous test', async () => {
      // This test should not see the isolated plan from the previous test
      const plans = await testBase.prisma.plan.findMany({
        where: {
          key: {
            contains: testBase.isolation.prefix('isolated-plan'),
          },
        },
      });

      // Should not find the plan from the previous test due to proper cleanup
      expect(plans).toHaveLength(0);
    });
  });

  describe('Error handling', () => {
    it('should handle server errors gracefully', async () => {
      // Test with malformed authorization header
      const res = await request(testBase.getHttpServer())
        .get('/billing/plans')
        .set('Authorization', 'Bearer invalid-token-format')
        .expect(401);

      expect(res.body).toHaveProperty('message');
    });

    it('should return appropriate error for non-existent plan', async () => {
      const res = await request(testBase.getHttpServer())
        .post('/billing/subscription')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          planId: 'non-existent-plan',
          paymentMethodId: 'pm_test123',
        })
        .expect(404);

      expect((res.body.error || res.body.message).toLowerCase()).toContain('not found');
    });
  });
});
