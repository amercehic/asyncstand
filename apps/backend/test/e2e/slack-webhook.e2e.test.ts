import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import * as crypto from 'crypto';

describe('Slack Webhook (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Set test environment variable for Slack signing secret
    process.env.SLACK_SIGNING_SECRET = 'test-signing-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // Helper function to create Slack signature for webhook verification
  function createSlackSignature(
    timestamp: string,
    body: string | Record<string, unknown>,
    secret: string = 'test-signing-secret',
  ): string {
    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    const sig = `v0:${timestamp}:${bodyString}`;
    const signature = crypto.createHmac('sha256', secret).update(sig).digest('hex');
    return `v0=${signature}`;
  }

  describe('POST /slack/events', () => {
    it('should handle URL verification challenge', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const challenge = 'test-challenge-string';
      const payload = {
        token: 'test-token',
        challenge,
        type: 'url_verification',
      };

      const signature = createSlackSignature(timestamp, payload);

      const response = await request(app.getHttpServer())
        .post('/slack/events')
        .set('x-slack-signature', signature)
        .set('x-slack-request-timestamp', timestamp)
        .send(payload)
        .expect(201);

      expect(response.body).toHaveProperty('challenge', challenge);
    });

    it('should handle event callback with valid signature', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = {
        token: 'test-token',
        team_id: 'T1234567890',
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'U1234567890',
          text: 'Hello world',
          channel: 'C1234567890',
          ts: '1234567890.123456',
        },
      };

      const signature = createSlackSignature(timestamp, payload);

      const response = await request(app.getHttpServer())
        .post('/slack/events')
        .set('x-slack-signature', signature)
        .set('x-slack-request-timestamp', timestamp)
        .send(payload)
        .expect(201);

      expect(response.body).toHaveProperty('ok', true);
    });

    it('should reject requests with invalid signature', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = {
        token: 'test-token',
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'U1234567890',
          text: 'Hello world',
        },
      };

      const response = await request(app.getHttpServer())
        .post('/slack/events')
        .set('x-slack-signature', 'v0=invalid-signature')
        .set('x-slack-request-timestamp', timestamp)
        .send(payload)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid signature');
    });

    it('should reject requests without signature headers', async () => {
      const payload = {
        token: 'test-token',
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'U1234567890',
          text: 'Hello world',
        },
      };

      await request(app.getHttpServer()).post('/slack/events').send(payload).expect(401);
    });

    it('should handle unknown event types gracefully', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = {
        token: 'test-token',
        type: 'unknown_type',
        some_data: 'test-data',
      };

      const signature = createSlackSignature(timestamp, payload);

      const response = await request(app.getHttpServer())
        .post('/slack/events')
        .set('x-slack-signature', signature)
        .set('x-slack-request-timestamp', timestamp)
        .send(payload)
        .expect(201);

      expect(response.body).toHaveProperty('ok', true);
    });

    it('should handle malformed JSON gracefully', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();

      await request(app.getHttpServer())
        .post('/slack/events')
        .set('x-slack-signature', 'v0=invalid-signature')
        .set('x-slack-request-timestamp', timestamp)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);
    });

    it('should validate app mention events', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = {
        token: 'test-token',
        team_id: 'T1234567890',
        type: 'event_callback',
        event: {
          type: 'app_mention',
          user: 'U1234567890',
          text: '<@B1234567890> help',
          channel: 'C1234567890',
          ts: '1234567890.123456',
        },
      };

      const signature = createSlackSignature(timestamp, payload);

      const response = await request(app.getHttpServer())
        .post('/slack/events')
        .set('x-slack-signature', signature)
        .set('x-slack-request-timestamp', timestamp)
        .send(payload)
        .expect(201);

      expect(response.body).toHaveProperty('ok', true);
    });
  });

  describe('POST /slack/interactive-components', () => {
    it('should handle interactive component with valid signature', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = {
        type: 'block_actions',
        user: {
          id: 'U1234567890',
          name: 'test-user',
        },
        team: {
          id: 'T1234567890',
          domain: 'test-workspace',
        },
        actions: [
          {
            action_id: 'button_1',
            type: 'button',
            value: 'test-value',
          },
        ],
        trigger_id: 'test-trigger-id',
      };

      const payloadString = JSON.stringify(payload);
      const signature = createSlackSignature(timestamp, payloadString);

      const response = await request(app.getHttpServer())
        .post('/slack/interactive-components')
        .set('x-slack-signature', signature)
        .set('x-slack-request-timestamp', timestamp)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({ payload: payloadString })
        .expect(201);

      expect(response.body).toHaveProperty('ok', true);
    });

    it('should reject interactive component with invalid signature', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = {
        type: 'block_actions',
        user: { id: 'U1234567890' },
        team: { id: 'T1234567890' },
        actions: [{ action_id: 'test' }],
      };

      const payloadString = JSON.stringify(payload);

      const response = await request(app.getHttpServer())
        .post('/slack/interactive-components')
        .set('x-slack-signature', 'v0=invalid-signature')
        .set('x-slack-request-timestamp', timestamp)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({ payload: payloadString })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid signature');
    });

    it('should handle missing payload in interactive component', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();

      const response = await request(app.getHttpServer())
        .post('/slack/interactive-components')
        .set('x-slack-signature', 'v0=invalid-signature')
        .set('x-slack-request-timestamp', timestamp)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Missing payload');
    });

    it('should handle malformed JSON in interactive component payload', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const invalidPayload = '{"invalid": json}';
      const signature = createSlackSignature(timestamp, invalidPayload);

      await request(app.getHttpServer())
        .post('/slack/interactive-components')
        .set('x-slack-signature', signature)
        .set('x-slack-request-timestamp', timestamp)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({ payload: invalidPayload })
        .expect(500);
    });

    it('should handle shortcut interactive component', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = {
        type: 'shortcut',
        user: {
          id: 'U1234567890',
          name: 'test-user',
        },
        team: {
          id: 'T1234567890',
          domain: 'test-workspace',
        },
        callback_id: 'standup_shortcut',
        trigger_id: 'test-trigger-id',
      };

      const payloadString = JSON.stringify(payload);
      const signature = createSlackSignature(timestamp, payloadString);

      const response = await request(app.getHttpServer())
        .post('/slack/interactive-components')
        .set('x-slack-signature', signature)
        .set('x-slack-request-timestamp', timestamp)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({ payload: payloadString })
        .expect(201);

      expect(response.body).toHaveProperty('ok', true);
    });
  });

  describe('POST /slack/slash-commands', () => {
    it('should handle slash command with valid signature', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const body = {
        token: 'test-token',
        command: '/standup',
        text: 'help',
        user_id: 'U1234567890',
        user_name: 'test-user',
        team_id: 'T1234567890',
        team_domain: 'test-workspace',
        channel_id: 'C1234567890',
        channel_name: 'general',
        trigger_id: 'test-trigger-id',
        response_url: 'https://hooks.slack.com/commands/test',
      };

      const signature = createSlackSignature(timestamp, body);

      const response = await request(app.getHttpServer())
        .post('/slack/slash-commands')
        .set('x-slack-signature', signature)
        .set('x-slack-request-timestamp', timestamp)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(body)
        .expect(201);

      // Response should be a Slack message format
      expect(response.body).toBeDefined();
      // The exact response structure depends on the implementation
      // It might include text, blocks, or other Slack message properties
    });

    it('should reject slash command with invalid signature', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const body = {
        token: 'test-token',
        command: '/standup',
        text: 'help',
        user_id: 'U1234567890',
        team_id: 'T1234567890',
        channel_id: 'C1234567890',
      };

      const response = await request(app.getHttpServer())
        .post('/slack/slash-commands')
        .set('x-slack-signature', 'v0=invalid-signature')
        .set('x-slack-request-timestamp', timestamp)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(body)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid signature');
    });

    it('should handle slash command without signature headers', async () => {
      const body = {
        token: 'test-token',
        command: '/standup',
        text: 'help',
        user_id: 'U1234567890',
        team_id: 'T1234567890',
        channel_id: 'C1234567890',
      };

      await request(app.getHttpServer())
        .post('/slack/slash-commands')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(body)
        .expect(401);
    });

    it('should handle different slash command parameters', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const body = {
        token: 'test-token',
        command: '/standup',
        text: 'status team-name',
        user_id: 'U1234567890',
        user_name: 'test-user',
        team_id: 'T1234567890',
        team_domain: 'test-workspace',
        channel_id: 'C1234567890',
        channel_name: 'general',
        trigger_id: 'test-trigger-id',
        response_url: 'https://hooks.slack.com/commands/test',
      };

      const signature = createSlackSignature(timestamp, body);

      const response = await request(app.getHttpServer())
        .post('/slack/slash-commands')
        .set('x-slack-signature', signature)
        .set('x-slack-request-timestamp', timestamp)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(body)
        .expect(201);

      expect(response.body).toBeDefined();
    });

    it('should handle empty slash command text', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const body = {
        token: 'test-token',
        command: '/standup',
        text: '',
        user_id: 'U1234567890',
        user_name: 'test-user',
        team_id: 'T1234567890',
        team_domain: 'test-workspace',
        channel_id: 'C1234567890',
        channel_name: 'general',
        trigger_id: 'test-trigger-id',
        response_url: 'https://hooks.slack.com/commands/test',
      };

      const signature = createSlackSignature(timestamp, body);

      const response = await request(app.getHttpServer())
        .post('/slack/slash-commands')
        .set('x-slack-signature', signature)
        .set('x-slack-request-timestamp', timestamp)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(body)
        .expect(201);

      expect(response.body).toBeDefined();
    });
  });

  describe('Webhook Security Tests', () => {
    it('should reject requests with very old timestamps', async () => {
      const oldTimestamp = Math.floor((Date.now() - 10 * 60 * 1000) / 1000).toString(); // 10 minutes ago
      const payload = {
        token: 'test-token',
        type: 'url_verification',
        challenge: 'test-challenge',
      };

      const signature = createSlackSignature(oldTimestamp, payload);

      await request(app.getHttpServer())
        .post('/slack/events')
        .set('x-slack-signature', signature)
        .set('x-slack-request-timestamp', oldTimestamp)
        .send(payload)
        .expect(401);
    });

    it('should reject requests without timestamp header', async () => {
      const payload = {
        token: 'test-token',
        type: 'url_verification',
        challenge: 'test-challenge',
      };

      await request(app.getHttpServer())
        .post('/slack/events')
        .set('x-slack-signature', 'v0=some-signature')
        .send(payload)
        .expect(401);
    });

    it('should handle various signature formats correctly', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = {
        token: 'test-token',
        type: 'url_verification',
        challenge: 'test-challenge',
      };

      // Test with malformed signature
      await request(app.getHttpServer())
        .post('/slack/events')
        .set('x-slack-signature', 'invalid-format')
        .set('x-slack-request-timestamp', timestamp)
        .send(payload)
        .expect(401);

      // Test with empty signature
      await request(app.getHttpServer())
        .post('/slack/events')
        .set('x-slack-signature', '')
        .set('x-slack-request-timestamp', timestamp)
        .send(payload)
        .expect(401);
    });
  });

  describe('Error Handling', () => {
    it('should handle internal errors gracefully in event endpoint', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();

      // Send a malformed payload that might cause processing errors
      const malformedPayload = {
        type: 'event_callback',
        event: null, // This might cause issues in processing
        team_id: 'T1234567890',
      };

      const signature = createSlackSignature(timestamp, malformedPayload);

      const response = await request(app.getHttpServer())
        .post('/slack/events')
        .set('x-slack-signature', signature)
        .set('x-slack-request-timestamp', timestamp)
        .send(malformedPayload)
        .expect(201); // Should still return 201 to avoid Slack retries

      expect(response.body).toHaveProperty('ok', true);
    });

    it('should return error response for slash command processing failures', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();

      // Send a command that might cause processing errors
      const body = {
        token: 'test-token',
        command: '/standup',
        text: 'invalid-command-that-causes-error',
        user_id: 'U1234567890',
        user_name: 'test-user',
        team_id: 'T1234567890',
        team_domain: 'test-workspace',
        channel_id: 'C1234567890',
        channel_name: 'general',
        trigger_id: 'test-trigger-id',
        response_url: 'https://hooks.slack.com/commands/test',
      };

      const signature = createSlackSignature(timestamp, body);

      const response = await request(app.getHttpServer())
        .post('/slack/slash-commands')
        .set('x-slack-signature', signature)
        .set('x-slack-request-timestamp', timestamp)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(body)
        .expect(201);

      // Should return a user-friendly error message
      expect(response.body).toBeDefined();
      expect(typeof response.body).toBe('object');
    });
  });
});
