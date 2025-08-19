import { Test, TestingModule } from '@nestjs/testing';
import { SlackIntegrationController } from '@/integrations/slack/slack-integration.controller';
import { PrismaService } from '@/prisma/prisma.service';
import { SlackApiService } from '@/integrations/slack/slack-api.service';
import { SlackMessagingService } from '@/integrations/slack/slack-messaging.service';
import { LoggerService } from '@/common/logger.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';

describe('SlackIntegrationController', () => {
  let controller: SlackIntegrationController;
  let mockPrismaService: jest.Mocked<PrismaService>;
  let mockSlackApiService: jest.Mocked<SlackApiService>;
  let mockSlackMessagingService: jest.Mocked<SlackMessagingService>;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockAuditLogService: jest.Mocked<AuditLogService>;

  const mockOrgId = 'org-123';
  const mockUserId = 'user-123';
  const mockIntegrationId = 'integration-123';
  const mockUser = { userId: mockUserId, orgId: mockOrgId, role: 'admin' };

  beforeEach(async () => {
    mockPrismaService = {
      integration: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
      integrationSyncState: {
        delete: jest.fn(),
      },
      answer: {
        deleteMany: jest.fn(),
      },
      participationSnapshot: {
        deleteMany: jest.fn(),
      },
      standupDigestPost: {
        deleteMany: jest.fn(),
      },
      standupInstance: {
        deleteMany: jest.fn(),
      },
      standupConfigMember: {
        deleteMany: jest.fn(),
      },
      standupConfig: {
        deleteMany: jest.fn(),
      },
      teamMember: {
        deleteMany: jest.fn(),
      },
      team: {
        deleteMany: jest.fn(),
      },
      tokenRefreshJob: {
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(),
    } as unknown as jest.Mocked<PrismaService>;

    mockSlackApiService = {
      syncWorkspaceData: jest.fn(),
    } as unknown as jest.Mocked<SlackApiService>;

    mockSlackMessagingService = {
      sendDirectMessage: jest.fn(),
    } as unknown as jest.Mocked<SlackMessagingService>;

    mockLoggerService = {
      setContext: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;

    mockAuditLogService = {
      log: jest.fn(),
    } as unknown as jest.Mocked<AuditLogService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SlackIntegrationController],
      providers: [
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: SlackApiService, useValue: mockSlackApiService },
        { provide: SlackMessagingService, useValue: mockSlackMessagingService },
        { provide: LoggerService, useValue: mockLoggerService },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<SlackIntegrationController>(SlackIntegrationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listIntegrations', () => {
    it('should return list of Slack integrations', async () => {
      const mockIntegrations = [
        {
          id: 'integration1',
          externalTeamId: 'slack-team-1',
          tokenStatus: 'ok',
          scopes: ['channels:read', 'users:read'],
          syncState: null,
          channels: [{ id: 'channel1' }],
          integrationUsers: [{ id: 'user1' }],
        },
      ];
      (mockPrismaService.integration.findMany as jest.Mock).mockResolvedValue(mockIntegrations);

      const result = await controller.listIntegrations(mockOrgId);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'integration1',
        externalTeamId: 'slack-team-1',
        tokenStatus: 'ok',
        scopes: ['channels:read', 'users:read'],
        installedAt: expect.any(String),
        syncState: {
          userCount: 1,
          channelCount: 1,
        },
      });
      expect(mockPrismaService.integration.findMany).toHaveBeenCalledWith({
        where: {
          orgId: mockOrgId,
          platform: 'slack',
        },
        include: expect.any(Object),
        orderBy: [{ id: 'desc' }],
      });
    });
  });

  describe('triggerSync', () => {
    it('should trigger sync for Slack integration', async () => {
      const mockIntegration = {
        id: mockIntegrationId,
        orgId: mockOrgId,
        platform: 'slack',
        tokenStatus: 'ok',
      };
      const mockSyncResult = {
        usersAdded: 2,
        usersUpdated: 1,
        channelsAdded: 3,
        channelsUpdated: 0,
        errors: [],
      };

      (mockPrismaService.integration.findUnique as jest.Mock).mockResolvedValue(mockIntegration);
      mockSlackApiService.syncWorkspaceData.mockResolvedValue(mockSyncResult);
      mockAuditLogService.log.mockResolvedValue(undefined);

      const result = await controller.triggerSync(mockIntegrationId, mockOrgId, mockUser);

      expect(result).toEqual({
        success: true,
        ...mockSyncResult,
      });
      expect(mockSlackApiService.syncWorkspaceData).toHaveBeenCalledWith(mockIntegrationId);
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'integration.slack.manual_sync_triggered',
          orgId: mockOrgId,
          actorUserId: mockUserId,
        }),
      );
    });

    it('should throw error for invalid token status', async () => {
      const mockIntegration = {
        id: mockIntegrationId,
        orgId: mockOrgId,
        platform: 'slack',
        tokenStatus: 'expired',
      };
      (mockPrismaService.integration.findUnique as jest.Mock).mockResolvedValue(mockIntegration);

      await expect(controller.triggerSync(mockIntegrationId, mockOrgId, mockUser)).rejects.toThrow(
        'Integration token is not valid',
      );
    });
  });

  describe('removeIntegration', () => {
    it('should remove Slack integration', async () => {
      const mockIntegration = {
        id: mockIntegrationId,
        orgId: mockOrgId,
        platform: 'slack',
        teams: [
          {
            id: 'team1',
            configs: [{ id: 'config1' }],
            instances: [{ id: 'instance1' }],
          },
        ],
        syncState: { id: 'sync-state-1' },
      };

      (mockPrismaService.integration.findUnique as jest.Mock).mockResolvedValue(mockIntegration);
      (mockPrismaService.$transaction as jest.Mock).mockImplementation((callback) =>
        callback(mockPrismaService),
      );
      mockAuditLogService.log.mockResolvedValue(undefined);

      const result = await controller.removeIntegration(mockIntegrationId, mockOrgId, mockUser);

      expect(result).toEqual({ success: true });
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'integration.slack.removed',
          orgId: mockOrgId,
          actorUserId: mockUserId,
        }),
      );
    });

    it('should throw error for non-existent integration', async () => {
      (mockPrismaService.integration.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        controller.removeIntegration(mockIntegrationId, mockOrgId, mockUser),
      ).rejects.toThrow('Integration not found');
    });
  });

  describe('testDirectMessage', () => {
    it('should send test direct message', async () => {
      const mockIntegration = {
        id: mockIntegrationId,
        teams: [
          {
            id: 'team1',
            name: 'Test Team',
            members: [
              {
                id: 'member1',
                name: 'Test User',
                platformUserId: 'slack-user-1',
                active: true,
              },
            ],
          },
        ],
      };
      const mockMessageResult = { ok: true, ts: 'message-ts-123' };

      (mockPrismaService.integration.findFirst as jest.Mock).mockResolvedValue(mockIntegration);
      mockSlackMessagingService.sendDirectMessage.mockResolvedValue(mockMessageResult);

      const result = await controller.testDirectMessage(mockIntegrationId, mockOrgId, mockUser);

      expect(result).toEqual({
        success: true,
        error: undefined,
        details: {
          memberId: 'member1',
          memberName: 'Test User',
          platformUserId: 'slack-user-1',
          teamName: 'Test Team',
          messageTs: 'message-ts-123',
        },
      });
      expect(mockSlackMessagingService.sendDirectMessage).toHaveBeenCalledWith(
        mockIntegrationId,
        'slack-user-1',
        expect.stringContaining('Test message from AsyncStand!'),
      );
    });

    it('should handle no active team members found', async () => {
      const mockIntegration = {
        id: mockIntegrationId,
        teams: [
          {
            id: 'team1',
            name: 'Test Team',
            members: [],
          },
        ],
      };
      (mockPrismaService.integration.findFirst as jest.Mock).mockResolvedValue(mockIntegration);

      const result = await controller.testDirectMessage(mockIntegrationId, mockOrgId, mockUser);

      expect(result).toEqual({
        success: false,
        error: 'No active team members found',
      });
    });
  });
});
