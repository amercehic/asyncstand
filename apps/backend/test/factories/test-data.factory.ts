import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { hash } from '@node-rs/argon2';
import { DataIsolation } from '@/test/utils/isolation/data-isolation';

export interface TestUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  token?: string;
}

export interface TestOrganization {
  id: string;
  name: string;
}

export interface TestIntegration {
  id: string;
  orgId: string;
  externalTeamId: string;
  accessToken: string;
  botToken: string;
  botUserId: string;
}

/**
 * Factory for creating test data with proper isolation
 */
export class TestDataFactory {
  constructor(
    private prisma: PrismaClient,
    private isolation: DataIsolation,
    private jwtService?: JwtService,
  ) {}

  /**
   * Create a test user with optional organization membership
   */
  async createUser(
    options: {
      email?: string;
      name?: string;
      password?: string;
      orgId?: string;
      role?: 'owner' | 'admin' | 'member';
    } = {},
  ): Promise<TestUser> {
    const email = options.email || this.isolation.generateEmail();
    const name = options.name || this.isolation.prefix('Test User');
    const password = options.password || 'TestPassword123!';
    const passwordHash = await hash(password);

    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
      },
    });

    // Create org membership if orgId provided
    if (options.orgId) {
      await this.prisma.orgMember.create({
        data: {
          userId: user.id,
          orgId: options.orgId,
          role: options.role || 'member',
          status: 'active',
        },
      });
    }

    // Generate JWT token if service available
    let token: string | undefined;
    if (this.jwtService) {
      token = this.jwtService.sign({
        sub: user.id,
        email: user.email,
        orgId: options.orgId,
      });
    }

    return {
      id: user.id,
      email,
      name,
      passwordHash,
      token,
    };
  }

  /**
   * Create a test organization with an owner
   */
  async createOrganization(
    options: {
      name?: string;
      ownerEmail?: string;
      ownerPassword?: string;
    } = {},
  ): Promise<{
    org: TestOrganization;
    owner: TestUser;
    token: string;
  }> {
    const orgName = options.name || this.isolation.generateOrgName();

    // Create organization
    const org = await this.prisma.organization.create({
      data: {
        name: orgName,
      },
    });

    // Create owner user
    const owner = await this.createUser({
      email: options.ownerEmail || this.isolation.generateEmail('owner'),
      name: this.isolation.prefix('Owner'),
      password: options.ownerPassword || 'OwnerPassword123!',
      orgId: org.id,
      role: 'owner',
    });

    return {
      org: {
        id: org.id,
        name: orgName,
      },
      owner,
      token: owner.token!,
    };
  }

  /**
   * Create a complete organization with users
   */
  async createOrganizationWithUsers(): Promise<{
    org: TestOrganization;
    owner: TestUser;
    admin: TestUser;
    member: TestUser;
  }> {
    const { org, owner } = await this.createOrganization();

    const admin = await this.createUser({
      email: this.isolation.generateEmail('admin'),
      name: this.isolation.prefix('Admin User'),
      orgId: org.id,
      role: 'admin',
    });

    const member = await this.createUser({
      email: this.isolation.generateEmail('member'),
      name: this.isolation.prefix('Member User'),
      orgId: org.id,
      role: 'member',
    });

    return { org, owner, admin, member };
  }

  /**
   * Create a test Slack integration
   */
  async createSlackIntegration(orgId: string, userId: string): Promise<TestIntegration> {
    const integration = await this.prisma.integration.create({
      data: {
        orgId,
        platform: 'slack',
        externalTeamId: this.isolation.generateExternalId('T'),
        accessToken: this.isolation.prefix('xoxp-user-token'),
        botToken: this.isolation.prefix('xoxb-bot-token'),
        botUserId: this.isolation.generateExternalId('B'),
        appId: this.isolation.generateExternalId('A'),
        tokenStatus: 'ok',
        scopes: ['channels:read', 'users:read', 'chat:write'],
        userScopes: ['identity.basic'],
        installedByUserId: userId,
      },
    });

    return {
      id: integration.id,
      orgId,
      externalTeamId: integration.externalTeamId,
      accessToken: integration.accessToken!,
      botToken: integration.botToken!,
      botUserId: integration.botUserId!,
    };
  }

  /**
   * Create a test channel
   */
  async createChannel(
    integrationId: string,
    options: {
      channelId?: string;
      name?: string;
    } = {},
  ) {
    return this.prisma.channel.create({
      data: {
        integrationId,
        channelId: options.channelId || this.isolation.generateExternalId('C'),
        name: options.name || this.isolation.prefix('channel'),
        topic: 'Test channel topic',
        purpose: 'Test channel purpose',
        isPrivate: false,
        isArchived: false,
        memberCount: 5,
      },
    });
  }

  /**
   * Create a test integration user
   */
  async createIntegrationUser(
    integrationId: string,
    options: {
      externalUserId?: string;
      name?: string;
      email?: string;
    } = {},
  ) {
    return this.prisma.integrationUser.create({
      data: {
        integrationId,
        externalUserId: options.externalUserId || this.isolation.generateExternalId('U'),
        name: options.name || this.isolation.prefix('Slack User'),
        displayName: this.isolation.prefix('slack-user'),
        email: options.email || this.isolation.generateEmail('slack'),
        isBot: false,
        isDeleted: false,
        profileImage: 'https://example.com/avatar.jpg',
        timezone: 'America/New_York',
        platformData: {},
      },
    });
  }

  /**
   * Create a test team
   */
  async createTeam(
    orgId: string,
    integrationId: string,
    createdByUserId: string,
    options: {
      name?: string;
      timezone?: string;
    } = {},
  ) {
    return this.prisma.team.create({
      data: {
        orgId,
        integrationId,
        name: options.name || this.isolation.generateTeamName(),
        timezone: options.timezone || 'America/New_York',
        createdByUserId,
      },
    });
  }

  /**
   * Create a complete test setup with all entities
   */
  async createCompleteTestSetup() {
    const { org, owner, admin, member } = await this.createOrganizationWithUsers();
    const integration = await this.createSlackIntegration(org.id, owner.id);
    const channel = await this.createChannel(integration.id);
    const integrationUser = await this.createIntegrationUser(integration.id);
    const team = await this.createTeam(org.id, integration.id, owner.id);

    const teamMember = await this.prisma.teamMember.create({
      data: {
        teamId: team.id,
        platformUserId: integrationUser.externalUserId,
        name: integrationUser.name,
        active: true,
        addedByUserId: owner.id,
      },
    });

    return {
      org,
      owner,
      admin,
      member,
      integration,
      channel,
      integrationUser,
      team,
      teamMember,
    };
  }

  /**
   * Generate a JWT token for a user
   */
  generateToken(userId: string, email: string, orgId?: string): string {
    if (!this.jwtService) {
      throw new Error('JwtService not provided to factory');
    }

    return this.jwtService.sign({
      sub: userId,
      email,
      orgId,
    });
  }
}
