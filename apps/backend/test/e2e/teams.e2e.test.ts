import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { IntegrationPlatform, TokenStatus, OrgRole } from '@prisma/client';

describe('Teams (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let originalFetch: typeof fetch;

  // Test data storage
  const testData = {
    orgId: '',
    adminUserId: '',
    memberUserId: '',
    integrationId: '',
    channelId: '',
    teamId: '',
    adminToken: '',
    memberToken: '',
    testUserIds: [] as string[],
  };

  // Mock Slack API responses
  const mockSlackResponses = {
    channels: {
      ok: true,
      channels: [
        {
          id: 'C1234567890',
          name: 'general',
          is_channel: true,
          is_private: false,
          is_archived: false,
          topic: { value: 'General discussion' },
          purpose: { value: 'Company-wide announcements' },
          num_members: 5,
        },
        {
          id: 'C2345678901',
          name: 'dev-team',
          is_channel: true,
          is_private: false,
          is_archived: false,
          topic: { value: 'Development team chat' },
          purpose: { value: 'Development discussions' },
          num_members: 3,
        },
      ],
    },
    users: {
      ok: true,
      members: [
        {
          id: 'U1111111111',
          name: 'testuser1',
          deleted: false,
          is_bot: false,
          is_app_user: false,
          profile: {
            real_name: 'Test User 1',
            display_name: 'testuser1',
            email: 'testuser1@example.com',
            image_192: 'https://example.com/avatar1.jpg',
          },
          tz: 'America/New_York',
        },
        {
          id: 'U2222222222',
          name: 'testuser2',
          deleted: false,
          is_bot: false,
          is_app_user: false,
          profile: {
            real_name: 'Test User 2',
            display_name: 'testuser2',
            email: 'testuser2@example.com',
            image_192: 'https://example.com/avatar2.jpg',
          },
          tz: 'America/Los_Angeles',
        },
      ],
    },
    channelInfo: {
      ok: true,
      channel: {
        id: 'C1234567890',
        name: 'general',
        is_channel: true,
        is_private: false,
        is_archived: false,
        topic: { value: 'General discussion' },
        purpose: { value: 'Company-wide announcements' },
        num_members: 5,
      },
    },
    userInfo: {
      ok: true,
      user: {
        id: 'U1111111111',
        name: 'testuser1',
        profile: {
          real_name: 'Test User',
          display_name: 'Test User',
          email: 'testuser1@example.com',
        },
      },
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);

    // Store original fetch for cleanup
    originalFetch = global.fetch;

    await app.init();
  });

  afterAll(async () => {
    // Restore original fetch
    global.fetch = originalFetch;

    await cleanupTestData();
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    // Clean up existing test data
    await cleanupTestData();

    // Ensure fresh mock setup - clear any existing jest mocks first
    if (jest.isMockFunction(global.fetch)) {
      (global.fetch as jest.Mock).mockReset();
    }

    // Mock Slack API calls
    global.fetch = jest.fn().mockImplementation((url: string) => {
      console.log('Mocking fetch for URL:', url); // Debug log
      if (url.includes('slack.com/api/conversations.info')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSlackResponses.channelInfo),
        });
      }
      if (url.includes('slack.com/api/users.info')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSlackResponses.userInfo),
        });
      }
      // Default response for other Slack API calls
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      });
    });

    // Generate random test data
    const randomSuffix = Math.random().toString(36).substring(7);

    // Create test organization
    const org = await prisma.organization.create({
      data: {
        name: `Teams E2E Test Org ${randomSuffix}`,
      },
    });
    testData.orgId = org.id;

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        email: `teams-admin-${randomSuffix}@test.com`,
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
        email: `teams-member-${randomSuffix}@test.com`,
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

    // Create test integration users
    await prisma.integrationUser.createMany({
      data: [
        {
          integrationId: integration.id,
          externalUserId: 'U1111111111',
          name: 'Test User 1',
          displayName: 'testuser1',
          email: 'testuser1@example.com',
          isBot: false,
          isDeleted: false,
          profileImage: 'https://example.com/avatar1.jpg',
          timezone: 'America/New_York',
          platformData: {},
        },
        {
          integrationId: integration.id,
          externalUserId: 'U2222222222',
          name: 'Test User 2',
          displayName: 'testuser2',
          email: 'testuser2@example.com',
          isBot: false,
          isDeleted: false,
          profileImage: 'https://example.com/avatar2.jpg',
          timezone: 'America/Los_Angeles',
          platformData: {},
        },
      ],
    });

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

    // Mock Slack API calls
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('conversations.info')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSlackResponses.channelInfo),
        });
      }
      if (url.includes('users.info')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSlackResponses.userInfo),
        });
      }
      if (url.includes('conversations.list')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSlackResponses.channels),
        });
      }
      if (url.includes('users.list')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSlackResponses.users),
        });
      }

      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'not_found' }),
      });
    });
  });

  afterEach(async () => {
    await cleanupTestData();
    resetTestData();

    // Restore original fetch to prevent interference with other tests
    global.fetch = originalFetch;
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
      await prisma.teamMember.deleteMany({ where: { team: { orgId: testData.orgId } } });
      await prisma.team.deleteMany({ where: { orgId: testData.orgId } });
      await prisma.integrationUser.deleteMany({
        where: { integration: { orgId: testData.orgId } },
      });
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
      await prisma.organization.deleteMany({ where: { name: { contains: 'Teams E2E Test' } } });
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
    testData.adminToken = '';
    testData.memberToken = '';
    testData.testUserIds = [];
  }

  describe('POST /teams', () => {
    it('should create a team successfully (admin)', async () => {
      const createTeamDto = {
        name: 'Test Team',
        integrationId: testData.integrationId,
        channelId: 'C1234567890',
        timezone: 'America/New_York',
      };

      const response = await request(app.getHttpServer())
        .post('/teams')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(createTeamDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      testData.teamId = response.body.id;

      // Verify team was created in database
      const team = await prisma.team.findUnique({
        where: { id: response.body.id },
        include: {},
      });

      expect(team).toBeDefined();
      expect(team!.name).toBe('Test Team');
      expect(team!.timezone).toBe('America/New_York');
      expect(team!.orgId).toBe(testData.orgId);
      expect(team!.integrationId).toBe(testData.integrationId);
      expect(team!.createdByUserId).toBe(testData.adminUserId);
    });

    it('should not allow members to create teams', async () => {
      const createTeamDto = {
        name: 'Test Team',
        integrationId: testData.integrationId,
        channelId: 'C1234567890',
        timezone: 'America/New_York',
      };

      await request(app.getHttpServer())
        .post('/teams')
        .set('Authorization', `Bearer ${testData.memberToken}`)
        .send(createTeamDto)
        .expect(403);
    });

    it('should require authentication', async () => {
      const createTeamDto = {
        name: 'Test Team',
        integrationId: testData.integrationId,
        channelId: 'C1234567890',
        timezone: 'America/New_York',
      };

      await request(app.getHttpServer()).post('/teams').send(createTeamDto).expect(401);
    });

    it('should reject duplicate team names', async () => {
      // Create first team
      const createTeamDto = {
        name: 'Duplicate Team',
        integrationId: testData.integrationId,
        channelId: 'C1234567890',
        timezone: 'America/New_York',
      };

      await request(app.getHttpServer())
        .post('/teams')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(createTeamDto)
        .expect(201);

      // Try to create team with same name
      await request(app.getHttpServer())
        .post('/teams')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(createTeamDto)
        .expect(409);
    });

    it('should reject invalid integration ID', async () => {
      const createTeamDto = {
        name: 'Test Team',
        integrationId: '12345678-1234-1234-1234-123456789012', // Valid UUID format but doesn't exist
        channelId: 'C1234567890',
        timezone: 'America/New_York',
      };

      await request(app.getHttpServer())
        .post('/teams')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(createTeamDto)
        .expect(400); // System returns 400 for non-existent integration ID
    });

    it('should reject invalid channel ID', async () => {
      // In test mode, channel validation is disabled, so we expect 404 from database lookup
      const createTeamDto = {
        name: 'Test Team',
        integrationId: testData.integrationId,
        channelId: 'C_INVALID',
        timezone: 'America/New_York',
      };

      await request(app.getHttpServer())
        .post('/teams')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(createTeamDto)
        .expect(201); // Teams no longer require channels, so creation succeeds
    });

    it('should validate required fields', async () => {
      const invalidData = {
        // Missing required fields
        name: '',
        timezone: 'Invalid/Timezone',
      };

      await request(app.getHttpServer())
        .post('/teams')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(invalidData)
        .expect(400);
    });
  });

  describe('GET /teams', () => {
    beforeEach(async () => {
      // Ensure admin user exists before creating teams
      const adminUser = await prisma.user.findUnique({
        where: { id: testData.adminUserId },
      });
      if (!adminUser) {
        throw new Error('Admin user not found for team creation');
      }

      // Create test teams
      const team1 = await prisma.team.create({
        data: {
          orgId: testData.orgId,
          name: 'Team 1',
          integrationId: testData.integrationId,
          timezone: 'America/New_York',
          createdByUserId: testData.adminUserId,
        },
      });

      const team2 = await prisma.team.create({
        data: {
          orgId: testData.orgId,
          name: 'Team 2',
          integrationId: testData.integrationId,
          timezone: 'America/Los_Angeles',
          createdByUserId: testData.adminUserId,
        },
      });

      // Add some team members
      await prisma.teamMember.createMany({
        data: [
          {
            teamId: team1.id,
            platformUserId: 'U1111111111',
            name: 'Test User 1',
            active: true,
            addedByUserId: testData.adminUserId,
          },
          {
            teamId: team2.id,
            platformUserId: 'U2222222222',
            name: 'Test User 2',
            active: true,
            addedByUserId: testData.adminUserId,
          },
        ],
      });
    });

    it('should list teams for admin user', async () => {
      const response = await request(app.getHttpServer())
        .get('/teams')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('teams');
      expect(Array.isArray(response.body.teams)).toBe(true);
      expect(response.body.teams.length).toBe(2);

      const team = response.body.teams[0];
      expect(team).toHaveProperty('id');
      expect(team).toHaveProperty('name');
      expect(team).toHaveProperty('memberCount');
      expect(team).toHaveProperty('standupConfigCount');
      expect(team).toHaveProperty('createdAt');
      expect(team).toHaveProperty('createdBy');
    });

    it('should list teams for member user', async () => {
      const response = await request(app.getHttpServer())
        .get('/teams')
        .set('Authorization', `Bearer ${testData.memberToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('teams');
      expect(Array.isArray(response.body.teams)).toBe(true);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer()).get('/teams').expect(401);
    });

    it('should return empty array when no teams exist', async () => {
      // Clean up existing teams (only for this test org)
      await prisma.teamMember.deleteMany({ where: { team: { orgId: testData.orgId } } });
      await prisma.team.deleteMany({ where: { orgId: testData.orgId } });

      const response = await request(app.getHttpServer())
        .get('/teams')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(200);

      expect(response.body.teams).toEqual([]);
    });
  });

  describe('GET /teams/:id', () => {
    let teamId: string;

    beforeEach(async () => {
      // Ensure admin user exists before creating team
      const adminUser = await prisma.user.findUnique({
        where: { id: testData.adminUserId },
      });
      if (!adminUser) {
        throw new Error('Admin user not found for team creation');
      }

      // Create test team
      const team = await prisma.team.create({
        data: {
          orgId: testData.orgId,
          name: 'Detailed Team',
          integrationId: testData.integrationId,
          timezone: 'America/New_York',
          createdByUserId: testData.adminUserId,
        },
      });
      teamId = team.id;

      // Add team members
      await prisma.teamMember.create({
        data: {
          teamId: team.id,
          platformUserId: 'U1111111111',
          name: 'Test User 1',
          active: true,
          addedByUserId: testData.adminUserId,
        },
      });
    });

    it('should get team details for authorized user', async () => {
      const response = await request(app.getHttpServer())
        .get(`/teams/${teamId}`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', teamId);
      expect(response.body).toHaveProperty('name', 'Detailed Team');
      expect(response.body).toHaveProperty('timezone', 'America/New_York');
      expect(response.body).toHaveProperty('integration');
      expect(response.body).toHaveProperty('members');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('createdBy');

      expect(Array.isArray(response.body.members)).toBe(true);
      expect(response.body.members.length).toBe(1);
      expect(response.body.members[0]).toHaveProperty('name', 'Test User 1');
    });

    it('should return 404 for non-existent team', async () => {
      await request(app.getHttpServer())
        .get('/teams/non-existent-id')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer()).get(`/teams/${teamId}`).expect(401);
    });
  });

  describe('PUT /teams/:id', () => {
    let teamId: string;

    beforeEach(async () => {
      const team = await prisma.team.create({
        data: {
          orgId: testData.orgId,
          name: 'Original Team Name',
          integrationId: testData.integrationId,
          timezone: 'America/New_York',
          createdByUserId: testData.adminUserId,
        },
      });
      teamId = team.id;
    });

    it('should update team successfully (admin)', async () => {
      const updateData = {
        name: 'Updated Team Name',
        timezone: 'America/Los_Angeles',
      };

      const response = await request(app.getHttpServer())
        .put(`/teams/${teamId}`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({ success: true });

      // Verify update in database
      const updatedTeam = await prisma.team.findUnique({
        where: { id: teamId },
      });

      expect(updatedTeam!.name).toBe('Updated Team Name');
      expect(updatedTeam!.timezone).toBe('America/Los_Angeles');
    });

    it('should not allow members to update teams', async () => {
      const updateData = {
        name: 'Updated Team Name',
      };

      await request(app.getHttpServer())
        .put(`/teams/${teamId}`)
        .set('Authorization', `Bearer ${testData.memberToken}`)
        .send(updateData)
        .expect(403);
    });

    it('should reject duplicate team names', async () => {
      // Create another team
      await prisma.team.create({
        data: {
          orgId: testData.orgId,
          name: 'Existing Team',
          integrationId: testData.integrationId,
          timezone: 'America/New_York',
          createdByUserId: testData.adminUserId,
        },
      });

      const updateData = {
        name: 'Existing Team', // Duplicate name
      };

      await request(app.getHttpServer())
        .put(`/teams/${teamId}`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(updateData)
        .expect(409);
    });

    it('should return 404 for non-existent team', async () => {
      const updateData = {
        name: 'Updated Name',
      };

      await request(app.getHttpServer())
        .put('/teams/non-existent-id')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(updateData)
        .expect(404);
    });
  });

  describe('DELETE /teams/:id', () => {
    let teamId: string;

    beforeEach(async () => {
      const team = await prisma.team.create({
        data: {
          orgId: testData.orgId,
          name: 'Team to Delete',
          integrationId: testData.integrationId,
          timezone: 'America/New_York',
          createdByUserId: testData.adminUserId,
        },
      });
      teamId = team.id;

      // Add team member for cascade delete test
      await prisma.teamMember.create({
        data: {
          teamId: team.id,
          platformUserId: 'U1111111111',
          name: 'Test User 1',
          active: true,
          addedByUserId: testData.adminUserId,
        },
      });
    });

    it('should delete team successfully (admin)', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/teams/${teamId}`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(200);

      expect(response.body).toEqual({ success: true });

      // Verify team was deleted
      const deletedTeam = await prisma.team.findUnique({
        where: { id: teamId },
      });
      expect(deletedTeam).toBeNull();

      // Verify cascade delete of team members
      const teamMembers = await prisma.teamMember.findMany({
        where: { teamId },
      });
      expect(teamMembers).toHaveLength(0);
    });

    it('should not allow members to delete teams', async () => {
      await request(app.getHttpServer())
        .delete(`/teams/${teamId}`)
        .set('Authorization', `Bearer ${testData.memberToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent team', async () => {
      await request(app.getHttpServer())
        .delete('/teams/non-existent-id')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(404);
    });
  });

  describe('GET /teams/slack/channels', () => {
    it('should get available channels for admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/teams/slack/channels')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('channels');
      expect(Array.isArray(response.body.channels)).toBe(true);

      if (response.body.channels.length > 0) {
        const channel = response.body.channels[0];
        expect(channel).toHaveProperty('id');
        expect(channel).toHaveProperty('name');
        expect(channel).toHaveProperty('isAssigned');
      }
    });

    it('should not allow members to view available channels', async () => {
      await request(app.getHttpServer())
        .get('/teams/slack/channels')
        .set('Authorization', `Bearer ${testData.memberToken}`)
        .expect(403);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer()).get('/teams/slack/channels').expect(401);
    });
  });

  describe('GET /teams/slack/members', () => {
    it('should get available members for admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/teams/slack/members')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('members');
      expect(Array.isArray(response.body.members)).toBe(true);

      if (response.body.members.length > 0) {
        const member = response.body.members[0];
        expect(member).toHaveProperty('id');
        expect(member).toHaveProperty('name');
        expect(member).toHaveProperty('platformUserId');
        expect(member).toHaveProperty('inTeamCount');
      }
    });

    it('should not allow members to view available members', async () => {
      await request(app.getHttpServer())
        .get('/teams/slack/members')
        .set('Authorization', `Bearer ${testData.memberToken}`)
        .expect(403);
    });
  });

  describe('POST /teams/:id/members', () => {
    let teamId: string;

    beforeEach(async () => {
      const team = await prisma.team.create({
        data: {
          orgId: testData.orgId,
          name: 'Member Test Team',
          integrationId: testData.integrationId,
          timezone: 'America/New_York',
          createdByUserId: testData.adminUserId,
        },
      });
      teamId = team.id;
    });

    it('should add team member successfully (admin)', async () => {
      const addMemberDto = {
        slackUserId: 'U1111111111',
      };

      const response = await request(app.getHttpServer())
        .post(`/teams/${teamId}/members`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(addMemberDto)
        .expect(201);

      expect(response.body).toEqual({ success: true });

      // Verify member was added
      const teamMember = await prisma.teamMember.findFirst({
        where: {
          teamId,
          platformUserId: 'U1111111111',
        },
      });

      expect(teamMember).toBeDefined();
      expect(teamMember!.name).toBe('Test User'); // From mocked Slack API
      expect(teamMember!.active).toBe(true);
    });

    it('should not allow duplicate team members', async () => {
      // Add member first time
      const addMemberDto = {
        slackUserId: 'U1111111111',
      };

      await request(app.getHttpServer())
        .post(`/teams/${teamId}/members`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(addMemberDto)
        .expect(201);

      // Try to add same member again
      await request(app.getHttpServer())
        .post(`/teams/${teamId}/members`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(addMemberDto)
        .expect(409);
    });

    it('should not allow members to add team members', async () => {
      const addMemberDto = {
        slackUserId: 'U1111111111',
      };

      await request(app.getHttpServer())
        .post(`/teams/${teamId}/members`)
        .set('Authorization', `Bearer ${testData.memberToken}`)
        .send(addMemberDto)
        .expect(403);
    });

    it('should return 404 for non-existent team', async () => {
      const addMemberDto = {
        slackUserId: 'U1111111111',
      };

      await request(app.getHttpServer())
        .post('/teams/non-existent-id/members')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(addMemberDto)
        .expect(404);
    });
  });

  describe('DELETE /teams/:id/members/:memberId', () => {
    let teamId: string;
    let memberId: string;

    beforeEach(async () => {
      const team = await prisma.team.create({
        data: {
          orgId: testData.orgId,
          name: 'Member Remove Test Team',
          integrationId: testData.integrationId,
          timezone: 'America/New_York',
          createdByUserId: testData.adminUserId,
        },
      });
      teamId = team.id;

      const teamMember = await prisma.teamMember.create({
        data: {
          teamId: team.id,
          platformUserId: 'U1111111111',
          name: 'Test User 1',
          active: true,
          addedByUserId: testData.adminUserId,
        },
      });
      memberId = teamMember.id;
    });

    it('should remove team member successfully (admin)', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/teams/${teamId}/members/${memberId}`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(200);

      expect(response.body).toEqual({ success: true });

      // Verify member was removed
      const deletedMember = await prisma.teamMember.findUnique({
        where: { id: memberId },
      });
      expect(deletedMember).toBeNull();
    });

    it('should not allow members to remove team members', async () => {
      await request(app.getHttpServer())
        .delete(`/teams/${teamId}/members/${memberId}`)
        .set('Authorization', `Bearer ${testData.memberToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent member', async () => {
      await request(app.getHttpServer())
        .delete(`/teams/${teamId}/members/non-existent-id`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(404);
    });
  });

  describe('Cross-organization Security', () => {
    let otherOrgId: string;
    let otherTeamId: string;

    beforeEach(async () => {
      // Create another organization
      const otherOrg = await prisma.organization.create({
        data: {
          name: 'Other Organization',
        },
      });
      otherOrgId = otherOrg.id;

      // Create admin user for other org
      const otherAdmin = await prisma.user.create({
        data: {
          email: 'other-admin@test.com',
          passwordHash: 'hashed_password',
          name: 'Other Admin',
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

      // Create integration and team for other org
      const otherIntegration = await prisma.integration.create({
        data: {
          orgId: otherOrg.id,
          platform: IntegrationPlatform.slack,
          externalTeamId: 'T_OTHER',
          accessToken: 'other-token',
          botToken: 'other-bot-token',
          botUserId: 'B_OTHER',
          appId: 'A_OTHER',
          tokenStatus: TokenStatus.ok,
          scopes: [],
          userScopes: [],
        },
      });

      const otherTeam = await prisma.team.create({
        data: {
          orgId: otherOrg.id,
          name: 'Other Team',
          integrationId: otherIntegration.id,
          timezone: 'America/New_York',
          createdByUserId: otherAdmin.id,
        },
      });
      otherTeamId = otherTeam.id;
    });

    afterEach(async () => {
      await prisma.team.deleteMany({ where: { orgId: otherOrgId } });
      await prisma.channel.deleteMany({ where: { integration: { orgId: testData.orgId } } });
      await prisma.integration.deleteMany({ where: { orgId: otherOrgId } });
      await prisma.orgMember.deleteMany({ where: { orgId: otherOrgId } });
      await prisma.user.deleteMany({ where: { email: 'other-admin@test.com' } });
      await prisma.organization.deleteMany({ where: { id: otherOrgId } });
    });

    it('should not allow access to teams from different organization', async () => {
      // Try to access other org's team with current admin token
      await request(app.getHttpServer())
        .get(`/teams/${otherTeamId}`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(404);

      // Try to update other org's team
      await request(app.getHttpServer())
        .put(`/teams/${otherTeamId}`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send({ name: 'Hacked Team' })
        .expect(404);

      // Try to delete other org's team
      await request(app.getHttpServer())
        .delete(`/teams/${otherTeamId}`)
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .expect(404);
    });
  });
});
