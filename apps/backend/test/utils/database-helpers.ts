import { PrismaService } from '@/prisma/prisma.service';

export class DatabaseHelpers {
  /**
   * Clean database in dependency order
   */
  static async cleanDatabase(prisma: PrismaService): Promise<void> {
    // Delete in reverse dependency order to avoid foreign key constraints
    await prisma.standupConfigMember.deleteMany();
    await prisma.standupConfig.deleteMany();
    await prisma.answer.deleteMany();
    await prisma.participationSnapshot.deleteMany();
    await prisma.standupDigestPost.deleteMany();
    await prisma.standupInstance.deleteMany();
    await prisma.teamMember.deleteMany();
    await prisma.team.deleteMany();
    await prisma.integrationUser.deleteMany();
    await prisma.channel.deleteMany();
    await prisma.integrationSyncState.deleteMany();
    await prisma.tokenRefreshJob.deleteMany();
    await prisma.integration.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.orgMember.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.session.deleteMany();
    await prisma.passwordResetToken.deleteMany();
    await prisma.user.deleteMany();
  }

  /**
   * Setup basic test data
   */
  static async setupTestData(prisma: PrismaService) {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        name: 'Test User',
      },
    });

    // Create test organization
    const org = await prisma.organization.create({
      data: {
        name: 'Test Organization',
      },
    });

    // Create org membership
    await prisma.orgMember.create({
      data: {
        orgId: org.id,
        userId: user.id,
        role: 'admin',
        status: 'active',
      },
    });

    return { user, org };
  }

  /**
   * Create test integration
   */
  static async createTestIntegration(prisma: PrismaService, orgId: string, userId: string) {
    return prisma.integration.create({
      data: {
        orgId,
        platform: 'slack',
        externalTeamId: 'T1234567890',
        accessToken: 'xoxb-test-token',
        refreshToken: 'refresh-token',
        tokenStatus: 'ok',
        scopes: ['channels:read', 'users:read', 'chat:write'],
        userScopes: ['identify'],
        installedByUserId: userId,
        botToken: 'xoxb-bot-token',
        botUserId: 'B1234567890',
        appId: 'A1234567890',
      },
    });
  }

  /**
   * Create test channel
   */
  static async createTestChannel(prisma: PrismaService, integrationId: string) {
    return prisma.channel.create({
      data: {
        integrationId,
        channelId: 'C1234567890',
        name: 'test-channel',
        topic: 'Test channel topic',
        purpose: 'Test channel purpose',
        isPrivate: false,
        isArchived: false,
        memberCount: 5,
      },
    });
  }

  /**
   * Create test integration user
   */
  static async createTestIntegrationUser(prisma: PrismaService, integrationId: string) {
    return prisma.integrationUser.create({
      data: {
        integrationId,
        externalUserId: 'U1234567890',
        name: 'Test Slack User',
        displayName: 'Test User',
        email: 'slackuser@example.com',
        isBot: false,
        isDeleted: false,
        profileImage: 'https://avatars.slack-edge.com/test.jpg',
        timezone: 'America/New_York',
        platformData: {
          real_name: 'Test Slack User',
          title: 'Developer',
        },
      },
    });
  }

  /**
   * Create test team
   */
  static async createTestTeam(
    prisma: PrismaService,
    orgId: string,
    integrationId: string,
    channelId: string,
    createdByUserId: string,
  ) {
    return prisma.team.create({
      data: {
        orgId,
        integrationId,
        channelId,
        slackChannelId: 'C1234567890',
        name: 'Test Team',
        timezone: 'America/New_York',
        createdByUserId,
      },
    });
  }

  /**
   * Create test team member
   */
  static async createTestTeamMember(
    prisma: PrismaService,
    teamId: string,
    integrationUserId: string,
    addedByUserId: string,
  ) {
    return prisma.teamMember.create({
      data: {
        teamId,
        integrationUserId,
        platformUserId: 'U1234567890',
        name: 'Test Team Member',
        active: true,
        addedByUserId,
      },
    });
  }

  /**
   * Create test standup config
   */
  static async createTestStandupConfig(
    prisma: PrismaService,
    teamId: string,
    createdByUserId: string,
  ) {
    return prisma.standupConfig.create({
      data: {
        teamId,
        questions: [
          'What did you accomplish yesterday?',
          'What will you work on today?',
          'Are there any blockers or impediments?',
        ],
        weekdays: [1, 2, 3, 4, 5],
        timeLocal: '09:00',
        timezone: 'America/New_York',
        reminderMinutesBefore: 15,
        responseTimeoutHours: 2,
        isActive: true,
        createdByUserId,
      },
    });
  }

  /**
   * Create test standup config member
   */
  static async createTestStandupConfigMember(
    prisma: PrismaService,
    standupConfigId: string,
    teamMemberId: string,
    include = true,
    role?: string,
  ) {
    return prisma.standupConfigMember.create({
      data: {
        standupConfigId,
        teamMemberId,
        include,
        role,
      },
    });
  }

  /**
   * Create complete test setup with all entities
   */
  static async createCompleteTestSetup(prisma: PrismaService) {
    const { user, org } = await this.setupTestData(prisma);
    const integration = await this.createTestIntegration(prisma, org.id, user.id);
    const channel = await this.createTestChannel(prisma, integration.id);
    const integrationUser = await this.createTestIntegrationUser(prisma, integration.id);
    const team = await this.createTestTeam(prisma, org.id, integration.id, channel.id, user.id);
    const teamMember = await this.createTestTeamMember(
      prisma,
      team.id,
      integrationUser.id,
      user.id,
    );
    const standupConfig = await this.createTestStandupConfig(prisma, team.id, user.id);
    const configMember = await this.createTestStandupConfigMember(
      prisma,
      standupConfig.id,
      teamMember.id,
    );

    return {
      user,
      org,
      integration,
      channel,
      integrationUser,
      team,
      teamMember,
      standupConfig,
      configMember,
    };
  }

  /**
   * Count all records in database (useful for testing cleanup)
   */
  static async countAllRecords(prisma: PrismaService) {
    const counts = await Promise.all([
      prisma.user.count(),
      prisma.organization.count(),
      prisma.orgMember.count(),
      prisma.integration.count(),
      prisma.channel.count(),
      prisma.integrationUser.count(),
      prisma.team.count(),
      prisma.teamMember.count(),
      prisma.standupConfig.count(),
      prisma.standupConfigMember.count(),
      prisma.auditLog.count(),
    ]);

    return {
      users: counts[0],
      organizations: counts[1],
      orgMembers: counts[2],
      integrations: counts[3],
      channels: counts[4],
      integrationUsers: counts[5],
      teams: counts[6],
      teamMembers: counts[7],
      standupConfigs: counts[8],
      standupConfigMembers: counts[9],
      auditLogs: counts[10],
      total: counts.reduce((sum, count) => sum + count, 0),
    };
  }
}
