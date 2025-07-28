import { PrismaService } from '@/prisma/prisma.service';
import { OrgRole, OrgMemberStatus } from '@prisma/client';
import { TestHelpers } from './test-helpers';

export interface TestIds {
  userIds?: string[];
  orgIds?: string[];
  orgMemberIds?: string[];
  tokenIds?: string[];
}

export interface CreateTestUserOptions {
  email?: string;
  name?: string;
  passwordHash?: string;
  orgId?: string;
  role?: OrgRole;
  status?: OrgMemberStatus;
}

export interface CreateTestOrgOptions {
  name?: string;
  ownerId?: string;
}

export class DatabaseHelpers {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Clean up test data from database
   */
  async cleanupTestData(testIds: TestIds = {}): Promise<void> {
    const { userIds = [], orgIds = [], orgMemberIds = [], tokenIds = [] } = testIds;

    // Clean up in correct order due to foreign key constraints

    // 1. Clean up tokens
    if (tokenIds.length > 0) {
      await this.prisma.refreshToken.deleteMany({
        where: { id: { in: tokenIds } },
      });

      await this.prisma.passwordResetToken.deleteMany({
        where: { id: { in: tokenIds } },
      });
    }

    // 2. Clean up org members
    if (orgMemberIds.length > 0) {
      await this.prisma.orgMember.deleteMany({
        where: { id: { in: orgMemberIds } },
      });
    }

    // 3. Clean up audit logs
    if (orgIds.length > 0) {
      await this.prisma.auditLog.deleteMany({
        where: { orgId: { in: orgIds } },
      });
    }

    // 4. Clean up org members by user IDs
    if (userIds.length > 0) {
      await this.prisma.orgMember.deleteMany({
        where: { userId: { in: userIds } },
      });
    }

    // 5. Clean up org members by org IDs
    if (orgIds.length > 0) {
      await this.prisma.orgMember.deleteMany({
        where: { orgId: { in: orgIds } },
      });
    }

    // 6. Clean up users
    if (userIds.length > 0) {
      await this.prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }

    // 7. Clean up organizations
    if (orgIds.length > 0) {
      await this.prisma.organization.deleteMany({
        where: { id: { in: orgIds } },
      });
    }
  }

  /**
   * Clean up all test data by email patterns
   */
  async cleanupTestDataByEmail(emailPatterns: string[]): Promise<void> {
    for (const pattern of emailPatterns) {
      // Clean up org members first
      await this.prisma.orgMember.deleteMany({
        where: { user: { email: { contains: pattern } } },
      });

      // Clean up users
      await this.prisma.user.deleteMany({
        where: { email: { contains: pattern } },
      });
    }
  }

  /**
   * Create a test user with optional organization membership
   */
  async createTestUser(options: CreateTestUserOptions = {}): Promise<any> {
    const {
      email = TestHelpers.generateRandomEmail(),
      name = 'Test User',
      passwordHash = 'hashed_password_123',
      orgId,
      role = OrgRole.member,
      status = OrgMemberStatus.active,
    } = options;

    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
      },
    });

    // Create organization membership if orgId provided
    if (orgId) {
      await this.prisma.orgMember.create({
        data: {
          orgId,
          userId: user.id,
          role,
          status,
        },
      });
    }

    return user;
  }

  /**
   * Create a test organization with optional owner
   */
  async createTestOrganization(options: CreateTestOrgOptions = {}): Promise<any> {
    const { name = `Test Org ${TestHelpers.generateRandomSuffix()}`, ownerId } = options;

    const org = await this.prisma.organization.create({
      data: { name },
    });

    // Create owner membership if ownerId provided
    if (ownerId) {
      await this.prisma.orgMember.create({
        data: {
          orgId: org.id,
          userId: ownerId,
          role: OrgRole.owner,
          status: OrgMemberStatus.active,
        },
      });
    }

    return org;
  }

  /**
   * Create a complete test setup with user and organization
   */
  async createTestUserWithOrg(userOverrides: Partial<CreateTestUserOptions> = {}): Promise<{
    user: any;
    org: any;
    orgMember: any;
  }> {
    // Create organization first
    const org = await this.createTestOrganization();

    // Create user with org membership
    const user = await this.createTestUser({
      orgId: org.id,
      role: OrgRole.owner,
      ...userOverrides,
    });

    // Get the org member record
    const orgMember = await this.prisma.orgMember.findUnique({
      where: {
        orgId_userId: {
          orgId: org.id,
          userId: user.id,
        },
      },
    });

    return { user, org, orgMember };
  }

  /**
   * Create multiple test users for an organization
   */
  async createTestUsersForOrg(
    orgId: string,
    count: number,
    baseOptions: Partial<CreateTestUserOptions> = {},
  ): Promise<any[]> {
    const users = [];

    for (let i = 0; i < count; i++) {
      const user = await this.createTestUser({
        orgId,
        ...baseOptions,
        email: `testuser${i}-${TestHelpers.generateRandomSuffix()}@test.com`,
        name: `Test User ${i}`,
      });
      users.push(user);
    }

    return users;
  }

  /**
   * Verify database state for testing
   */
  async verifyUserExists(email: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    return !!user;
  }

  /**
   * Verify organization membership
   */
  async verifyOrgMembership(userId: string, orgId: string): Promise<boolean> {
    const membership = await this.prisma.orgMember.findUnique({
      where: {
        orgId_userId: {
          orgId,
          userId,
        },
      },
    });
    return !!membership;
  }

  /**
   * Get user with organization memberships
   */
  async getUserWithOrgs(userId: string): Promise<any> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        orgMembers: {
          include: { org: true },
        },
      },
    });
  }
}
