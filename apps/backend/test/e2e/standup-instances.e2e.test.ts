import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { IntegrationPlatform, TokenStatus, OrgRole } from '@prisma/client';
import { StandupInstanceState } from '@/standups/dto/update-instance-state.dto';

describe('Standup Instances (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  // Test data storage
  const testData = {
    orgId: '',
    adminUserId: '',
    memberUserId: '',
    integrationId: '',
    channelId: '',
    teamId: '',
    configId: '',
    instanceId: '',
    teamMemberId: '',
    adminToken: '',
    memberToken: '',
    testUserIds: [] as string[],
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);
    await app.init();
  });

  beforeEach(async () => {
    // Clean up existing test data
    await cleanupTestData();

    // Generate random test data
    const randomSuffix = Math.random().toString(36).substring(7);

    // Create test organization
    const org = await prisma.organization.create({
      data: {
        name: `Standup Instances E2E Test Org ${randomSuffix}`,
      },
    });
    testData.orgId = org.id;

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        email: `instances-admin-${randomSuffix}@test.com`,
        passwordHash: 'hashed_password',
        name: `Admin User ${randomSuffix}`,
      },
    });
    testData.adminUserId = adminUser.id;

    // Create admin member
    await prisma.orgMember.create({
      data: {
        orgId: org.id,
        userId: adminUser.id,
        role: OrgRole.admin,
        status: 'active',
      },
    });

    // Create member user
    const memberUser = await prisma.user.create({
      data: {
        email: `instances-member-${randomSuffix}@test.com`,
        passwordHash: 'hashed_password',
        name: `Member User ${randomSuffix}`,
      },
    });
    testData.memberUserId = memberUser.id;

    // Create member
    await prisma.orgMember.create({
      data: {
        orgId: org.id,
        userId: memberUser.id,
        role: OrgRole.member,
        status: 'active',
      },
    });

    // Create test Slack integration
    const integration = await prisma.integration.create({
      data: {
        orgId: org.id,
        platform: IntegrationPlatform.slack,
        externalTeamId: 'T1234567890',
        accessToken: 'xoxp-test-user-token',
        botToken: 'xoxb-test-bot-token',
        botUserId: 'B1234567890',
        appId: 'A1234567890',
        tokenStatus: TokenStatus.ok,
        scopes: ['channels:read', 'users:read', 'chat:write'],
        userScopes: ['identity.basic'],
      },
    });
    testData.integrationId = integration.id;

    // Create test channel
    const channel = await prisma.channel.create({
      data: {
        integrationId: integration.id,
        channelId: 'C1234567890',
        name: 'general',
        topic: 'General discussion',
        purpose: 'Company-wide announcements',
        isPrivate: false,
        isArchived: false,
        memberCount: 5,
      },
    });
    testData.channelId = channel.id;

    // Create test team
    const team = await prisma.team.create({
      data: {
        orgId: org.id,
        name: 'Instances Test Team',
        integrationId: integration.id,
        channelId: channel.id,
        slackChannelId: 'C1234567890',
        timezone: 'America/New_York',
        createdByUserId: adminUser.id,
      },
    });
    testData.teamId = team.id;

    // Add team member
    const teamMember = await prisma.teamMember.create({
      data: {
        teamId: team.id,
        platformUserId: 'U1111111111',
        name: 'Test User 1',
        active: true,
        addedByUserId: adminUser.id,
      },
    });
    testData.teamMemberId = teamMember.id;

    // Create standup configuration
    const config = await prisma.standupConfig.create({
      data: {
        teamId: team.id,
        questions: [
          'What did you work on yesterday?',
          'What will you work on today?',
          'Are there any blockers?',
        ],
        weekdays: [1, 2, 3, 4, 5],
        timeLocal: '09:00',
        timezone: 'America/New_York',
        reminderMinutesBefore: 15,
        responseTimeoutHours: 2,
        isActive: true,
        createdByUserId: adminUser.id,
      },
    });
    testData.configId = config.id;

    // Generate JWT tokens for authentication
    testData.adminToken = jwtService.sign({
      sub: adminUser.id,
      email: adminUser.email,
      orgId: org.id,
    });

    testData.memberToken = jwtService.sign({
      sub: memberUser.id,
      email: memberUser.email,
      orgId: org.id,
    });

    // Store user IDs for cleanup
    testData.testUserIds = [adminUser.id, memberUser.id];
  });

  afterEach(async () => {
    await cleanupTestData();
    resetTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
    await app.close();
  });

  async function cleanupTestData() {
    try {
      // Clean up in correct order due to foreign key constraints
      await prisma.answer.deleteMany();
      await prisma.participationSnapshot.deleteMany();
      await prisma.standupInstance.deleteMany();
      await prisma.standupConfigMember.deleteMany();
      await prisma.standupConfig.deleteMany();
      await prisma.teamMember.deleteMany({ where: { team: { orgId: testData.orgId } } });
      await prisma.team.deleteMany({ where: { orgId: testData.orgId } });
      await prisma.channel.deleteMany({ where: { integration: { orgId: testData.orgId } } });
      await prisma.integration.deleteMany({ where: { orgId: testData.orgId } });
      await prisma.orgMember.deleteMany({ where: { orgId: testData.orgId } });
      if (testData.testUserIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: testData.testUserIds } } });
      }
      if (testData.orgId) {
        await prisma.organization.deleteMany({ where: { id: testData.orgId } });
      }
      // Clean up any test organizations by name pattern
      await prisma.organization.deleteMany({
        where: { name: { contains: 'Standup Instances E2E Test' } },
      });
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  }

  function resetTestData() {
    testData.orgId = '';
    testData.adminUserId = '';
    testData.memberUserId = '';
    testData.integrationId = '';
    testData.channelId = '';
    testData.teamId = '';
    testData.configId = '';
    testData.instanceId = '';
    testData.teamMemberId = '';
    testData.adminToken = '';
    testData.memberToken = '';
    testData.testUserIds = [];
  }

  describe('GET /standups/instances', () => {
    beforeEach(async () => {
      // Create test standup instances
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const instance1 = await prisma.standupInstance.create({
        data: {
          teamId: testData.teamId,
          targetDate: today,
          state: StandupInstanceState.COLLECTING,
          configSnapshot: {
            questions: ['Question 1', 'Question 2'],
            responseTimeoutHours: 2,
            reminderMinutesBefore: 15,
            participatingMembers: [
              {
                id: testData.teamMemberId,
                name: 'Test User 1',
                platformUserId: 'U1111111111',
              },
            ],
            timezone: 'America/New_York',
            timeLocal: '09:00',
          },
        },
      });

      await prisma.standupInstance.create({
        data: {
          teamId: testData.teamId,
          targetDate: yesterday,
          state: StandupInstanceState.POSTED,
          configSnapshot: {
            questions: ['Question 1', 'Question 2'],
            responseTimeoutHours: 2,
            reminderMinutesBefore: 15,
            participatingMembers: [
              {
                id: testData.teamMemberId,
                name: 'Test User 1',
                platformUserId: 'U1111111111',
              },
            ],
            timezone: 'America/New_York',
            timeLocal: '09:00',
          },
        },
      });

      testData.instanceId = instance1.id;
    });

    it('should list active standup instances for authorized user', async () => {
      const response = await request(app.getHttpServer())
        .get('/standups/instances')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      const instance = response.body[0];
      expect(instance).toHaveProperty('id');
      expect(instance).toHaveProperty('teamId', testData.teamId);
      expect(instance).toHaveProperty('targetDate');
      expect(instance).toHaveProperty('state');
      expect(instance).toHaveProperty('configSnapshot');
    });

    it('should filter instances by teamId', async () => {
      const response = await request(app.getHttpServer())
        .get('/standups/instances')
        .query({ teamId: testData.teamId })
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((instance: { teamId: string }) => {
        expect(instance.teamId).toBe(testData.teamId);
      });
    });

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/standups/instances')
        .query({ limit: 1, offset: 0 })
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(1);
    });

    it('should allow members to view instances', async () => {
      const response = await request(app.getHttpServer())
        .get('/standups/instances')
        .set('Authorization', `Bearer ${testData.memberToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer()).get('/standups/instances').expect(401);
    });
  });

  describe('GET /standups/instances/:id', () => {
    beforeEach(async () => {
      const instance = await prisma.standupInstance.create({
        data: {
          teamId: testData.teamId,
          targetDate: new Date(),
          state: StandupInstanceState.COLLECTING,
          configSnapshot: {
            questions: ['What did you work on?', 'What will you work on?'],
            responseTimeoutHours: 2,
            reminderMinutesBefore: 15,
            participatingMembers: [
              {
                id: testData.teamMemberId,
                name: 'Test User 1',
                platformUserId: 'U1111111111',
              },
            ],
            timezone: 'America/New_York',
            timeLocal: '09:00',
          },
        },
      });
      testData.instanceId = instance.id;

      // Add some answers
      await prisma.answer.createMany({
        data: [
          {
            standupInstanceId: instance.id,
            teamMemberId: testData.teamMemberId,
            questionIndex: 0,
            text: 'Worked on feature X',
            submittedAt: new Date(),
          },
          {
            standupInstanceId: instance.id,
            teamMemberId: testData.teamMemberId,
            questionIndex: 1,
            text: 'Will work on feature Y',
            submittedAt: new Date(),
          },
        ],
      });
    });

    it('should get instance details with answers for authorized user', async () => {
      const response = await request(app.getHttpServer())
        .get(`/standups/instances/${testData.instanceId}`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', testData.instanceId);
      expect(response.body).toHaveProperty('teamId', testData.teamId);
      expect(response.body).toHaveProperty('targetDate');
      expect(response.body).toHaveProperty('state', StandupInstanceState.COLLECTING);
      expect(response.body).toHaveProperty('configSnapshot');
      expect(response.body).toHaveProperty('answers');
      expect(Array.isArray(response.body.answers)).toBe(true);
      expect(response.body.answers.length).toBe(2);
    });

    it('should return 404 for non-existent instance', async () => {
      await request(app.getHttpServer())
        .get('/standups/instances/non-existent-id')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get(`/standups/instances/${testData.instanceId}`)
        .expect(401);
    });
  });

  describe('PUT /standups/instances/:id/state', () => {
    beforeEach(async () => {
      const instance = await prisma.standupInstance.create({
        data: {
          teamId: testData.teamId,
          targetDate: new Date(),
          state: StandupInstanceState.PENDING,
          configSnapshot: {
            questions: ['Question 1'],
            responseTimeoutHours: 2,
            reminderMinutesBefore: 15,
            participatingMembers: [],
            timezone: 'America/New_York',
            timeLocal: '09:00',
          },
        },
      });
      testData.instanceId = instance.id;
    });

    it('should update instance state successfully (admin)', async () => {
      const updateStateDto = {
        state: StandupInstanceState.COLLECTING,
      };

      const response = await request(app.getHttpServer())
        .put(`/standups/instances/${testData.instanceId}/state`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(updateStateDto)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);

      // Verify state was updated in database
      const updatedInstance = await prisma.standupInstance.findUnique({
        where: { id: testData.instanceId },
      });

      expect(updatedInstance!.state).toBe(StandupInstanceState.COLLECTING);
    });

    it('should not allow members to update instance state', async () => {
      const updateStateDto = {
        state: StandupInstanceState.COLLECTING,
      };

      await request(app.getHttpServer())
        .put(`/standups/instances/${testData.instanceId}/state`)
        .set('Authorization', `Bearer ${testData.memberToken}`)
        .send(updateStateDto)
        .expect(403);
    });

    it('should return 404 for non-existent instance', async () => {
      const updateStateDto = {
        state: StandupInstanceState.COLLECTING,
      };

      await request(app.getHttpServer())
        .put('/standups/instances/non-existent-id/state')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(updateStateDto)
        .expect(404);
    });

    it('should validate state values', async () => {
      const invalidStateDto = {
        state: 'INVALID_STATE',
      };

      await request(app.getHttpServer())
        .put(`/standups/instances/${testData.instanceId}/state`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(invalidStateDto)
        .expect(400);
    });

    it('should require authentication', async () => {
      const updateStateDto = {
        state: StandupInstanceState.COLLECTING,
      };

      await request(app.getHttpServer())
        .put(`/standups/instances/${testData.instanceId}/state`)
        .send(updateStateDto)
        .expect(401);
    });
  });

  describe('POST /standups/instances/:id/answers', () => {
    beforeEach(async () => {
      const instance = await prisma.standupInstance.create({
        data: {
          teamId: testData.teamId,
          targetDate: new Date(),
          state: StandupInstanceState.COLLECTING,
          configSnapshot: {
            questions: [
              'What did you work on yesterday?',
              'What will you work on today?',
              'Are there any blockers?',
            ],
            responseTimeoutHours: 2,
            reminderMinutesBefore: 15,
            participatingMembers: [
              {
                id: testData.teamMemberId,
                name: 'Test User 1',
                platformUserId: 'U1111111111',
              },
            ],
            timezone: 'America/New_York',
            timeLocal: '09:00',
          },
        },
      });
      testData.instanceId = instance.id;
    });

    it('should submit answers successfully for authorized user', async () => {
      const submitAnswersDto = {
        standupInstanceId: testData.instanceId,
        answers: [
          {
            questionIndex: 0,
            text: 'Worked on feature implementation',
          },
          {
            questionIndex: 1,
            text: 'Will work on testing',
          },
          {
            questionIndex: 2,
            text: 'No blockers',
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post(`/standups/instances/${testData.instanceId}/answers`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(submitAnswersDto)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('answersSubmitted', 3);

      // Verify answers were created in database
      const answers = await prisma.answer.findMany({
        where: {
          standupInstanceId: testData.instanceId,
          teamMemberId: testData.teamMemberId, // Use the correct team member ID
        },
        orderBy: { questionIndex: 'asc' },
      });

      expect(answers).toHaveLength(3);
      expect(answers[0].text).toBe('Worked on feature implementation');
      expect(answers[1].text).toBe('Will work on testing');
      expect(answers[2].text).toBe('No blockers');
    });

    it('should validate instance ID mismatch', async () => {
      const submitAnswersDto = {
        standupInstanceId: 'different-instance-id',
        answers: [
          {
            questionIndex: 0,
            text: 'Test answer',
          },
        ],
      };

      await request(app.getHttpServer())
        .post(`/standups/instances/${testData.instanceId}/answers`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(submitAnswersDto)
        .expect(400);
    });

    it('should return 404 for non-existent instance', async () => {
      const submitAnswersDto = {
        answers: [
          {
            questionIndex: 0,
            text: 'Test answer',
          },
        ],
      };

      await request(app.getHttpServer())
        .post('/standups/instances/non-existent-id/answers')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(submitAnswersDto)
        .expect(404);
    });

    it('should validate answer data', async () => {
      const invalidAnswersDto = {
        answers: [
          {
            questionIndex: -1, // Invalid index
            text: '', // Empty text
          },
        ],
      };

      await request(app.getHttpServer())
        .post(`/standups/instances/${testData.instanceId}/answers`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(invalidAnswersDto)
        .expect(400);
    });

    it('should require authentication', async () => {
      const submitAnswersDto = {
        answers: [
          {
            questionIndex: 0,
            text: 'Test answer',
          },
        ],
      };

      await request(app.getHttpServer())
        .post(`/standups/instances/${testData.instanceId}/answers`)
        .send(submitAnswersDto)
        .expect(401);
    });
  });

  describe('GET /standups/instances/:id/status', () => {
    beforeEach(async () => {
      const instance = await prisma.standupInstance.create({
        data: {
          teamId: testData.teamId,
          targetDate: new Date(),
          state: StandupInstanceState.COLLECTING,
          configSnapshot: {
            questions: ['Question 1', 'Question 2'],
            responseTimeoutHours: 2,
            reminderMinutesBefore: 15,
            participatingMembers: [
              {
                id: testData.teamMemberId,
                name: 'Test User 1',
                platformUserId: 'U1111111111',
              },
            ],
            timezone: 'America/New_York',
            timeLocal: '09:00',
          },
        },
      });
      testData.instanceId = instance.id;

      // Add some answers for status calculation
      await prisma.answer.create({
        data: {
          standupInstanceId: instance.id,
          teamMemberId: testData.teamMemberId,
          questionIndex: 0,
          text: 'Test answer',
          submittedAt: new Date(),
        },
      });
    });

    it('should get participation status for authorized user', async () => {
      const response = await request(app.getHttpServer())
        .get(`/standups/instances/${testData.instanceId}/status`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalMembers');
      expect(response.body).toHaveProperty('respondedMembers');
      expect(response.body).toHaveProperty('responseRate');
      expect(response.body).toHaveProperty('completionRate');
      expect(typeof response.body.totalMembers).toBe('number');
      expect(typeof response.body.respondedMembers).toBe('number');
      expect(typeof response.body.responseRate).toBe('number');
      expect(typeof response.body.completionRate).toBe('number');
    });

    it('should return 404 for non-existent instance', async () => {
      await request(app.getHttpServer())
        .get('/standups/instances/non-existent-id/status')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get(`/standups/instances/${testData.instanceId}/status`)
        .expect(401);
    });
  });

  describe('GET /standups/instances/:id/participating-members', () => {
    beforeEach(async () => {
      const instance = await prisma.standupInstance.create({
        data: {
          teamId: testData.teamId,
          targetDate: new Date(),
          state: StandupInstanceState.COLLECTING,
          configSnapshot: {
            questions: ['Question 1'],
            responseTimeoutHours: 2,
            reminderMinutesBefore: 15,
            participatingMembers: [
              {
                id: testData.teamMemberId,
                name: 'Test User 1',
                platformUserId: 'U1111111111',
              },
            ],
            timezone: 'America/New_York',
            timeLocal: '09:00',
          },
        },
      });
      testData.instanceId = instance.id;
    });

    it('should get participating members for authorized user', async () => {
      const response = await request(app.getHttpServer())
        .get(`/standups/instances/${testData.instanceId}/participating-members`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('name', 'Test User 1');
      expect(response.body[0]).toHaveProperty('platformUserId', 'U1111111111');
    });

    it('should return 404 for non-existent instance', async () => {
      await request(app.getHttpServer())
        .get('/standups/instances/non-existent-id/participating-members')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get(`/standups/instances/${testData.instanceId}/participating-members`)
        .expect(401);
    });
  });

  describe('GET /standups/instances/:id/completion-check', () => {
    beforeEach(async () => {
      const instance = await prisma.standupInstance.create({
        data: {
          teamId: testData.teamId,
          targetDate: new Date(),
          state: StandupInstanceState.COLLECTING,
          configSnapshot: {
            questions: ['Question 1', 'Question 2'],
            responseTimeoutHours: 2,
            reminderMinutesBefore: 15,
            participatingMembers: [
              {
                id: testData.teamMemberId,
                name: 'Test User 1',
                platformUserId: 'U1111111111',
              },
            ],
            timezone: 'America/New_York',
            timeLocal: '09:00',
          },
        },
      });
      testData.instanceId = instance.id;
    });

    it('should check completion status for authorized user', async () => {
      const response = await request(app.getHttpServer())
        .get(`/standups/instances/${testData.instanceId}/completion-check`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('isComplete');
      expect(response.body).toHaveProperty('responseRate');
      expect(typeof response.body.isComplete).toBe('boolean');
      expect(typeof response.body.responseRate).toBe('number');
    });

    it('should return 404 for non-existent instance', async () => {
      await request(app.getHttpServer())
        .get('/standups/instances/non-existent-id/completion-check')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get(`/standups/instances/${testData.instanceId}/completion-check`)
        .expect(401);
    });
  });

  describe('POST /standups/instances/create-for-date', () => {
    it('should create instances for date successfully (admin)', async () => {
      const createForDateDto = {
        targetDate: new Date().toISOString().split('T')[0],
      };

      const response = await request(app.getHttpServer())
        .post('/standups/instances/create-for-date')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(createForDateDto)
        .expect(201);

      expect(response.body).toHaveProperty('created');
      expect(response.body).toHaveProperty('skipped');
      expect(Array.isArray(response.body.created)).toBe(true);
      expect(Array.isArray(response.body.skipped)).toBe(true);
    });

    it('should not allow members to create instances for date', async () => {
      const createForDateDto = {
        targetDate: new Date().toISOString().split('T')[0],
      };

      await request(app.getHttpServer())
        .post('/standups/instances/create-for-date')
        .set('Authorization', `Bearer ${testData.memberToken}`)
        .send(createForDateDto)
        .expect(403);
    });

    it('should validate date format', async () => {
      const invalidDateDto = {
        targetDate: 'invalid-date-format',
      };

      await request(app.getHttpServer())
        .post('/standups/instances/create-for-date')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(invalidDateDto)
        .expect(400);
    });

    it('should require authentication', async () => {
      const createForDateDto = {
        targetDate: new Date().toISOString().split('T')[0],
      };

      await request(app.getHttpServer())
        .post('/standups/instances/create-for-date')
        .send(createForDateDto)
        .expect(401);
    });
  });

  describe('GET /standups/instances/team/:teamId/next-standup', () => {
    it('should get next standup date for team', async () => {
      const response = await request(app.getHttpServer())
        .get(`/standups/instances/team/${testData.teamId}/next-standup`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('nextStandupDate');
      // nextStandupDate can be null or a date string
      if (response.body.nextStandupDate) {
        expect(typeof response.body.nextStandupDate).toBe('string');
      }
    });

    it('should return 404 for non-existent team', async () => {
      await request(app.getHttpServer())
        .get('/standups/instances/team/non-existent-team-id/next-standup')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get(`/standups/instances/team/${testData.teamId}/next-standup`)
        .expect(401);
    });
  });

  describe('GET /standups/instances/team/:teamId/should-create-today', () => {
    it('should check if team should have standup today', async () => {
      const response = await request(app.getHttpServer())
        .get(`/standups/instances/team/${testData.teamId}/should-create-today`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('shouldCreate');
      expect(response.body).toHaveProperty('date');
      expect(typeof response.body.shouldCreate).toBe('boolean');
      expect(typeof response.body.date).toBe('string');
    });

    it('should support custom date parameter', async () => {
      const testDate = '2024-01-15';
      const response = await request(app.getHttpServer())
        .get(`/standups/instances/team/${testData.teamId}/should-create-today`)
        .query({ date: testDate })
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('date', testDate);
    });

    it('should validate date format', async () => {
      await request(app.getHttpServer())
        .get(`/standups/instances/team/${testData.teamId}/should-create-today`)
        .query({ date: 'invalid-date' })
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get(`/standups/instances/team/${testData.teamId}/should-create-today`)
        .expect(401);
    });
  });

  describe('Cross-organization Security', () => {
    let otherOrgId: string;
    let otherInstanceId: string;

    beforeEach(async () => {
      // Create another organization with team, config, and instance
      const otherOrg = await prisma.organization.create({
        data: {
          name: 'Other Instances Organization',
        },
      });
      otherOrgId = otherOrg.id;

      const otherAdmin = await prisma.user.create({
        data: {
          email: 'other-instances-admin@test.com',
          passwordHash: 'hashed_password',
          name: 'Other Instances Admin',
        },
      });

      await prisma.orgMember.create({
        data: {
          orgId: otherOrg.id,
          userId: otherAdmin.id,
          role: OrgRole.admin,
          status: 'active',
        },
      });

      const otherIntegration = await prisma.integration.create({
        data: {
          orgId: otherOrg.id,
          platform: IntegrationPlatform.slack,
          externalTeamId: 'T_OTHER_INSTANCES',
          accessToken: 'other-token',
          botToken: 'other-bot-token',
          botUserId: 'B_OTHER',
          appId: 'A_OTHER',
          tokenStatus: TokenStatus.ok,
          scopes: [],
          userScopes: [],
        },
      });

      const otherChannel = await prisma.channel.create({
        data: {
          integrationId: otherIntegration.id,
          channelId: 'C_OTHER_INSTANCES',
          name: 'other-instances-channel',
        },
      });

      const otherTeam = await prisma.team.create({
        data: {
          orgId: otherOrg.id,
          name: 'Other Instances Team',
          integrationId: otherIntegration.id,
          channelId: otherChannel.id,
          slackChannelId: 'C_OTHER_INSTANCES',
          timezone: 'America/New_York',
          createdByUserId: otherAdmin.id,
        },
      });

      await prisma.standupConfig.create({
        data: {
          teamId: otherTeam.id,
          questions: ['Other question'],
          weekdays: [1, 2, 3, 4, 5],
          timeLocal: '09:00',
          timezone: 'America/New_York',
          reminderMinutesBefore: 15,
          responseTimeoutHours: 2,
          isActive: true,
          createdByUserId: otherAdmin.id,
        },
      });

      const otherInstance = await prisma.standupInstance.create({
        data: {
          teamId: otherTeam.id,
          targetDate: new Date(),
          state: StandupInstanceState.COLLECTING,
          configSnapshot: {
            questions: ['Other question'],
            responseTimeoutHours: 2,
            reminderMinutesBefore: 15,
            participatingMembers: [],
            timezone: 'America/New_York',
            timeLocal: '09:00',
          },
        },
      });
      otherInstanceId = otherInstance.id;
    });

    afterEach(async () => {
      await prisma.standupInstance.deleteMany({ where: { team: { orgId: otherOrgId } } });
      await prisma.standupConfig.deleteMany({ where: { team: { orgId: otherOrgId } } });
      await prisma.team.deleteMany({ where: { orgId: otherOrgId } });
      await prisma.channel.deleteMany({ where: { integration: { orgId: testData.orgId } } });
      await prisma.integration.deleteMany({ where: { orgId: otherOrgId } });
      await prisma.orgMember.deleteMany({ where: { orgId: otherOrgId } });
      await prisma.user.deleteMany({ where: { email: 'other-instances-admin@test.com' } });
      await prisma.organization.deleteMany({ where: { id: otherOrgId } });
    });

    it('should not allow access to instances from different organization', async () => {
      // Try to access other org's instance
      await request(app.getHttpServer())
        .get(`/standups/instances/${otherInstanceId}`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(404);

      // Try to update other org's instance state
      await request(app.getHttpServer())
        .put(`/standups/instances/${otherInstanceId}/state`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send({ state: StandupInstanceState.POSTED })
        .expect(404);

      // Try to submit answers to other org's instance
      await request(app.getHttpServer())
        .post(`/standups/instances/${otherInstanceId}/answers`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send({
          answers: [{ questionIndex: 0, text: 'Hacked answer' }],
        })
        .expect(404);
    });
  });
});
