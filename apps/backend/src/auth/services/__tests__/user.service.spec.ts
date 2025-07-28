import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from '../user.service';
import { PrismaService } from '@/prisma/prisma.service';
import { UserUtilsService } from '../user-utils.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { OrgRole, OrgMemberStatus } from '@prisma/client';
import { createMockPrismaService } from '../../../../test/utils/mocks/prisma.mock';
import {
  createMockUserUtilsService,
  createMockAuditLogService,
} from '../../../../test/utils/mocks/services.mock';
import { TestHelpers } from '../../../../test/utils/test-helpers';
import { UserFixtures } from '../../../../test/utils/fixtures/users.fixture';

describe('UserService', () => {
  let service: UserService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;
  let mockUserUtils: ReturnType<typeof createMockUserUtilsService>;
  let mockAuditLog: ReturnType<typeof createMockAuditLogService>;

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();
    mockUserUtils = createMockUserUtilsService();
    mockAuditLog = createMockAuditLogService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: UserUtilsService, useValue: mockUserUtils },
        { provide: AuditLogService, useValue: mockAuditLog },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createUserWithOrganization', () => {
    it('should create user with hashed password', async () => {
      const options = {
        email: TestHelpers.generateRandomEmail(),
        name: 'Test User',
        password: 'TestPassword123!',
        orgId: TestHelpers.generateRandomString(),
        role: OrgRole.member,
        status: OrgMemberStatus.active,
      };

      const mockUser = TestHelpers.createMockUser({
        email: options.email,
        name: options.name,
      });

      mockUserUtils.hashPassword.mockResolvedValue('hashed_password_123');
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          user: { create: jest.fn().mockResolvedValue(mockUser) },
          orgMember: { create: jest.fn().mockResolvedValue({}) },
        });
      });

      const result = await service.createUserWithOrganization(options);

      expect(mockUserUtils.hashPassword).toHaveBeenCalledWith(options.password);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('should create temporary user for invites', async () => {
      const options = {
        email: TestHelpers.generateRandomEmail(),
        isTemporary: true,
        orgId: TestHelpers.generateRandomString(),
        role: OrgRole.member,
        status: OrgMemberStatus.invited,
      };

      const mockUser = TestHelpers.createMockUser({
        email: options.email,
        passwordHash: 'temp_hash',
      });

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          user: { create: jest.fn().mockResolvedValue(mockUser) },
          orgMember: { create: jest.fn().mockResolvedValue({}) },
        });
      });

      const result = await service.createUserWithOrganization(options);

      expect(mockUserUtils.hashPassword).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('should throw error when password missing for non-temporary users', async () => {
      const options = {
        email: TestHelpers.generateRandomEmail(),
        isTemporary: false,
        orgId: TestHelpers.generateRandomString(),
        role: OrgRole.member,
        status: OrgMemberStatus.active,
      };

      await expect(service.createUserWithOrganization(options)).rejects.toThrow(
        'Password is required for non-temporary users',
      );

      expect(mockUserUtils.hashPassword).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should create organization membership with correct data', async () => {
      const options = {
        email: TestHelpers.generateRandomEmail(),
        name: 'Test User',
        password: 'TestPassword123!',
        orgId: TestHelpers.generateRandomString(),
        role: OrgRole.admin,
        status: OrgMemberStatus.active,
        inviteToken: 'test_token',
        invitedAt: new Date(),
      };

      const mockUser = TestHelpers.createMockUser();
      const mockOrgMemberCreate = jest.fn().mockResolvedValue({});

      mockUserUtils.hashPassword.mockResolvedValue('hashed_password_123');
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          user: { create: jest.fn().mockResolvedValue(mockUser) },
          orgMember: { create: mockOrgMemberCreate },
        });
      });

      await service.createUserWithOrganization(options);

      expect(mockOrgMemberCreate).toHaveBeenCalledWith({
        data: {
          orgId: options.orgId,
          userId: mockUser.id,
          role: options.role,
          status: options.status,
          inviteToken: options.inviteToken,
          invitedAt: options.invitedAt,
        },
      });
    });
  });

  describe('createUserWithNewOrganization', () => {
    it('should create user and organization in transaction', async () => {
      const email = TestHelpers.generateRandomEmail();
      const password = 'TestPassword123!';
      const name = 'Test User';

      const mockUser = TestHelpers.createMockUser({ email, name });
      const mockOrg = TestHelpers.createMockOrganization();

      const mockUserCreate = jest.fn().mockResolvedValue(mockUser);
      const mockOrgCreate = jest.fn().mockResolvedValue(mockOrg);
      const mockOrgMemberCreate = jest.fn().mockResolvedValue({});

      mockUserUtils.hashPassword.mockResolvedValue('hashed_password_123');
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          user: { create: mockUserCreate },
          organization: { create: mockOrgCreate },
          orgMember: { create: mockOrgMemberCreate },
        });
      });

      const result = await service.createUserWithNewOrganization(email, password, name);

      expect(mockUserUtils.hashPassword).toHaveBeenCalledWith(password);
      expect(mockOrgCreate).toHaveBeenCalledWith({
        data: { name: `${name}'s Organization` },
      });
      expect(mockUserCreate).toHaveBeenCalledWith({
        data: { email, passwordHash: 'hashed_password_123', name },
      });
      expect(mockOrgMemberCreate).toHaveBeenCalledWith({
        data: {
          orgId: mockOrg.id,
          userId: mockUser.id,
          role: OrgRole.owner,
          status: OrgMemberStatus.active,
        },
      });
      expect(mockAuditLog.logWithTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.signup.self_service',
          actorUserId: mockUser.id,
          orgId: mockOrg.id,
        }),
        expect.any(Object),
      );
      expect(result).toEqual({ user: mockUser, org: mockOrg });
    });

    it('should create organization with custom name', async () => {
      const email = TestHelpers.generateRandomEmail();
      const password = 'TestPassword123!';
      const name = 'Test User';
      const orgName = 'Custom Organization Name';

      const mockOrg = TestHelpers.createMockOrganization({ name: orgName });
      const mockOrgCreate = jest.fn().mockResolvedValue(mockOrg);

      mockUserUtils.hashPassword.mockResolvedValue('hashed_password_123');
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          user: { create: jest.fn().mockResolvedValue(TestHelpers.createMockUser()) },
          organization: { create: mockOrgCreate },
          orgMember: { create: jest.fn().mockResolvedValue({}) },
        });
      });

      await service.createUserWithNewOrganization(email, password, name, orgName);

      expect(mockOrgCreate).toHaveBeenCalledWith({
        data: { name: orgName },
      });
    });

    it('should use email for organization name when name not provided', async () => {
      const email = 'test@example.com';
      const password = 'TestPassword123!';

      const mockOrg = TestHelpers.createMockOrganization();
      const mockOrgCreate = jest.fn().mockResolvedValue(mockOrg);

      mockUserUtils.hashPassword.mockResolvedValue('hashed_password_123');
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          user: { create: jest.fn().mockResolvedValue(TestHelpers.createMockUser()) },
          organization: { create: mockOrgCreate },
          orgMember: { create: jest.fn().mockResolvedValue({}) },
        });
      });

      await service.createUserWithNewOrganization(email, password);

      expect(mockOrgCreate).toHaveBeenCalledWith({
        data: { name: `${email}'s Organization` },
      });
    });
  });

  describe('addUserToOrganization', () => {
    it('should create user and add to existing organization', async () => {
      const email = TestHelpers.generateRandomEmail();
      const password = 'TestPassword123!';
      const name = 'Test User';
      const orgId = TestHelpers.generateRandomString();

      const mockUser = TestHelpers.createMockUser({ email, name });

      mockUserUtils.hashPassword.mockResolvedValue('hashed_password_123');
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.orgMember.create.mockResolvedValue({});

      const result = await service.addUserToOrganization(email, password, name, orgId);

      expect(mockUserUtils.hashPassword).toHaveBeenCalledWith(password);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: { email, passwordHash: 'hashed_password_123', name },
      });
      expect(mockPrisma.orgMember.create).toHaveBeenCalledWith({
        data: {
          orgId,
          userId: mockUser.id,
          role: OrgRole.member,
          status: OrgMemberStatus.active,
        },
      });
      expect(mockAuditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.signup.direct_join',
          actorUserId: mockUser.id,
          orgId,
        }),
      );
      expect(result).toEqual(mockUser);
    });

    it('should create user with custom role', async () => {
      const email = TestHelpers.generateRandomEmail();
      const password = 'TestPassword123!';
      const name = 'Test User';
      const orgId = TestHelpers.generateRandomString();
      const role = OrgRole.admin;

      const mockUser = TestHelpers.createMockUser({ email, name });

      mockUserUtils.hashPassword.mockResolvedValue('hashed_password_123');
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.orgMember.create.mockResolvedValue({});

      await service.addUserToOrganization(email, password, name, orgId, role);

      expect(mockPrisma.orgMember.create).toHaveBeenCalledWith({
        data: {
          orgId,
          userId: mockUser.id,
          role: OrgRole.admin,
          status: OrgMemberStatus.active,
        },
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle database transaction failures', async () => {
      const options = {
        email: TestHelpers.generateRandomEmail(),
        password: 'TestPassword123!',
        orgId: TestHelpers.generateRandomString(),
        role: OrgRole.member,
        status: OrgMemberStatus.active,
      };

      mockUserUtils.hashPassword.mockResolvedValue('hashed_password_123');
      mockPrisma.$transaction.mockRejectedValue(new Error('Database connection failed'));

      await expect(service.createUserWithOrganization(options)).rejects.toThrow(
        'Database connection failed',
      );

      expect(mockUserUtils.hashPassword).toHaveBeenCalled();
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should handle password hashing failures', async () => {
      const options = {
        email: TestHelpers.generateRandomEmail(),
        password: 'TestPassword123!',
        orgId: TestHelpers.generateRandomString(),
        role: OrgRole.member,
        status: OrgMemberStatus.active,
      };

      mockUserUtils.hashPassword.mockRejectedValue(new Error('Hashing failed'));

      await expect(service.createUserWithOrganization(options)).rejects.toThrow('Hashing failed');

      expect(mockUserUtils.hashPassword).toHaveBeenCalledWith(options.password);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
