import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { IntegrationPlatform, TokenStatus, OrgRole } from '@prisma/client';

describe('Standup Configuration (e2e)', () => {
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
    adminToken: '',
    memberToken: '',
    testUserIds: [] as string[],
    teamMemberIds: [] as string[],
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
        name: `Standup Config E2E Test Org ${randomSuffix}`,
      },
    });
    testData.orgId = org.id;

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        email: `standup-admin-${randomSuffix}@test.com`,
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
        email: `standup-member-${randomSuffix}@test.com`,
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
        name: 'Standup Test Team',
        integrationId: integration.id,
        channelId: channel.id,
        slackChannelId: 'C1234567890',
        timezone: 'America/New_York',
        createdByUserId: adminUser.id,
      },
    });
    testData.teamId = team.id;

    // Add team members
    const teamMember1 = await prisma.teamMember.create({
      data: {
        teamId: team.id,
        platformUserId: 'U1111111111',
        name: 'Test User 1',
        active: true,
        addedByUserId: adminUser.id,
      },
    });

    const teamMember2 = await prisma.teamMember.create({
      data: {
        teamId: team.id,
        platformUserId: 'U2222222222',
        name: 'Test User 2',
        active: true,
        addedByUserId: adminUser.id,
      },
    });

    testData.teamMemberIds = [teamMember1.id, teamMember2.id];

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
      // Only clean up if we have test data to clean up
      if (!testData.orgId) {
        return;
      }

      // Clean up in correct order due to foreign key constraints
      // Only delete data belonging to our test org
      if (testData.configId) {
        await prisma.standupConfigMember.deleteMany({
          where: { standupConfigId: testData.configId },
        });
        await prisma.standupConfig.deleteMany({ where: { id: testData.configId } });
      }
      await prisma.standupConfig.deleteMany({ where: { team: { orgId: testData.orgId } } });
      await prisma.standupConfigMember.deleteMany({
        where: { standupConfig: { team: { orgId: testData.orgId } } },
      });
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
      // Clean up any test organizations by name pattern (as backup)
      await prisma.organization.deleteMany({
        where: { name: { contains: 'Standup Config E2E Test' } },
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
    testData.adminToken = '';
    testData.memberToken = '';
    testData.testUserIds = [];
  }

  describe('POST /standups/config', () => {
    it('should create standup configuration successfully (admin)', async () => {
      const createConfigDto = {
        teamId: testData.teamId,
        name: 'Test Standup Config',
        questions: [
          'What did you work on yesterday?',
          'What will you work on today?',
          'Are there any blockers?',
        ],
        weekdays: [1, 2, 3, 4, 5], // Monday to Friday
        timeLocal: '09:00',
        timezone: 'America/New_York',
        reminderMinutesBefore: 15,
        responseTimeoutHours: 2,
        isActive: true,
      };

      const response = await request(app.getHttpServer())
        .post('/standups/config')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(createConfigDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('teamId', testData.teamId);
      expect(response.body).toHaveProperty('questions');
      expect(response.body.questions).toHaveLength(3);
      expect(response.body).toHaveProperty('weekdays', [1, 2, 3, 4, 5]);
      expect(response.body).toHaveProperty('timeLocal', '09:00');
      expect(response.body).toHaveProperty('isActive', true);

      testData.configId = response.body.id;

      // Verify config was created in database
      const config = await prisma.standupConfig.findUnique({
        where: { id: response.body.id },
      });

      expect(config).toBeDefined();
      expect(config!.teamId).toBe(testData.teamId);
      expect(config!.questions).toEqual(createConfigDto.questions);
      expect(config!.weekdays).toEqual(createConfigDto.weekdays);
      expect(config!.createdByUserId).toBe(testData.adminUserId);
    });

    it('should not allow members to create standup configurations', async () => {
      const createConfigDto = {
        teamId: testData.teamId,
        name: 'Test Standup Config',
        questions: ['What did you work on?'],
        weekdays: [1, 2, 3, 4, 5],
        timeLocal: '09:00',
        timezone: 'America/New_York',
        reminderMinutesBefore: 15,
        responseTimeoutHours: 2,
        isActive: true,
      };

      await request(app.getHttpServer())
        .post('/standups/config')
        .set('Authorization', `Bearer ${testData.memberToken}`)
        .send(createConfigDto)
        .expect(403);
    });

    it('should require authentication', async () => {
      const createConfigDto = {
        teamId: testData.teamId,
        name: 'Test Standup Config',
        questions: ['What did you work on?'],
        weekdays: [1, 2, 3, 4, 5],
        timeLocal: '09:00',
        timezone: 'America/New_York',
        reminderMinutesBefore: 15,
        responseTimeoutHours: 2,
        isActive: true,
      };

      await request(app.getHttpServer()).post('/standups/config').send(createConfigDto).expect(401);
    });

    it('should validate required fields', async () => {
      const invalidData = {
        // Missing required fields
        teamId: testData.teamId,
        questions: [], // Empty questions
        weekdays: [8], // Invalid weekday
        timeLocal: '25:00', // Invalid time
      };

      await request(app.getHttpServer())
        .post('/standups/config')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(invalidData)
        .expect(400);
    });

    it('should reject configuration for non-existent team', async () => {
      const createConfigDto = {
        teamId: 'non-existent-team-id',
        questions: ['What did you work on?'],
        weekdays: [1, 2, 3, 4, 5],
        timeLocal: '09:00',
        timezone: 'America/New_York',
        reminderMinutesBefore: 15,
        responseTimeoutHours: 2,
        isActive: true,
      };

      await request(app.getHttpServer())
        .post('/standups/config')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(createConfigDto)
        .expect(404);
    });

    it('should reject duplicate configuration for same team', async () => {
      const createConfigDto = {
        teamId: testData.teamId,
        name: 'Test Standup Config',
        questions: ['What did you work on?'],
        weekdays: [1, 2, 3, 4, 5],
        timeLocal: '09:00',
        timezone: 'America/New_York',
        reminderMinutesBefore: 15,
        responseTimeoutHours: 2,
        isActive: true,
      };

      // Create first config
      await request(app.getHttpServer())
        .post('/standups/config')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(createConfigDto)
        .expect(201);

      // Try to create second config for same team
      await request(app.getHttpServer())
        .post('/standups/config')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(createConfigDto)
        .expect(409);
    });

    it('should validate weekdays are in range 1-7', async () => {
      const createConfigDto = {
        teamId: testData.teamId,
        questions: ['What did you work on?'],
        weekdays: [0, 8, 9], // Invalid weekdays
        timeLocal: '09:00',
        timezone: 'America/New_York',
        reminderMinutesBefore: 15,
        responseTimeoutHours: 2,
        isActive: true,
      };

      await request(app.getHttpServer())
        .post('/standups/config')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(createConfigDto)
        .expect(400);
    });

    it('should validate time format', async () => {
      const createConfigDto = {
        teamId: testData.teamId,
        questions: ['What did you work on?'],
        weekdays: [1, 2, 3, 4, 5],
        timeLocal: '25:99', // Invalid time format
        timezone: 'America/New_York',
        reminderMinutesBefore: 15,
        responseTimeoutHours: 2,
        isActive: true,
      };

      await request(app.getHttpServer())
        .post('/standups/config')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(createConfigDto)
        .expect(400);
    });
  });

  describe('GET /standups/config/:teamId', () => {
    beforeEach(async () => {
      // Create test standup configuration
      const config = await prisma.standupConfig.create({
        data: {
          teamId: testData.teamId,
          name: 'Test Daily Standup',
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
          createdByUserId: testData.adminUserId,
        },
      });
      testData.configId = config.id;
    });

    it('should get standup configuration for authorized user', async () => {
      const response = await request(app.getHttpServer())
        .get(`/standups/config/${testData.teamId}`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', testData.configId);
      expect(response.body).toHaveProperty('teamId', testData.teamId);
      expect(response.body).toHaveProperty('questions');
      expect(response.body.questions).toHaveLength(3);
      expect(response.body).toHaveProperty('weekdays', [1, 2, 3, 4, 5]);
      expect(response.body).toHaveProperty('timeLocal', '09:00');
      expect(response.body).toHaveProperty('timezone', 'America/New_York');
      expect(response.body).toHaveProperty('isActive', true);
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');
    });

    it('should allow members to view standup configuration', async () => {
      const response = await request(app.getHttpServer())
        .get(`/standups/config/${testData.teamId}`)
        .set('Authorization', `Bearer ${testData.memberToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', testData.configId);
    });

    it('should return 404 for non-existent team', async () => {
      await request(app.getHttpServer())
        .get('/standups/config/non-existent-team-id')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(404);
    });

    it('should return 404 when no configuration exists for team', async () => {
      // Create another team without configuration
      const anotherTeam = await prisma.team.create({
        data: {
          orgId: testData.orgId,
          name: 'Another Team',
          integrationId: testData.integrationId,
          channelId: testData.channelId,
          slackChannelId: 'C9999999999',
          timezone: 'America/New_York',
          createdByUserId: testData.adminUserId,
        },
      });

      await request(app.getHttpServer())
        .get(`/standups/config/${anotherTeam.id}`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer()).get(`/standups/config/${testData.teamId}`).expect(401);
    });
  });

  describe('PUT /standups/config/:id', () => {
    beforeEach(async () => {
      const config = await prisma.standupConfig.create({
        data: {
          teamId: testData.teamId,
          name: 'Original Standup Config',
          questions: ['Original question'],
          weekdays: [1, 2, 3],
          timeLocal: '09:00',
          timezone: 'America/New_York',
          reminderMinutesBefore: 15,
          responseTimeoutHours: 2,
          isActive: true,
          createdByUserId: testData.adminUserId,
        },
      });
      testData.configId = config.id;
    });

    it('should update standup configuration successfully (admin)', async () => {
      const updateData = {
        questions: [
          'What did you accomplish yesterday?',
          'What are your goals for today?',
          'Any impediments?',
        ],
        weekdays: [1, 2, 3, 4, 5],
        timeLocal: '10:00',
        timezone: 'America/Los_Angeles',
        reminderMinutesBefore: 30,
        responseTimeoutHours: 4,
        isActive: false,
      };

      const response = await request(app.getHttpServer())
        .put(`/standups/config/${testData.configId}`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);

      // Verify update in database
      const updatedConfig = await prisma.standupConfig.findUnique({
        where: { id: testData.configId },
      });

      expect(updatedConfig!.questions).toEqual(updateData.questions);
      expect(updatedConfig!.weekdays).toEqual(updateData.weekdays);
      expect(updatedConfig!.timeLocal).toBe('10:00');
      expect(updatedConfig!.timezone).toBe('America/Los_Angeles');
      expect(updatedConfig!.reminderMinutesBefore).toBe(30);
      expect(updatedConfig!.responseTimeoutHours).toBe(4);
      expect(updatedConfig!.isActive).toBe(false);
    });

    it('should not allow members to update standup configurations', async () => {
      const updateData = {
        questions: ['Updated question'],
      };

      await request(app.getHttpServer())
        .put(`/standups/config/${testData.configId}`)
        .set('Authorization', `Bearer ${testData.memberToken}`)
        .send(updateData)
        .expect(403);
    });

    it('should return 404 for non-existent configuration', async () => {
      const updateData = {
        questions: ['Updated question'],
      };

      await request(app.getHttpServer())
        .put('/standups/config/non-existent-id')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(updateData)
        .expect(404);
    });

    it('should validate update data', async () => {
      const invalidData = {
        questions: [], // Empty questions
        weekdays: [0, 8], // Invalid weekdays
        timeLocal: '25:99', // Invalid time
      };

      await request(app.getHttpServer())
        .put(`/standups/config/${testData.configId}`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(invalidData)
        .expect(400);
    });

    it('should allow partial updates', async () => {
      const partialUpdate = {
        timeLocal: '11:30',
      };

      const response = await request(app.getHttpServer())
        .put(`/standups/config/${testData.configId}`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(partialUpdate)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);

      // Verify only specified field was updated
      const updatedConfig = await prisma.standupConfig.findUnique({
        where: { id: testData.configId },
      });

      expect(updatedConfig!.timeLocal).toBe('11:30');
      expect(updatedConfig!.questions).toEqual(['Original question']); // Unchanged
    });
  });

  describe('DELETE /standups/config/:id', () => {
    beforeEach(async () => {
      const config = await prisma.standupConfig.create({
        data: {
          teamId: testData.teamId,
          name: 'Config to Delete',
          questions: ['Question to delete'],
          weekdays: [1, 2, 3, 4, 5],
          timeLocal: '09:00',
          timezone: 'America/New_York',
          reminderMinutesBefore: 15,
          responseTimeoutHours: 2,
          isActive: true,
          createdByUserId: testData.adminUserId,
        },
      });
      testData.configId = config.id;

      // Add some config members for cascade delete test
      await prisma.standupConfigMember.createMany({
        data: [
          {
            standupConfigId: config.id,
            teamMemberId: testData.teamMemberIds[0],
            include: true,
            role: 'member',
          },
          {
            standupConfigId: config.id,
            teamMemberId: testData.teamMemberIds[1],
            include: true,
            role: 'member',
          },
        ],
      });
    });

    it('should delete standup configuration successfully (admin)', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/standups/config/${testData.configId}`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);

      // Verify configuration was deleted
      const deletedConfig = await prisma.standupConfig.findUnique({
        where: { id: testData.configId },
      });
      expect(deletedConfig).toBeNull();

      // Verify cascade delete of config members
      const configMembers = await prisma.standupConfigMember.findMany({
        where: { standupConfigId: testData.configId },
      });
      expect(configMembers).toHaveLength(0);
    });

    it('should not allow members to delete standup configurations', async () => {
      await request(app.getHttpServer())
        .delete(`/standups/config/${testData.configId}`)
        .set('Authorization', `Bearer ${testData.memberToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent configuration', async () => {
      await request(app.getHttpServer())
        .delete('/standups/config/non-existent-id')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .delete(`/standups/config/${testData.configId}`)
        .expect(401);
    });
  });

  describe('POST /standups/config/:id/members/bulk', () => {
    let teamMember1Id: string;
    let teamMember2Id: string;

    beforeEach(async () => {
      const config = await prisma.standupConfig.create({
        data: {
          teamId: testData.teamId,
          name: 'Bulk Test Standup',
          questions: ['Bulk test question'],
          weekdays: [1, 2, 3, 4, 5],
          timeLocal: '09:00',
          timezone: 'America/New_York',
          reminderMinutesBefore: 15,
          responseTimeoutHours: 2,
          isActive: true,
          createdByUserId: testData.adminUserId,
        },
      });
      testData.configId = config.id;

      // Get team member IDs
      const teamMembers = await prisma.teamMember.findMany({
        where: { teamId: testData.teamId },
        orderBy: { id: 'asc' },
      });
      teamMember1Id = teamMembers[0].id;
      teamMember2Id = teamMembers[1].id;
    });

    it('should bulk update member participation successfully (admin)', async () => {
      const bulkUpdateDto = {
        members: [
          {
            teamMemberId: teamMember1Id,
            include: true,
            role: 'lead' as const,
          },
          {
            teamMemberId: teamMember2Id,
            include: false,
            role: 'member' as const,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post(`/standups/config/${testData.configId}/members/bulk`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(bulkUpdateDto)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('updated', 2);

      // Verify updates in database
      const configMembers = await prisma.standupConfigMember.findMany({
        where: { standupConfigId: testData.configId },
        orderBy: { teamMemberId: 'asc' },
      });

      expect(configMembers).toHaveLength(2);
      expect(configMembers[0].include).toBe(true);
      expect(configMembers[0].role).toBe('lead');
      expect(configMembers[1].include).toBe(false);
      expect(configMembers[1].role).toBe('member');
    });

    it('should not allow members to bulk update participation', async () => {
      const bulkUpdateDto = {
        members: [
          {
            teamMemberId: teamMember1Id,
            include: true,
            role: 'member' as const,
          },
        ],
      };

      await request(app.getHttpServer())
        .post(`/standups/config/${testData.configId}/members/bulk`)
        .set('Authorization', `Bearer ${testData.memberToken}`)
        .send(bulkUpdateDto)
        .expect(403);
    });

    it('should return 404 for non-existent configuration', async () => {
      const bulkUpdateDto = {
        members: [
          {
            teamMemberId: teamMember1Id,
            include: true,
            role: 'member' as const,
          },
        ],
      };

      await request(app.getHttpServer())
        .post('/standups/config/non-existent-id/members/bulk')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(bulkUpdateDto)
        .expect(404);
    });

    it('should validate member updates data', async () => {
      const invalidData = {
        members: [
          {
            teamMemberId: 'invalid-member-id',
            include: 'not-boolean', // Invalid type
            role: 'invalid-role', // Invalid role
          },
        ],
      };

      await request(app.getHttpServer())
        .post(`/standups/config/${testData.configId}/members/bulk`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(invalidData)
        .expect(400);
    });

    it('should handle empty member updates array', async () => {
      const emptyUpdate = {
        members: [],
      };

      const response = await request(app.getHttpServer())
        .post(`/standups/config/${testData.configId}/members/bulk`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(emptyUpdate)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('updated', 0);
    });
  });

  describe('Cross-organization Security', () => {
    let otherOrgId: string;
    let otherConfigId: string;

    beforeEach(async () => {
      // Create another organization
      const otherOrg = await prisma.organization.create({
        data: {
          name: 'Other Standup Organization',
        },
      });
      otherOrgId = otherOrg.id;

      // Create admin user for other org
      const otherAdmin = await prisma.user.create({
        data: {
          email: 'other-standup-admin@test.com',
          passwordHash: 'hashed_password',
          name: 'Other Standup Admin',
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

      // Create integration, team, and config for other org
      const otherIntegration = await prisma.integration.create({
        data: {
          orgId: otherOrg.id,
          platform: IntegrationPlatform.slack,
          externalTeamId: 'T_OTHER_STANDUP',
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
          channelId: 'C_OTHER_STANDUP',
          name: 'other-standup-channel',
        },
      });

      const otherTeam = await prisma.team.create({
        data: {
          orgId: otherOrg.id,
          name: 'Other Standup Team',
          integrationId: otherIntegration.id,
          channelId: otherChannel.id,
          slackChannelId: 'C_OTHER_STANDUP',
          timezone: 'America/New_York',
          createdByUserId: otherAdmin.id,
        },
      });

      const otherConfig = await prisma.standupConfig.create({
        data: {
          teamId: otherTeam.id,
          name: 'Other Org Standup',
          questions: ['Other org question'],
          weekdays: [1, 2, 3, 4, 5],
          timeLocal: '09:00',
          timezone: 'America/New_York',
          reminderMinutesBefore: 15,
          responseTimeoutHours: 2,
          isActive: true,
          createdByUserId: otherAdmin.id,
        },
      });
      otherConfigId = otherConfig.id;
    });

    afterEach(async () => {
      await prisma.standupConfig.deleteMany({ where: { team: { orgId: otherOrgId } } });
      await prisma.team.deleteMany({ where: { orgId: otherOrgId } });
      await prisma.channel.deleteMany({ where: { integration: { orgId: testData.orgId } } });
      await prisma.integration.deleteMany({ where: { orgId: otherOrgId } });
      await prisma.orgMember.deleteMany({ where: { orgId: otherOrgId } });
      await prisma.user.deleteMany({ where: { email: 'other-standup-admin@test.com' } });
      await prisma.organization.deleteMany({ where: { id: otherOrgId } });
    });

    it('should not allow access to configurations from different organization', async () => {
      // Try to access other org's config
      await request(app.getHttpServer())
        .get(`/standups/config/${otherConfigId}`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(404);

      // Try to update other org's config
      await request(app.getHttpServer())
        .put(`/standups/config/${otherConfigId}`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send({ questions: ['Hacked question'] })
        .expect(404);

      // Try to delete other org's config
      await request(app.getHttpServer())
        .delete(`/standups/config/${otherConfigId}`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(404);
    });
  });
});
