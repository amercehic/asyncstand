import request from 'supertest';
import { E2ETestBase } from '@/test/utils/e2e-test-base';
import { SlackMockService } from '@/test/mocks/slack.mock';

describe('Teams (e2e)', () => {
  const testBase = new E2ETestBase();
  let slackMock: SlackMockService;
  let originalFetch: typeof fetch;

  // Test data for current test run
  let testContext: {
    orgId: string;
    adminUserId: string;
    memberUserId: string;
    integrationId: string;
    channelId: string;
    adminToken: string;
    memberToken: string;
  };

  beforeAll(async () => {
    await testBase.setupSuite();

    // Store original fetch
    originalFetch = global.fetch;
  });

  afterAll(async () => {
    // Restore original fetch
    global.fetch = originalFetch;

    await testBase.teardownSuite();
  });

  beforeEach(async () => {
    await testBase.setupTest();

    // Setup Slack mocks with unique test prefix
    slackMock = new SlackMockService(testBase.isolation.getTestId());
    global.fetch = slackMock.setupMockFetch();

    // Create test organization with admin and member
    const { org, owner: admin } = await testBase.factory.createOrganization({
      ownerEmail: `admin-${Math.random().toString(36).substring(2)}@test.com`,
    });

    const member = await testBase.factory.createUser({
      email: `member-${Math.random().toString(36).substring(2)}@test.com`,
      name: testBase.isolation.prefix('Member User'),
      orgId: org.id,
      role: 'member',
    });

    // Create Slack integration
    const integration = await testBase.factory.createSlackIntegration(org.id, admin.id);

    // Create test channel
    const channel = await testBase.factory.createChannel(integration.id, {
      channelId: `C${testBase.isolation.getTestId()}_1`,
      name: testBase.isolation.prefix('general'),
    });

    // Create integration users that match our mock data
    const mockUsers = slackMock.getMockUsers();
    for (const mockUser of mockUsers.members) {
      await testBase.prisma.integrationUser.create({
        data: {
          integrationId: integration.id,
          externalUserId: mockUser.id,
          name: mockUser.profile.real_name,
          displayName: mockUser.profile.display_name,
          email: mockUser.profile.email,
          isBot: false,
          isDeleted: false,
          profileImage: mockUser.profile.image_192,
          timezone: mockUser.tz,
          platformData: {},
        },
      });
    }

    // Store test context
    testContext = {
      orgId: org.id,
      adminUserId: admin.id,
      memberUserId: member.id,
      integrationId: integration.id,
      channelId: channel.id,
      adminToken: admin.token!,
      memberToken: member.token!,
    };
  });

  afterEach(async () => {
    // Restore original fetch before cleanup
    global.fetch = originalFetch;

    await testBase.teardownTest();
  });

  describe('POST /teams', () => {
    it('should create a team successfully (admin)', async () => {
      const createTeamDto = {
        name: testBase.isolation.generateTeamName('engineering'),
        integrationId: testContext.integrationId,
        timezone: 'America/New_York',
      };

      const response = await request(testBase.getHttpServer())
        .post('/teams')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send(createTeamDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');

      // Verify team was created in database
      const team = await testBase.prisma.team.findUnique({
        where: { id: response.body.id },
      });

      expect(team).toBeDefined();
      expect(team!.name).toBe(createTeamDto.name);
      expect(team!.timezone).toBe('America/New_York');
      expect(team!.orgId).toBe(testContext.orgId);
      expect(team!.integrationId).toBe(testContext.integrationId);
      expect(team!.createdByUserId).toBe(testContext.adminUserId);
    });

    it('should not allow members to create teams', async () => {
      const createTeamDto = {
        name: testBase.isolation.generateTeamName('restricted'),
        integrationId: testContext.integrationId,
        timezone: 'America/New_York',
      };

      await request(testBase.getHttpServer())
        .post('/teams')
        .set('Authorization', `Bearer ${testContext.memberToken}`)
        .send(createTeamDto)
        .expect(403);
    });

    it('should require authentication', async () => {
      const createTeamDto = {
        name: testBase.isolation.generateTeamName('unauth'),
        integrationId: testContext.integrationId,
        timezone: 'America/New_York',
      };

      await request(testBase.getHttpServer()).post('/teams').send(createTeamDto).expect(401);
    });

    it('should reject duplicate team names within same org', async () => {
      const teamName = testBase.isolation.generateTeamName('duplicate');

      // Create first team
      const createTeamDto = {
        name: teamName,
        integrationId: testContext.integrationId,
        timezone: 'America/New_York',
      };

      await request(testBase.getHttpServer())
        .post('/teams')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send(createTeamDto)
        .expect(201);

      // Try to create team with same name
      await request(testBase.getHttpServer())
        .post('/teams')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send(createTeamDto)
        .expect(409);
    });

    it('should reject invalid integration ID', async () => {
      const createTeamDto = {
        name: testBase.isolation.generateTeamName('invalid-integration'),
        integrationId: '12345678-1234-1234-1234-123456789012', // Valid UUID but doesn't exist
        timezone: 'America/New_York',
      };

      await request(testBase.getHttpServer())
        .post('/teams')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send(createTeamDto)
        .expect(400);
    });

    it('should validate required fields', async () => {
      const invalidData = {
        name: '', // Empty name
        timezone: 'Invalid/Timezone',
      };

      await request(testBase.getHttpServer())
        .post('/teams')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send(invalidData)
        .expect(400);
    });
  });

  describe('GET /teams', () => {
    beforeEach(async () => {
      // Create test teams
      await testBase.factory.createTeam(
        testContext.orgId,
        testContext.integrationId,
        testContext.adminUserId,
        { name: testBase.isolation.generateTeamName('team1') },
      );

      await testBase.factory.createTeam(
        testContext.orgId,
        testContext.integrationId,
        testContext.adminUserId,
        { name: testBase.isolation.generateTeamName('team2') },
      );
    });

    it('should list teams for admin user', async () => {
      const response = await request(testBase.getHttpServer())
        .get('/teams')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('teams');
      expect(Array.isArray(response.body.teams)).toBe(true);
      expect(response.body.teams.length).toBeGreaterThanOrEqual(2);

      // Verify teams belong to correct org
      const teamNames = response.body.teams.map((t: { name: string }) => t.name);
      expect(teamNames.some((name: string) => name.includes(testBase.isolation.getTestId()))).toBe(
        true,
      );
    });

    it('should list teams for member user', async () => {
      const response = await request(testBase.getHttpServer())
        .get('/teams')
        .set('Authorization', `Bearer ${testContext.memberToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('teams');
      expect(Array.isArray(response.body.teams)).toBe(true);
    });

    it('should require authentication', async () => {
      await request(testBase.getHttpServer()).get('/teams').expect(401);
    });

    it('should return empty array when no teams exist', async () => {
      // Create a new org with no teams
      const { owner } = await testBase.factory.createOrganization({
        name: testBase.isolation.generateOrgName(
          `empty-${Math.random().toString(36).substring(2)}`,
        ),
        ownerEmail: `empty-owner-${Math.random().toString(36).substring(2)}@test.com`,
      });

      const response = await request(testBase.getHttpServer())
        .get('/teams')
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);

      expect(response.body.teams).toEqual([]);
    });
  });

  describe('GET /teams/:id', () => {
    let teamId: string;

    beforeEach(async () => {
      // Create test team with members
      const team = await testBase.factory.createTeam(
        testContext.orgId,
        testContext.integrationId,
        testContext.adminUserId,
        { name: testBase.isolation.generateTeamName('detailed') },
      );
      teamId = team.id;

      // Add team member
      const mockUsers = slackMock.getMockUsers();
      await testBase.prisma.teamMember.create({
        data: {
          teamId: team.id,
          platformUserId: mockUsers.members[0].id,
          name: mockUsers.members[0].profile.real_name,
          active: true,
          addedByUserId: testContext.adminUserId,
        },
      });
    });

    it('should get team details for authorized user', async () => {
      const response = await request(testBase.getHttpServer())
        .get(`/teams/${teamId}`)
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', teamId);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('timezone', 'America/New_York');
      expect(response.body).toHaveProperty('integration');
      expect(response.body).toHaveProperty('members');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('createdBy');

      expect(Array.isArray(response.body.members)).toBe(true);
      expect(response.body.members.length).toBe(1);
    });

    it('should return 404 for non-existent team', async () => {
      await request(testBase.getHttpServer())
        .get('/teams/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(testBase.getHttpServer()).get(`/teams/${teamId}`).expect(401);
    });
  });

  describe('PUT /teams/:id', () => {
    let teamId: string;

    beforeEach(async () => {
      const team = await testBase.factory.createTeam(
        testContext.orgId,
        testContext.integrationId,
        testContext.adminUserId,
        { name: testBase.isolation.generateTeamName('original') },
      );
      teamId = team.id;
    });

    it('should update team successfully (admin)', async () => {
      const updateData = {
        name: testBase.isolation.generateTeamName('updated'),
        timezone: 'America/Los_Angeles',
      };

      const response = await request(testBase.getHttpServer())
        .put(`/teams/${teamId}`)
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({ success: true });

      // Verify update in database
      const updatedTeam = await testBase.prisma.team.findUnique({
        where: { id: teamId },
      });

      expect(updatedTeam!.name).toBe(updateData.name);
      expect(updatedTeam!.timezone).toBe('America/Los_Angeles');
    });

    it('should not allow members to update teams', async () => {
      const updateData = {
        name: testBase.isolation.generateTeamName('forbidden'),
      };

      await request(testBase.getHttpServer())
        .put(`/teams/${teamId}`)
        .set('Authorization', `Bearer ${testContext.memberToken}`)
        .send(updateData)
        .expect(403);
    });

    it('should reject duplicate team names', async () => {
      // Create another team
      const existingTeamName = testBase.isolation.generateTeamName('existing');
      await testBase.factory.createTeam(
        testContext.orgId,
        testContext.integrationId,
        testContext.adminUserId,
        { name: existingTeamName },
      );

      const updateData = {
        name: existingTeamName, // Try to use existing name
      };

      await request(testBase.getHttpServer())
        .put(`/teams/${teamId}`)
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send(updateData)
        .expect(409);
    });

    it('should return 404 for non-existent team', async () => {
      const updateData = {
        name: testBase.isolation.generateTeamName('ghost'),
      };

      await request(testBase.getHttpServer())
        .put('/teams/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send(updateData)
        .expect(404);
    });
  });

  describe('DELETE /teams/:id', () => {
    let teamId: string;

    beforeEach(async () => {
      const team = await testBase.factory.createTeam(
        testContext.orgId,
        testContext.integrationId,
        testContext.adminUserId,
        { name: testBase.isolation.generateTeamName('delete') },
      );
      teamId = team.id;

      // Add team member for cascade delete test
      const mockUsers = slackMock.getMockUsers();
      await testBase.prisma.teamMember.create({
        data: {
          teamId: team.id,
          platformUserId: mockUsers.members[0].id,
          name: mockUsers.members[0].profile.real_name,
          active: true,
          addedByUserId: testContext.adminUserId,
        },
      });
    });

    it('should delete team successfully (admin)', async () => {
      const response = await request(testBase.getHttpServer())
        .delete(`/teams/${teamId}`)
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .expect(200);

      expect(response.body).toEqual({ success: true });

      // Verify team was deleted
      const deletedTeam = await testBase.prisma.team.findUnique({
        where: { id: teamId },
      });
      expect(deletedTeam).toBeNull();

      // Verify cascade delete of team members
      const teamMembers = await testBase.prisma.teamMember.findMany({
        where: { teamId },
      });
      expect(teamMembers).toHaveLength(0);
    });

    it('should not allow members to delete teams', async () => {
      await request(testBase.getHttpServer())
        .delete(`/teams/${teamId}`)
        .set('Authorization', `Bearer ${testContext.memberToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent team', async () => {
      await request(testBase.getHttpServer())
        .delete('/teams/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .expect(404);
    });
  });

  describe('GET /teams/slack/channels', () => {
    it('should get available channels for admin', async () => {
      const response = await request(testBase.getHttpServer())
        .get('/teams/slack/channels')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('channels');
      expect(Array.isArray(response.body.channels)).toBe(true);
    });

    it('should not allow members to view available channels', async () => {
      await request(testBase.getHttpServer())
        .get('/teams/slack/channels')
        .set('Authorization', `Bearer ${testContext.memberToken}`)
        .expect(403);
    });

    it('should require authentication', async () => {
      await request(testBase.getHttpServer()).get('/teams/slack/channels').expect(401);
    });
  });

  describe('GET /teams/slack/members', () => {
    it('should get available members for admin', async () => {
      const response = await request(testBase.getHttpServer())
        .get('/teams/slack/members')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('members');
      expect(Array.isArray(response.body.members)).toBe(true);
    });

    it('should not allow members to view available members', async () => {
      await request(testBase.getHttpServer())
        .get('/teams/slack/members')
        .set('Authorization', `Bearer ${testContext.memberToken}`)
        .expect(403);
    });
  });

  describe('POST /teams/:id/members', () => {
    let teamId: string;
    let slackUserId: string;

    beforeEach(async () => {
      const team = await testBase.factory.createTeam(
        testContext.orgId,
        testContext.integrationId,
        testContext.adminUserId,
        { name: testBase.isolation.generateTeamName('members') },
      );
      teamId = team.id;

      // Get a mock user ID
      const mockUsers = slackMock.getMockUsers();
      slackUserId = mockUsers.members[0].id;
    });

    it('should add team member successfully (admin)', async () => {
      const addMemberDto = {
        slackUserId,
      };

      const response = await request(testBase.getHttpServer())
        .post(`/teams/${teamId}/members`)
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send(addMemberDto)
        .expect(201);

      expect(response.body).toEqual({ success: true });

      // Verify member was added
      const teamMember = await testBase.prisma.teamMember.findFirst({
        where: {
          teamId,
          platformUserId: slackUserId,
        },
      });

      expect(teamMember).toBeDefined();
      expect(teamMember!.active).toBe(true);
    });

    it('should not allow duplicate team members', async () => {
      const addMemberDto = {
        slackUserId,
      };

      // Add member first time
      await request(testBase.getHttpServer())
        .post(`/teams/${teamId}/members`)
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send(addMemberDto)
        .expect(201);

      // Try to add same member again
      await request(testBase.getHttpServer())
        .post(`/teams/${teamId}/members`)
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send(addMemberDto)
        .expect(409);
    });

    it('should not allow members to add team members', async () => {
      const addMemberDto = {
        slackUserId,
      };

      await request(testBase.getHttpServer())
        .post(`/teams/${teamId}/members`)
        .set('Authorization', `Bearer ${testContext.memberToken}`)
        .send(addMemberDto)
        .expect(403);
    });

    it('should return 404 for non-existent team', async () => {
      const addMemberDto = {
        slackUserId,
      };

      await request(testBase.getHttpServer())
        .post('/teams/00000000-0000-0000-0000-000000000000/members')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send(addMemberDto)
        .expect(404);
    });
  });

  describe('DELETE /teams/:id/members/:memberId', () => {
    let teamId: string;
    let memberId: string;

    beforeEach(async () => {
      const team = await testBase.factory.createTeam(
        testContext.orgId,
        testContext.integrationId,
        testContext.adminUserId,
        { name: testBase.isolation.generateTeamName('remove-member') },
      );
      teamId = team.id;

      const mockUsers = slackMock.getMockUsers();
      const teamMember = await testBase.prisma.teamMember.create({
        data: {
          teamId: team.id,
          platformUserId: mockUsers.members[0].id,
          name: mockUsers.members[0].profile.real_name,
          active: true,
          addedByUserId: testContext.adminUserId,
        },
      });
      memberId = teamMember.id;
    });

    it('should remove team member successfully (admin)', async () => {
      const response = await request(testBase.getHttpServer())
        .delete(`/teams/${teamId}/members/${memberId}`)
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .expect(200);

      expect(response.body).toEqual({ success: true });

      // Verify member was removed
      const deletedMember = await testBase.prisma.teamMember.findUnique({
        where: { id: memberId },
      });
      expect(deletedMember).toBeNull();
    });

    it('should not allow members to remove team members', async () => {
      await request(testBase.getHttpServer())
        .delete(`/teams/${teamId}/members/${memberId}`)
        .set('Authorization', `Bearer ${testContext.memberToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent member', async () => {
      await request(testBase.getHttpServer())
        .delete(`/teams/${teamId}/members/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .expect(404);
    });
  });

  describe('Cross-organization Security', () => {
    it('should not allow access to teams from different organization', async () => {
      // Create another organization with its own team
      const { org: otherOrg, owner: otherOwner } = await testBase.factory.createOrganization({
        name: testBase.isolation.generateOrgName(
          `other-${Math.random().toString(36).substring(2)}`,
        ),
        ownerEmail: `other-owner-${Math.random().toString(36).substring(2)}@test.com`,
      });

      const otherIntegration = await testBase.factory.createSlackIntegration(
        otherOrg.id,
        otherOwner.id,
      );
      const otherTeam = await testBase.factory.createTeam(
        otherOrg.id,
        otherIntegration.id,
        otherOwner.id,
        { name: testBase.isolation.generateTeamName('other-org') },
      );

      // Try to access other org's team with current admin token
      await request(testBase.getHttpServer())
        .get(`/teams/${otherTeam.id}`)
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .expect(404);

      // Try to update other org's team
      await request(testBase.getHttpServer())
        .put(`/teams/${otherTeam.id}`)
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ name: 'Hacked Team' })
        .expect(404);

      // Try to delete other org's team
      await request(testBase.getHttpServer())
        .delete(`/teams/${otherTeam.id}`)
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .expect(404);
    });
  });
});
