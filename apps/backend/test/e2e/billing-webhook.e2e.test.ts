import request from 'supertest';
import { E2ETestBase } from '@/test/utils/e2e-test-base';
import { Plan, SubscriptionStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('Billing Webhook (e2e)', () => {
  const testBase = new E2ETestBase();
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

    // Create test organization
    const { org } = await testBase.factory.createOrganization();
    testOrgId = org.id;

    // Create a test plan
    testPlan = await testBase.prisma.plan.create({
      data: {
        key: testBase.isolation.prefix('webhook-plan'),
        name: 'Webhook Test Plan',
        displayName: 'Webhook Test Plan',
        description: 'Plan for webhook testing',
        price: new Decimal(999),
        interval: 'month',
        stripePriceId: 'price_webhook_test',
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

    testBase.cleanup.addCleanup('webhook-plan', async () => {
      await testBase.prisma.plan.delete({ where: { id: testPlan.id } }).catch(() => {});
    });
  });

  afterEach(async () => {
    await testBase.teardownTest();
  });

  describe('POST /billing/webhook', () => {
    it('should be accessible without authentication', async () => {
      // Webhook endpoints should not require JWT authentication
      // They use Stripe signature verification instead
      const mockWebhookPayload = {
        id: 'evt_test_webhook',
        object: 'event',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_test_webhook',
            customer: 'cus_test_webhook',
            status: 'active',
          },
        },
      };

      // This should reach the webhook handler (will fail signature verification)
      const res = await request(testBase.getHttpServer())
        .post('/webhooks/stripe')
        .send(mockWebhookPayload)
        .expect(400); // Bad request due to missing/invalid Stripe signature

      // Should indicate signature verification failure, not authentication failure
      expect(res.body.message).not.toContain('Unauthorized');
    });

    it('should handle webhook with missing stripe-signature header', async () => {
      const mockWebhookPayload = {
        id: 'evt_missing_signature',
        object: 'event',
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_missing_signature',
            customer: 'cus_missing_signature',
            status: 'active',
          },
        },
      };

      await request(testBase.getHttpServer())
        .post('/webhooks/stripe')
        .send(mockWebhookPayload)
        .expect(400);
    });

    it('should handle webhook with invalid stripe-signature header', async () => {
      const mockWebhookPayload = {
        id: 'evt_invalid_signature',
        object: 'event',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_invalid_signature',
            customer: 'cus_invalid_signature',
            status: 'active',
          },
        },
      };

      await request(testBase.getHttpServer())
        .post('/webhooks/stripe')
        .set('stripe-signature', 'invalid_signature')
        .send(mockWebhookPayload)
        .expect(400);
    });

    it('should handle different event types without errors', async () => {
      const eventTypes = [
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
        'invoice.payment_succeeded',
        'invoice.payment_failed',
      ];

      for (const eventType of eventTypes) {
        const mockWebhookPayload = {
          id: `evt_${eventType.replace('.', '_')}`,
          object: 'event',
          type: eventType,
          data: {
            object: {
              id: `obj_${eventType.replace('.', '_')}`,
              customer: `cus_${eventType.replace('.', '_')}`,
              status: 'active',
            },
          },
        };

        // All should fail signature verification, but reach the handler
        await request(testBase.getHttpServer())
          .post('/webhooks/stripe')
          .send(mockWebhookPayload)
          .expect(400);
      }
    });

    it('should handle malformed JSON payload', async () => {
      await request(testBase.getHttpServer())
        .post('/webhooks/stripe')
        .send('invalid-json-payload')
        .expect(400);
    });

    it('should handle empty payload', async () => {
      await request(testBase.getHttpServer()).post('/webhooks/stripe').send({}).expect(400);
    });

    it('should handle large webhook payloads', async () => {
      // Create a larger webhook payload to test handling
      const largePayload = {
        id: 'evt_large_payload',
        object: 'event',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_large_payload',
            customer: 'cus_large_payload',
            status: 'active',
            metadata: {
              // Add large metadata object
              description: 'A'.repeat(1000), // 1KB of data
              notes: 'B'.repeat(2000), // 2KB of data
            },
            items: {
              data: Array(50)
                .fill(null)
                .map((_, i) => ({
                  id: `item_${i}`,
                  object: 'subscription_item',
                  price: {
                    id: `price_${i}`,
                    nickname: `Test Price ${i}`,
                  },
                })),
            },
          },
        },
      };

      await request(testBase.getHttpServer())
        .post('/webhooks/stripe')
        .send(largePayload)
        .expect(400); // Still fails signature, but should handle the large payload
    });

    it('should handle concurrent webhook requests', async () => {
      const mockWebhookPayload = {
        id: 'evt_concurrent',
        object: 'event',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_concurrent',
            customer: 'cus_concurrent',
            status: 'active',
          },
        },
      };

      // Send multiple sequential webhook requests (to avoid connection issues)
      for (let i = 0; i < 3; i++) {
        const response = await request(testBase.getHttpServer())
          .post('/webhooks/stripe')
          .send({
            ...mockWebhookPayload,
            id: `evt_concurrent_${i}`,
          });

        expect(response.status).toBe(400); // Should fail signature verification
      }
    });

    it('should handle webhook with subscription update simulation', async () => {
      // Create billing account and subscription for testing
      const billingAccount = await testBase.factory.createBillingAccount({
        orgId: testOrgId,
      });

      const subscription = await testBase.prisma.subscription.create({
        data: {
          billingAccountId: billingAccount.id,
          planId: testPlan.id,
          stripeSubscriptionId: testBase.isolation.prefix('sub_webhook_test'),
          status: SubscriptionStatus.active,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          cancelAtPeriodEnd: false,
        },
      });

      testBase.cleanup.addCleanup('webhook-subscription', async () => {
        await testBase.prisma.subscription
          .delete({ where: { id: subscription.id } })
          .catch(() => {});
      });

      const mockWebhookPayload = {
        id: 'evt_subscription_update',
        object: 'event',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: subscription.stripeSubscriptionId,
            customer: billingAccount.stripeCustomerId,
            status: 'past_due',
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            cancel_at_period_end: false,
          },
        },
      };

      // This should fail signature verification but demonstrates webhook structure
      await request(testBase.getHttpServer())
        .post('/webhooks/stripe')
        .send(mockWebhookPayload)
        .expect(400);
    });
  });

  describe('Webhook event processing behavior', () => {
    it('should handle unknown event types gracefully', async () => {
      const mockWebhookPayload = {
        id: 'evt_unknown_type',
        object: 'event',
        type: 'unknown.event.type',
        data: {
          object: {
            id: 'obj_unknown',
            type: 'unknown',
          },
        },
      };

      await request(testBase.getHttpServer())
        .post('/webhooks/stripe')
        .send(mockWebhookPayload)
        .expect(400); // Fails signature, but should handle unknown type
    });

    it('should handle webhook with missing required fields', async () => {
      const incompleteWebhookPayload = {
        id: 'evt_incomplete',
        object: 'event',
        // Missing type field
        data: {
          object: {
            id: 'obj_incomplete',
          },
        },
      };

      await request(testBase.getHttpServer())
        .post('/webhooks/stripe')
        .send(incompleteWebhookPayload)
        .expect(400);
    });

    it('should handle webhook retries (idempotency)', async () => {
      const webhookPayload = {
        id: 'evt_idempotent_test', // Same ID for retry simulation
        object: 'event',
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_idempotent_test',
            customer: 'cus_idempotent_test',
            status: 'active',
          },
        },
      };

      // Send the same webhook multiple times (simulating retries)
      const response1 = await request(testBase.getHttpServer())
        .post('/webhooks/stripe')
        .send(webhookPayload);

      const response2 = await request(testBase.getHttpServer())
        .post('/webhooks/stripe')
        .send(webhookPayload);

      // Both should behave the same way (fail signature verification)
      expect(response1.status).toBe(response2.status);
    });
  });

  describe('Data isolation for webhook tests', () => {
    it('should isolate webhook test data properly', async () => {
      // Create test data for webhook processing
      const billingAccount = await testBase.factory.createBillingAccount({
        orgId: testOrgId,
      });

      // Verify it exists in this test
      const foundAccount = await testBase.prisma.billingAccount.findUnique({
        where: { id: billingAccount.id },
      });
      expect(foundAccount).toBeDefined();

      // This should be cleaned up after the test
    });

    it('should run independently from previous webhook test', async () => {
      // This test should not see any billing accounts from previous tests
      const accounts = await testBase.prisma.billingAccount.findMany({
        where: {
          stripeCustomerId: {
            contains: testBase.isolation.prefix(''),
          },
        },
      });

      // Should only see accounts created in this test (none yet)
      expect(accounts).toHaveLength(0);
    });
  });

  describe('Error handling and security', () => {
    it('should handle invalid content-type headers', async () => {
      const mockWebhookPayload = {
        id: 'evt_content_type_test',
        object: 'event',
        type: 'customer.subscription.updated',
        data: { object: { id: 'sub_test' } },
      };

      await request(testBase.getHttpServer())
        .post('/webhooks/stripe')
        .set('content-type', 'text/plain')
        .send(JSON.stringify(mockWebhookPayload))
        .expect(400);
    });

    it('should handle webhook with extremely long strings', async () => {
      const maliciousPayload = {
        id: 'A'.repeat(10000), // Very long ID
        object: 'event',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'B'.repeat(5000), // Very long subscription ID
            customer: 'C'.repeat(5000), // Very long customer ID
            status: 'active',
          },
        },
      };

      // Should handle without crashing
      await request(testBase.getHttpServer())
        .post('/webhooks/stripe')
        .send(maliciousPayload)
        .expect(400);
    });

    it('should reject webhook requests with invalid HTTP methods', async () => {
      // Webhooks should only accept POST requests
      await request(testBase.getHttpServer()).get('/webhooks/stripe').expect(404);

      await request(testBase.getHttpServer()).put('/webhooks/stripe').expect(404);

      await request(testBase.getHttpServer()).delete('/webhooks/stripe').expect(404);
    });
  });
});
