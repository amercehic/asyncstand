import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from '../audit-log.service';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';
import { AuditSanitizer } from '../sanitizer';
import { OrgMemberStatus } from '@prisma/client';
import { AuditCategory, AuditSeverity, AuditActorType } from '../types';
import { createMockPrismaService } from '../../../../test/utils/mocks/prisma.mock';
import { TestHelpers } from '../../../../test/utils/test-helpers';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockSanitizer: jest.Mocked<AuditSanitizer>;

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();
    mockLogger = {
      setContext: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      logError: jest.fn(),
    } as any;
    mockSanitizer = {
      sanitize: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LoggerService, useValue: mockLogger },
        { provide: AuditSanitizer, useValue: mockSanitizer },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('should create audit log with provided orgId', async () => {
      const auditData = {
        orgId: TestHelpers.generateRandomString(),
        actorUserId: TestHelpers.generateRandomString(),
        action: 'user.create',
        category: AuditCategory.USER_MANAGEMENT,
        severity: AuditSeverity.LOW,
        actorType: AuditActorType.USER,
        requestData: {
          method: 'POST',
          path: '/test',
          ipAddress: '192.168.1.1',
        },
      };

      await service.log(auditData);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          orgId: auditData.orgId,
          actorUserId: auditData.actorUserId,
          actorType: auditData.actorType,
          action: auditData.action,
          category: auditData.category,
          severity: auditData.severity,
          requestData: auditData.requestData,
          responseData: undefined,
          resources: undefined,
          sessionId: undefined,
          correlationId: undefined,
          tags: [],
          executionTime: undefined,
        },
      });
      expect(mockLogger.debug).toHaveBeenCalledWith('Audit log created', expect.any(Object));
    });

    it('should resolve orgId from user membership when not provided', async () => {
      const userId = TestHelpers.generateRandomString();
      const orgId = TestHelpers.generateRandomString();
      const auditData = {
        actorUserId: userId,
        action: 'user.update',
        category: AuditCategory.USER_MANAGEMENT,
        severity: AuditSeverity.LOW,
        actorType: AuditActorType.USER,
        requestData: {
          method: 'PUT',
          path: '/user/update',
          ipAddress: '192.168.1.1',
        },
      };

      mockPrisma.orgMember.findFirst.mockResolvedValue({ orgId });

      await service.log(auditData);

      expect(mockPrisma.orgMember.findFirst).toHaveBeenCalledWith({
        where: {
          userId,
          status: OrgMemberStatus.active,
        },
        select: {
          orgId: true,
        },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ orgId }),
        }),
      );
    });

    it('should skip logging when user has no active organization', async () => {
      const userId = TestHelpers.generateRandomString();
      const auditData = {
        actorUserId: userId,
        action: 'user.update',
        category: AuditCategory.USER_MANAGEMENT,
        severity: AuditSeverity.LOW,
        actorType: AuditActorType.USER,
        requestData: {
          method: 'PUT',
          path: '/user/update',
          ipAddress: '192.168.1.1',
        },
      };

      mockPrisma.orgMember.findFirst.mockResolvedValue(null);

      await service.log(auditData);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No active organization found for user - skipping audit log',
        { userId, action: auditData.action },
      );
      expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('should skip logging when no orgId can be resolved', async () => {
      const auditData = {
        action: 'system.update',
        category: AuditCategory.SYSTEM,
        severity: AuditSeverity.LOW,
        actorType: AuditActorType.SYSTEM,
        requestData: {
          method: 'POST',
          path: '/system/update',
          ipAddress: '192.168.1.1',
        },
      };

      await service.log(auditData);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No orgId provided and unable to resolve - skipping audit log',
        { action: auditData.action, actorUserId: undefined },
      );
      expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const auditData = {
        orgId: TestHelpers.generateRandomString(),
        action: 'user.create',
        category: AuditCategory.USER_MANAGEMENT,
        severity: AuditSeverity.LOW,
        actorType: AuditActorType.USER,
        requestData: {
          method: 'POST',
          path: '/user/create',
          ipAddress: '192.168.1.1',
        },
      };

      const error = new Error('Database connection failed');
      mockPrisma.auditLog.create.mockRejectedValue(error);

      await service.log(auditData);

      expect(mockLogger.logError).toHaveBeenCalledWith(error, {
        context: 'audit log creation',
        action: auditData.action,
        actorUserId: undefined,
        orgId: auditData.orgId,
      });
    });
  });

  describe('logWithTransaction', () => {
    it('should create audit log within transaction', async () => {
      const mockTransaction = {
        auditLog: { create: jest.fn() },
        orgMember: { findFirst: jest.fn() },
      };
      const auditData = {
        orgId: TestHelpers.generateRandomString(),
        actorUserId: TestHelpers.generateRandomString(),
        action: 'user.create',
        category: AuditCategory.USER_MANAGEMENT,
        severity: AuditSeverity.LOW,
        actorType: AuditActorType.USER,
        requestData: {
          method: 'POST',
          path: '/user/create',
          ipAddress: '192.168.1.1',
        },
      };

      await service.logWithTransaction(auditData, mockTransaction);

      expect(mockTransaction.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orgId: auditData.orgId,
          action: auditData.action,
        }),
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Audit log created within transaction',
        expect.any(Object),
      );
    });
  });

  describe('findLogs', () => {
    it('should find logs with basic filter', async () => {
      const orgId = TestHelpers.generateRandomString();
      const mockLogs = [TestHelpers.createMockAuditLog()];
      const filter = { orgId, limit: 50, offset: 0 };

      mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const result = await service.findLogs(filter);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { orgId },
        include: {
          actorUser: {
            select: { id: true, email: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
      expect(result).toEqual({
        data: mockLogs,
        total: 1,
        limit: 50,
        offset: 0,
        hasMore: false,
      });
    });

    it('should apply filter options', async () => {
      const orgId = TestHelpers.generateRandomString();
      const userId = TestHelpers.generateRandomString();
      const filter = {
        orgId,
        actorUserId: userId,
        category: AuditCategory.USER_MANAGEMENT,
        severity: AuditSeverity.HIGH,
        action: 'create',
        limit: 25,
        offset: 10,
      };

      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.findLogs(filter);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          orgId,
          actorUserId: userId,
          category: AuditCategory.USER_MANAGEMENT,
          severity: AuditSeverity.HIGH,
          action: { contains: 'create', mode: 'insensitive' },
        },
        include: {
          actorUser: {
            select: { id: true, email: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 25,
        skip: 10,
      });
    });
  });

  describe('getActivitySummary', () => {
    it('should generate activity summary for day period', async () => {
      const orgId = TestHelpers.generateRandomString();
      const mockLogs = [
        {
          category: AuditCategory.USER_MANAGEMENT,
          severity: AuditSeverity.LOW,
          actorUserId: 'user1',
          actorUser: { id: 'user1', name: 'User One' },
        },
        {
          category: AuditCategory.AUTH,
          severity: AuditSeverity.HIGH,
          actorUserId: 'user1',
          actorUser: { id: 'user1', name: 'User One' },
        },
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs as any);

      const result = await service.getActivitySummary(orgId, 'day');

      expect(result).toEqual({
        totalEvents: 2,
        eventsByCategory: {
          [AuditCategory.USER_MANAGEMENT]: 1,
          [AuditCategory.AUTH]: 1,
        },
        eventsBySeverity: {
          [AuditSeverity.LOW]: 1,
          [AuditSeverity.HIGH]: 1,
        },
        topUsers: [
          {
            userId: 'user1',
            userName: 'User One',
            eventCount: 2,
          },
        ],
        timeRange: expect.objectContaining({
          from: expect.any(Date),
          to: expect.any(Date),
        }),
      });
    });
  });

  describe('exportLogs', () => {
    it('should export logs in JSON format', async () => {
      const orgId = TestHelpers.generateRandomString();
      const mockLogs = [TestHelpers.createMockAuditLog()];

      jest.spyOn(service, 'findByTimeRange').mockResolvedValue(mockLogs);

      const result = await service.exportLogs(orgId, 'json');

      expect(result).toBe(JSON.stringify(mockLogs, null, 2));
    });
  });

  describe('verifyIntegrity', () => {
    it('should verify log integrity by existence', async () => {
      const logId = TestHelpers.generateRandomString();
      const mockLog = TestHelpers.createMockAuditLog();

      mockPrisma.auditLog.findUnique.mockResolvedValue(mockLog);

      const result = await service.verifyIntegrity(logId);

      expect(mockPrisma.auditLog.findUnique).toHaveBeenCalledWith({
        where: { id: logId },
      });
      expect(result).toBe(true);
    });

    it('should return false for non-existent log', async () => {
      const logId = TestHelpers.generateRandomString();

      mockPrisma.auditLog.findUnique.mockResolvedValue(null);

      const result = await service.verifyIntegrity(logId);

      expect(result).toBe(false);
    });
  });
});
