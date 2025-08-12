import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { StandupConfigService } from '@/standups/standup-config.service';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { LoggerService } from '@/common/logger.service';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { createMockPrismaService } from '@/test/utils/mocks/prisma.mock';
import {
  createMockLoggerService,
  createMockAuditLogService,
} from '@/test/utils/mocks/services.mock';
import { StandupConfigFactory } from '@/test/utils/factories/standup-config.factory';
import { TeamFactory } from '@/test/utils/factories/team.factory';
import { TestHelpers } from '@/test/utils/test-helpers';
import { Prisma } from '@prisma/client';

describe('StandupConfigService', () => {
  let service: StandupConfigService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;
  let mockAuditLog: ReturnType<typeof createMockAuditLogService>;
  let mockLogger: ReturnType<typeof createMockLoggerService>;

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();
    mockAuditLog = createMockAuditLogService();
    mockLogger = createMockLoggerService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StandupConfigService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLogService, useValue: mockAuditLog },
        { provide: LoggerService, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<StandupConfigService>(StandupConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createStandupConfig', () => {
    const mockTeamId = TestHelpers.generateRandomString();
    const mockOrgId = TestHelpers.generateRandomString();
    const mockUserId = TestHelpers.generateRandomString();
    const mockCreateDto = StandupConfigFactory.createMockCreateStandupConfigDto();

    it('should successfully create standup config', async () => {
      const mockTeam = TeamFactory.createMockTeam({
        id: mockTeamId,
        orgId: mockOrgId,
      });
      const mockConfig = StandupConfigFactory.createMockStandupConfig({
        teamId: mockTeamId,
        createdByUserId: mockUserId,
      });

      // Mock team with channel
      mockPrisma.team.findFirst.mockResolvedValue({
        ...mockTeam,
        members: [],
        channel: { id: 'channel-id', name: 'test-channel' },
      });
      mockPrisma.standupConfig.findFirst.mockResolvedValue(null);
      mockPrisma.standupConfig.findMany.mockResolvedValue([]); // No existing configs for time conflict check

      // Mock the transaction
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const txMock = {
          standupConfig: {
            create: jest.fn().mockResolvedValue(mockConfig),
          },
          standupConfigMember: {
            createMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
        };
        return callback(txMock as unknown as Prisma.TransactionClient);
      });

      const result = await service.createStandupConfig(
        mockTeamId,
        mockOrgId,
        mockUserId,
        mockCreateDto,
      );

      expect(mockPrisma.team.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockTeamId,
          orgId: mockOrgId,
        },
        include: {
          members: {
            where: { active: true },
            include: {
              user: true,
              integrationUser: true,
            },
          },
          channel: true,
        },
      });

      expect(result).toEqual({ id: mockConfig.id });
    });

    it('should throw error if team not found', async () => {
      mockPrisma.team.findFirst.mockResolvedValue(null);

      await expect(
        service.createStandupConfig(mockTeamId, mockOrgId, mockUserId, mockCreateDto),
      ).rejects.toThrow(
        new ApiError(
          ErrorCode.NOT_FOUND,
          'Team not found or does not belong to organization',
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should throw error if standup config with same name already exists', async () => {
      const mockTeam = TeamFactory.createMockTeam({
        id: mockTeamId,
        orgId: mockOrgId,
      });
      const existingConfig = StandupConfigFactory.createMockStandupConfig({
        teamId: mockTeamId,
        name: mockCreateDto.name, // Same name as new config
      });

      mockPrisma.team.findFirst.mockResolvedValue({
        ...mockTeam,
        members: [],
        channel: { id: 'channel-id', name: 'test-channel' },
      });
      mockPrisma.standupConfig.findFirst.mockResolvedValue(existingConfig);

      await expect(
        service.createStandupConfig(mockTeamId, mockOrgId, mockUserId, mockCreateDto),
      ).rejects.toThrow(
        new ApiError(
          ErrorCode.STANDUP_CONFIG_ALREADY_EXISTS,
          `A standup configuration with name "${mockCreateDto.name}" already exists for this team`,
          HttpStatus.CONFLICT,
        ),
      );
    });
  });

  describe('updateStandupConfig', () => {
    const mockTeamId = TestHelpers.generateRandomString();
    const mockOrgId = TestHelpers.generateRandomString();
    const mockUpdateDto = StandupConfigFactory.createMockUpdateStandupConfigDto();

    it('should successfully update standup config', async () => {
      const mockTeam = TeamFactory.createMockTeam({
        id: mockTeamId,
        orgId: mockOrgId,
      });
      const mockConfig = StandupConfigFactory.createMockStandupConfig({
        teamId: mockTeamId,
      });

      mockPrisma.team.findFirst.mockResolvedValue(mockTeam);
      // First call: find the existing config, second call: check for name conflicts (should be null)
      mockPrisma.standupConfig.findFirst
        .mockResolvedValueOnce(mockConfig) // Find existing config
        .mockResolvedValueOnce(null); // No name conflict
      mockPrisma.standupConfig.update.mockResolvedValue({
        ...mockConfig,
        ...mockUpdateDto,
      });

      await service.updateStandupConfig(mockTeamId, mockOrgId, mockUpdateDto);

      expect(mockPrisma.standupConfig.update).toHaveBeenCalledWith({
        where: { id: expect.any(String) },
        data: mockUpdateDto,
      });
    });

    it('should throw error if config not found', async () => {
      mockPrisma.standupConfig.findFirst.mockResolvedValue(null);

      await expect(
        service.updateStandupConfig(mockTeamId, mockOrgId, mockUpdateDto),
      ).rejects.toThrow(
        new ApiError(
          ErrorCode.STANDUP_CONFIG_NOT_FOUND,
          'Standup configuration not found',
          HttpStatus.NOT_FOUND,
        ),
      );
    });
  });

  describe('getStandupConfig', () => {
    const mockTeamId = TestHelpers.generateRandomString();
    const mockOrgId = TestHelpers.generateRandomString();

    it('should return standup config with member participation', async () => {
      const mockTeam = TeamFactory.createMockTeam({
        id: mockTeamId,
        orgId: mockOrgId,
      });
      const mockConfigWithMembers = StandupConfigFactory.createMockStandupConfigWithMembers(5);
      // Add required team relation to the config
      (
        mockConfigWithMembers as unknown as {
          team: { id: string; name: string; channel: { name: string } };
        }
      ).team = {
        id: mockTeam.id,
        name: mockTeam.name,
        channel: { name: 'test-channel' },
      };

      mockPrisma.team.findFirst.mockResolvedValue(mockTeam);
      mockPrisma.standupConfig.findFirst.mockResolvedValue(mockConfigWithMembers);

      const result = await service.getStandupConfig(mockTeamId, mockOrgId);

      expect(mockPrisma.standupConfig.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            teamId: mockTeamId,
            team: { orgId: mockOrgId },
          },
          include: expect.any(Object),
        }),
      );

      expect(result).toEqual(
        expect.objectContaining({
          id: mockConfigWithMembers.id,
          questions: mockConfigWithMembers.questions,
          weekdays: mockConfigWithMembers.weekdays,
        }),
      );
    });
  });

  describe('deleteStandupConfig', () => {
    const mockTeamId = TestHelpers.generateRandomString();
    const mockOrgId = TestHelpers.generateRandomString();

    it('should successfully delete standup config', async () => {
      const mockTeam = TeamFactory.createMockTeam({
        id: mockTeamId,
        orgId: mockOrgId,
      });
      const mockConfig = StandupConfigFactory.createMockStandupConfig({
        teamId: mockTeamId,
      });

      mockPrisma.team.findFirst.mockResolvedValue(mockTeam);
      mockPrisma.standupConfig.findFirst.mockResolvedValue(mockConfig);
      mockPrisma.standupConfig.delete.mockResolvedValue(mockConfig);

      await service.deleteStandupConfig(mockTeamId, mockOrgId);

      expect(mockPrisma.standupConfig.delete).toHaveBeenCalledWith({
        where: { id: mockConfig.id },
      });
    });
  });

  describe('error handling', () => {
    it('should handle database errors during config creation', async () => {
      const mockTeamId = TestHelpers.generateRandomString();
      const mockOrgId = TestHelpers.generateRandomString();
      const mockUserId = TestHelpers.generateRandomString();
      const mockCreateDto = StandupConfigFactory.createMockCreateStandupConfigDto();
      const mockTeam = TeamFactory.createMockTeam();

      mockPrisma.team.findFirst.mockResolvedValue({
        ...mockTeam,
        members: [],
        channel: { id: 'channel-id', name: 'test-channel' },
      });
      mockPrisma.standupConfig.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockRejectedValue(new Error('Database connection error'));

      await expect(
        service.createStandupConfig(mockTeamId, mockOrgId, mockUserId, mockCreateDto),
      ).rejects.toThrow('Database connection error');
    });
  });
});
