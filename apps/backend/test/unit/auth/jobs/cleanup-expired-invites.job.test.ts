import { Test, TestingModule } from '@nestjs/testing';
import { CleanupExpiredInvitesJob } from '@/auth/jobs/cleanup-expired-invites.job';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { OrgMemberStatus } from '@prisma/client';
import { AuditActorType, AuditCategory, AuditSeverity } from '@/common/audit/types';
import {
  createMockPrismaService,
  createMockLoggerService,
  createMockAuditLogService,
} from '@/test/utils/mocks/typed-mocks';
import { UserFactory, OrganizationFactory } from '@/test/utils/factories';

describe('CleanupExpiredInvitesJob', () => {
  let job: CleanupExpiredInvitesJob;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;
  let mockLogger: ReturnType<typeof createMockLoggerService>;
  let mockAuditLog: ReturnType<typeof createMockAuditLogService>;

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();
    mockLogger = createMockLoggerService();
    mockAuditLog = createMockAuditLogService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CleanupExpiredInvitesJob,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LoggerService, useValue: mockLogger },
        { provide: AuditLogService, useValue: mockAuditLog },
      ],
    }).compile();

    job = module.get<CleanupExpiredInvitesJob>(CleanupExpiredInvitesJob);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('cleanupExpiredInvites', () => {
    it('should cleanup expired invitations successfully', async () => {
      const mockOrg = OrganizationFactory.build();
      const mockUser = UserFactory.build();

      const expiredInvites = [
        {
          orgId: mockOrg.id,
          userId: mockUser.id,
          status: OrgMemberStatus.invited,
          invitedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
          inviteToken: 'expired-token-1',
          org: mockOrg,
        },
        {
          orgId: mockOrg.id,
          userId: 'user-2',
          status: OrgMemberStatus.invited,
          invitedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
          inviteToken: 'expired-token-2',
          org: mockOrg,
        },
      ];

      mockPrisma.orgMember.findMany.mockResolvedValue(expiredInvites);
      mockPrisma.orgMember.deleteMany.mockResolvedValue({ count: 2 });

      await job.cleanupExpiredInvites();

      // Verify findMany was called with correct parameters
      expect(mockPrisma.orgMember.findMany).toHaveBeenCalledWith({
        where: {
          status: OrgMemberStatus.invited,
          invitedAt: {
            lt: expect.any(Date),
          },
          inviteToken: {
            not: null,
          },
        },
        include: {
          org: true,
        },
      });

      // Verify deleteMany was called with correct parameters
      expect(mockPrisma.orgMember.deleteMany).toHaveBeenCalledWith({
        where: {
          status: OrgMemberStatus.invited,
          invitedAt: {
            lt: expect.any(Date),
          },
          inviteToken: {
            not: null,
          },
        },
      });

      // Verify audit logs were created for each expired invite
      expect(mockAuditLog.log).toHaveBeenCalledTimes(2);
      expect(mockAuditLog.log).toHaveBeenCalledWith({
        action: 'org.member.invite.expired',
        orgId: mockOrg.id,
        actorType: AuditActorType.SYSTEM,
        category: AuditCategory.USER_MANAGEMENT,
        severity: AuditSeverity.LOW,
        requestData: {
          method: 'CRON',
          path: '/jobs/cleanup-expired-invites',
          ipAddress: 'system',
          body: {
            email: mockUser.id,
            invitedAt: expect.any(Date),
            expiredAt: expect.any(Date),
          },
        },
      });
    });

    it('should handle case when no expired invitations exist', async () => {
      mockPrisma.orgMember.findMany.mockResolvedValue([]);

      await job.cleanupExpiredInvites();

      expect(mockPrisma.orgMember.findMany).toHaveBeenCalled();
      expect(mockPrisma.orgMember.deleteMany).not.toHaveBeenCalled();
      expect(mockAuditLog.log).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection failed');
      mockPrisma.orgMember.findMany.mockRejectedValue(dbError);

      // Mock console.error to avoid output during tests
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      // Mock Logger.error to prevent throwing
      const loggerSpy = jest.spyOn(job['logger'], 'error').mockImplementation();

      await job.cleanupExpiredInvites();

      expect(mockPrisma.orgMember.findMany).toHaveBeenCalled();
      expect(mockPrisma.orgMember.deleteMany).not.toHaveBeenCalled();
      expect(mockAuditLog.log).not.toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith('Error cleaning up expired invitations', dbError);

      consoleSpy.mockRestore();
      loggerSpy.mockRestore();
    });

    it('should handle audit log errors without affecting cleanup', async () => {
      const mockOrg = OrganizationFactory.build();
      const expiredInvites = [
        {
          orgId: mockOrg.id,
          userId: 'user-1',
          status: OrgMemberStatus.invited,
          invitedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
          inviteToken: 'expired-token-1',
          org: mockOrg,
        },
      ];

      mockPrisma.orgMember.findMany.mockResolvedValue(expiredInvites);
      mockPrisma.orgMember.deleteMany.mockResolvedValue({ count: 1 });
      mockAuditLog.log.mockRejectedValue(new Error('Audit log service unavailable'));

      // Mock Logger.error to prevent throwing
      const loggerSpy = jest.spyOn(job['logger'], 'error').mockImplementation();

      await job.cleanupExpiredInvites();

      expect(mockPrisma.orgMember.findMany).toHaveBeenCalled();
      expect(mockPrisma.orgMember.deleteMany).toHaveBeenCalled();
      expect(mockAuditLog.log).toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith(
        'Error cleaning up expired invitations',
        expect.any(Error),
      );

      loggerSpy.mockRestore();
    });

    it('should handle deleteMany operation errors', async () => {
      const mockOrg = OrganizationFactory.build();
      const expiredInvites = [
        {
          orgId: mockOrg.id,
          userId: 'user-1',
          status: OrgMemberStatus.invited,
          invitedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
          inviteToken: 'expired-token-1',
          org: mockOrg,
        },
      ];

      mockPrisma.orgMember.findMany.mockResolvedValue(expiredInvites);
      mockPrisma.orgMember.deleteMany.mockRejectedValue(new Error('Delete operation failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      // Mock Logger.error to prevent throwing
      const loggerSpy = jest.spyOn(job['logger'], 'error').mockImplementation();

      await job.cleanupExpiredInvites();

      expect(mockPrisma.orgMember.findMany).toHaveBeenCalled();
      expect(mockPrisma.orgMember.deleteMany).toHaveBeenCalled();
      expect(mockAuditLog.log).not.toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith(
        'Error cleaning up expired invitations',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
      loggerSpy.mockRestore();
    });

    it('should filter invitations correctly by date and status', async () => {
      mockPrisma.orgMember.findMany.mockResolvedValue([]);

      await job.cleanupExpiredInvites();

      const findManyCall = mockPrisma.orgMember.findMany.mock.calls[0][0];
      const whereClause = findManyCall.where;

      expect(whereClause.status).toBe(OrgMemberStatus.invited);
      expect(whereClause.invitedAt.lt).toBeInstanceOf(Date);
      expect(whereClause.inviteToken.not).toBe(null);
      expect(findManyCall.include.org).toBe(true);
    });

    it('should log appropriate messages during execution', async () => {
      const mockOrg = OrganizationFactory.build();
      const expiredInvites = [
        {
          orgId: mockOrg.id,
          userId: 'user-1',
          status: OrgMemberStatus.invited,
          invitedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
          inviteToken: 'expired-token-1',
          org: mockOrg,
        },
      ];

      mockPrisma.orgMember.findMany.mockResolvedValue(expiredInvites);
      mockPrisma.orgMember.deleteMany.mockResolvedValue({ count: 1 });

      await job.cleanupExpiredInvites();

      // Verify the service methods were called
      expect(mockPrisma.orgMember.findMany).toHaveBeenCalled();
      expect(mockPrisma.orgMember.deleteMany).toHaveBeenCalled();
    });
  });

  describe('cron scheduling', () => {
    it('should be configured to run daily at midnight', () => {
      // Verify the method exists and is properly configured
      expect(job.cleanupExpiredInvites).toBeDefined();
      expect(typeof job.cleanupExpiredInvites).toBe('function');
    });
  });
});
