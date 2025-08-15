import { Test, TestingModule } from '@nestjs/testing';
import { TeamManagementService } from '@/teams/team-management.service';
import { PrismaService } from '@/prisma/prisma.service';
import { SlackApiService } from '@/integrations/slack/slack-api.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { LoggerService } from '@/common/logger.service';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { TeamFactory, IntegrationFactory } from '@/test/utils/factories';
import { CreateTeamDto } from '@/teams/dto/create-team.dto';
import { UpdateTeamDto } from '@/teams/dto/update-team.dto';
import { createMockPrismaService, MockPrismaService } from '@/test/utils/mocks/prisma.mock';
import {
  Integration,
  Channel,
  Team,
  TeamMember,
  StandupConfig,
  IntegrationUser,
} from '@prisma/client';

describe('TeamManagementService', () => {
  let service: TeamManagementService;
  let mockPrisma: MockPrismaService;
  let mockSlackApiService: jest.Mocked<SlackApiService>;
  let mockAuditLogService: jest.Mocked<AuditLogService>;

  const mockOrgId = 'org-123';
  const mockUserId = 'user-123';
  const mockIntegrationId = 'integration-123';
  const mockChannelId = 'C1234567890';
  const mockTeamId = 'team-123';

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();

    const mockSlackApiServiceMethods = {
      callSlackApi: jest.fn(),
    };

    const mockAuditLogServiceMethods = {
      log: jest.fn(),
    };

    const mockLoggerServiceMethods = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamManagementService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: SlackApiService,
          useValue: mockSlackApiServiceMethods,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogServiceMethods,
        },
        {
          provide: LoggerService,
          useValue: mockLoggerServiceMethods,
        },
      ],
    }).compile();

    service = module.get<TeamManagementService>(TeamManagementService);
    mockSlackApiService = module.get(SlackApiService);
    mockAuditLogService = module.get(AuditLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTeam', () => {
    const createTeamDto: CreateTeamDto = TeamFactory.createMockCreateTeamDto({
      name: 'Test Team',
      integrationId: mockIntegrationId,
      channelId: mockChannelId,
      timezone: 'America/New_York',
    });

    const mockIntegration = IntegrationFactory.createMockIntegration({
      id: mockIntegrationId,
      orgId: mockOrgId,
    });

    const mockChannel = IntegrationFactory.createMockSlackChannel({
      id: 'channel-db-id',
      integrationId: mockIntegrationId,
      channelId: mockChannelId,
    });

    beforeEach(() => {
      mockPrisma.integration.findUnique.mockResolvedValue(mockIntegration as Integration);
      mockPrisma.team.findFirst.mockResolvedValue(null); // No existing team
      mockPrisma.channel.findUnique.mockResolvedValue(mockChannel as Channel);
      mockAuditLogService.log.mockResolvedValue(undefined);

      // Mock channel validation success
      (mockSlackApiService as unknown as { callSlackApi: jest.Mock }).callSlackApi = jest
        .fn()
        .mockResolvedValue({
          channel: { name: 'test-channel' },
        });
    });

    it('should successfully create a team', async () => {
      const newTeam = { id: mockTeamId };
      mockPrisma.team.create.mockResolvedValue(newTeam as Team);

      const result = await service.createTeam(mockOrgId, mockUserId, createTeamDto);

      expect(result).toEqual({ id: mockTeamId });
      expect(mockPrisma.integration.findUnique).toHaveBeenCalledWith({
        where: { id: mockIntegrationId },
      });
      expect(mockPrisma.team.findFirst).toHaveBeenCalledWith({
        where: { orgId: mockOrgId, name: createTeamDto.name },
      });
      expect(mockPrisma.team.create).toHaveBeenCalledWith({
        data: {
          orgId: mockOrgId,
          integrationId: mockIntegrationId,
          channelId: mockChannel.id,
          slackChannelId: mockChannelId,
          name: createTeamDto.name,
          timezone: createTeamDto.timezone,
          createdByUserId: mockUserId,
        },
      });
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'team.created',
          orgId: mockOrgId,
          actorUserId: mockUserId,
        }),
      );
    });

    it('should throw error when integration not found', async () => {
      mockPrisma.integration.findUnique.mockResolvedValue(null);

      await expect(service.createTeam(mockOrgId, mockUserId, createTeamDto)).rejects.toThrow(
        new ApiError(
          ErrorCode.NOT_FOUND,
          'Integration not found or does not belong to organization',
          404,
        ),
      );
    });

    it('should throw error when integration belongs to different organization', async () => {
      const wrongOrgIntegration = { ...mockIntegration, orgId: 'wrong-org' };
      mockPrisma.integration.findUnique.mockResolvedValue(wrongOrgIntegration as Integration);

      await expect(service.createTeam(mockOrgId, mockUserId, createTeamDto)).rejects.toThrow(
        new ApiError(
          ErrorCode.NOT_FOUND,
          'Integration not found or does not belong to organization',
          404,
        ),
      );
    });

    it('should throw error when team name already exists', async () => {
      const existingTeam = { id: 'existing-team-id', name: createTeamDto.name };
      mockPrisma.team.findFirst.mockResolvedValue(existingTeam as Team);

      await expect(service.createTeam(mockOrgId, mockUserId, createTeamDto)).rejects.toThrow(
        new ApiError(ErrorCode.CONFLICT, 'Team name already exists in organization', 409),
      );
    });

    it('should throw error when channel is already assigned to another team', async () => {
      // Team name check passes
      mockPrisma.team.findFirst
        .mockResolvedValueOnce(null) // No existing team name
        .mockResolvedValueOnce({ id: 'other-team' } as Team); // Channel already assigned

      await expect(service.createTeam(mockOrgId, mockUserId, createTeamDto)).rejects.toThrow(
        new ApiError(ErrorCode.CONFLICT, 'Channel is already assigned to another team', 409),
      );
    });

    it('should throw error when channel not found in database', async () => {
      mockPrisma.channel.findUnique.mockResolvedValue(null);

      await expect(service.createTeam(mockOrgId, mockUserId, createTeamDto)).rejects.toThrow(
        new ApiError(
          ErrorCode.NOT_FOUND,
          'Channel not found. Please sync the workspace first.',
          404,
        ),
      );
    });

    it('should throw error when channel validation fails', async () => {
      // Enable channel validation for this test
      const originalEnv = process.env.ENABLE_CHANNEL_VALIDATION;
      process.env.ENABLE_CHANNEL_VALIDATION = 'true';

      try {
        (mockSlackApiService as unknown as { callSlackApi: jest.Mock }).callSlackApi = jest
          .fn()
          .mockRejectedValue(new Error('Bot not in channel'));

        await expect(service.createTeam(mockOrgId, mockUserId, createTeamDto)).rejects.toThrow(
          new ApiError(
            ErrorCode.EXTERNAL_SERVICE_ERROR,
            'Bot does not have access to this channel or channel does not exist',
            400,
          ),
        );
      } finally {
        // Restore original environment
        if (originalEnv !== undefined) {
          process.env.ENABLE_CHANNEL_VALIDATION = originalEnv;
        } else {
          delete process.env.ENABLE_CHANNEL_VALIDATION;
        }
      }
    });
  });

  describe('updateTeam', () => {
    const updateTeamDto: UpdateTeamDto = {
      name: 'Updated Team Name',
      timezone: 'America/Los_Angeles',
    };

    const mockTeam = TeamFactory.createMockTeam({
      id: mockTeamId,
      orgId: mockOrgId,
      name: 'Original Team',
      integrationId: mockIntegrationId,
      slackChannelId: 'C9876543210',
    });

    beforeEach(() => {
      mockPrisma.team.findUnique.mockResolvedValue(mockTeam as Team);
      mockPrisma.team.update.mockResolvedValue({} as Team);
    });

    it('should successfully update team name and timezone', async () => {
      mockPrisma.team.findFirst.mockResolvedValue(null); // No name conflict

      await service.updateTeam(mockTeamId, mockOrgId, updateTeamDto);

      expect(mockPrisma.team.update).toHaveBeenCalledWith({
        where: { id: mockTeamId },
        data: {
          name: updateTeamDto.name,
          timezone: updateTeamDto.timezone,
        },
      });
    });

    it('should throw error when team not found', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(null);

      await expect(service.updateTeam(mockTeamId, mockOrgId, updateTeamDto)).rejects.toThrow(
        new ApiError(ErrorCode.NOT_FOUND, 'Team not found', 404),
      );
    });

    it('should throw error when team belongs to different organization', async () => {
      const wrongOrgTeam = { ...mockTeam, orgId: 'wrong-org' };
      mockPrisma.team.findUnique.mockResolvedValue(wrongOrgTeam as Team);

      await expect(service.updateTeam(mockTeamId, mockOrgId, updateTeamDto)).rejects.toThrow(
        new ApiError(ErrorCode.NOT_FOUND, 'Team not found', 404),
      );
    });

    it('should throw error when new team name conflicts with existing team', async () => {
      const conflictingTeam = { id: 'other-team', name: updateTeamDto.name };
      mockPrisma.team.findFirst.mockResolvedValue(conflictingTeam as Team);

      await expect(service.updateTeam(mockTeamId, mockOrgId, updateTeamDto)).rejects.toThrow(
        new ApiError(ErrorCode.CONFLICT, 'Team name already exists in organization', 409),
      );
    });

    it('should handle channel update when channelId is provided', async () => {
      const updateWithChannel = {
        ...updateTeamDto,
        channelId: 'C1111111111',
        integrationId: mockIntegrationId,
      };

      const newChannel = IntegrationFactory.createMockSlackChannel({
        id: 'new-channel-db-id',
        channelId: 'C1111111111',
      });

      mockPrisma.team.findFirst.mockResolvedValue(null); // No conflicts
      mockPrisma.channel.findUnique.mockResolvedValue(newChannel as Channel);
      (mockSlackApiService as unknown as { callSlackApi: jest.Mock }).callSlackApi = jest
        .fn()
        .mockResolvedValue({
          channel: { name: 'new-channel' },
        });

      await service.updateTeam(mockTeamId, mockOrgId, updateWithChannel);

      expect(mockPrisma.team.update).toHaveBeenCalledWith({
        where: { id: mockTeamId },
        data: {
          name: 'Updated Team Name',
          timezone: 'America/Los_Angeles',
          integrationId: 'integration-123',
          channelId: newChannel.id,
          slackChannelId: 'C1111111111',
        },
      });
    });
  });

  describe('deleteTeam', () => {
    const mockTeamWithRelations = {
      ...TeamFactory.createMockTeam({ id: mockTeamId, orgId: mockOrgId }),
      members: [{ id: 'member1' }, { id: 'member2' }],
      configs: [{ id: 'config1' }],
      instances: [{ id: 'instance1' }],
    };

    it('should successfully delete team and all related data', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(
        mockTeamWithRelations as unknown as Team & {
          members: TeamMember[];
          configs: StandupConfig[];
        },
      );

      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        const tx = {
          answer: { deleteMany: jest.fn() },
          participationSnapshot: { deleteMany: jest.fn() },
          standupDigestPost: { deleteMany: jest.fn() },
          standupInstance: { deleteMany: jest.fn() },
          standupConfigMember: { deleteMany: jest.fn() },
          standupConfig: { deleteMany: jest.fn() },
          teamMember: { deleteMany: jest.fn() },
          team: { delete: jest.fn() },
        };
        await callback(tx);
      });

      mockPrisma.$transaction.mockImplementation(mockTransaction);

      await service.deleteTeam(mockTeamId, mockOrgId);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw error when team not found', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(null);

      await expect(service.deleteTeam(mockTeamId, mockOrgId)).rejects.toThrow(
        new ApiError(ErrorCode.NOT_FOUND, 'Team not found', 404),
      );
    });

    it('should throw error when team belongs to different organization', async () => {
      const wrongOrgTeam = { ...mockTeamWithRelations, orgId: 'wrong-org' };
      mockPrisma.team.findUnique.mockResolvedValue(
        wrongOrgTeam as unknown as Team & { members: TeamMember[]; configs: StandupConfig[] },
      );

      await expect(service.deleteTeam(mockTeamId, mockOrgId)).rejects.toThrow(
        new ApiError(ErrorCode.NOT_FOUND, 'Team not found', 404),
      );
    });
  });

  describe('listTeams', () => {
    it('should return list of teams with member counts', async () => {
      const mockTeams = [
        {
          id: 'team1',
          name: 'Team 1',
          channelId: 'channel1',
          _count: { members: 5 },
          configs: [{ id: 'config1' }],
          createdBy: { name: 'John Doe' },
          createdAt: new Date(),
        },
        {
          id: 'team2',
          name: 'Team 2',
          channelId: 'channel2',
          _count: { members: 3 },
          configs: [],
          createdBy: null,
          createdAt: new Date(),
        },
      ];

      mockPrisma.team.findMany.mockResolvedValue(
        mockTeams as unknown as (Team & {
          _count: { members: number };
          configs: StandupConfig[];
          createdBy: { name: string } | null;
          createdAt: Date;
        })[],
      );

      const result = await service.listTeams(mockOrgId);

      expect(result.teams).toHaveLength(2);
      expect(result.teams[0]).toEqual({
        id: 'team1',
        name: 'Team 1',
        channelName: 'channel1',
        channel: null,
        memberCount: 5,
        hasStandupConfig: true,
        createdAt: mockTeams[0].createdAt,
        createdBy: { name: 'John Doe' },
      });
      expect(result.teams[1]).toEqual({
        id: 'team2',
        name: 'Team 2',
        channelName: 'channel2',
        channel: null,
        memberCount: 3,
        hasStandupConfig: false,
        createdAt: mockTeams[1].createdAt,
        createdBy: { name: 'System' },
      });
    });
  });

  describe('getTeamDetails', () => {
    const mockTeamDetails = {
      id: mockTeamId,
      name: 'Test Team',
      timezone: 'America/New_York',
      orgId: mockOrgId,
      channelId: 'channel-db-id',
      integration: { externalTeamId: 'T1234567890' },
      members: [
        {
          id: 'member1',
          name: 'Member 1',
          platformUserId: 'U1111111111',
          addedAt: new Date(),
          addedBy: { name: 'Admin' },
        },
      ],
      configs: [
        {
          id: 'config1',
          questions: ['Question 1', 'Question 2'],
          weekdays: [1, 2, 3, 4, 5],
          timeLocal: '09:00',
          reminderMinutesBefore: 15,
        },
      ],
      createdBy: { name: 'Creator' },
      createdAt: new Date(),
    };

    it('should return detailed team information', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(
        mockTeamDetails as unknown as Team & {
          members: TeamMember[];
          configs: StandupConfig[];
          integration: Integration;
          createdBy: { name: string };
        },
      );
      mockPrisma.channel.findUnique.mockResolvedValue({ name: 'test-channel' } as Channel);

      const result = await service.getTeamDetails(mockTeamId, mockOrgId);

      expect(result).toEqual({
        id: mockTeamId,
        name: 'Test Team',
        timezone: 'America/New_York',
        integration: { teamName: 'T1234567890' },
        channel: { id: 'channel-db-id', name: 'test-channel' },
        members: [
          {
            id: 'member1',
            name: 'Member 1',
            platformUserId: 'U1111111111',
            addedAt: mockTeamDetails.members[0].addedAt,
            addedBy: { name: 'Admin' },
          },
        ],
        standupConfig: mockTeamDetails.configs[0],
        createdAt: mockTeamDetails.createdAt,
        createdBy: { name: 'Creator' },
      });
    });

    it('should throw error when team not found', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(null);

      await expect(service.getTeamDetails(mockTeamId, mockOrgId)).rejects.toThrow(
        new ApiError(ErrorCode.NOT_FOUND, 'Team not found', 404),
      );
    });
  });

  describe('addTeamMember', () => {
    const slackUserId = 'U1234567890';
    const mockTeam = TeamFactory.createMockTeam({
      id: mockTeamId,
      integrationId: mockIntegrationId,
      integration: { id: mockIntegrationId },
    });

    beforeEach(() => {
      mockPrisma.team.findUnique.mockResolvedValue(mockTeam as Team & { integration: Integration });
      mockPrisma.teamMember.findFirst.mockResolvedValue(null); // No existing membership
      mockPrisma.teamMember.create.mockResolvedValue({} as { id: string });
    });

    it('should successfully add team member', async () => {
      (mockSlackApiService as unknown as { callSlackApi: jest.Mock }).callSlackApi = jest
        .fn()
        .mockResolvedValue({
          user: {
            profile: {
              display_name: 'Test User',
              real_name: 'Test User Real',
            },
            name: 'testuser',
          },
        });

      await service.addTeamMember(mockTeamId, slackUserId, mockUserId);

      expect(mockPrisma.teamMember.create).toHaveBeenCalledWith({
        data: {
          teamId: mockTeamId,
          platformUserId: slackUserId,
          name: 'Test User',
          addedByUserId: mockUserId,
        },
      });
    });

    it('should throw error when team not found', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(null);

      await expect(service.addTeamMember(mockTeamId, slackUserId, mockUserId)).rejects.toThrow(
        new ApiError(ErrorCode.NOT_FOUND, 'Team not found', 404),
      );
    });

    it('should throw error when member already exists', async () => {
      const existingMember = { id: 'existing-member' };
      mockPrisma.teamMember.findFirst.mockResolvedValue(existingMember as { id: string });

      await expect(service.addTeamMember(mockTeamId, slackUserId, mockUserId)).rejects.toThrow(
        new ApiError(ErrorCode.CONFLICT, 'Member is already in this team', 409),
      );
    });

    it('should handle Slack API errors gracefully and use fallback name', async () => {
      (mockSlackApiService as unknown as { callSlackApi: jest.Mock }).callSlackApi = jest
        .fn()
        .mockRejectedValue(new Error('API error'));

      await service.addTeamMember(mockTeamId, slackUserId, mockUserId);

      expect(mockPrisma.teamMember.create).toHaveBeenCalledWith({
        data: {
          teamId: mockTeamId,
          platformUserId: slackUserId,
          name: 'Unknown',
          addedByUserId: mockUserId,
        },
      });
    });
  });

  describe('removeTeamMember', () => {
    const memberId = 'member-123';

    it('should successfully remove team member', async () => {
      const mockMember = { id: memberId, teamId: mockTeamId };
      mockPrisma.teamMember.findFirst.mockResolvedValue(
        mockMember as { id: string; teamId: string },
      );
      mockPrisma.teamMember.delete.mockResolvedValue({} as { id: string });

      await service.removeTeamMember(mockTeamId, memberId);

      expect(mockPrisma.teamMember.delete).toHaveBeenCalledWith({
        where: { id: memberId },
      });
    });

    it('should throw error when member not found', async () => {
      mockPrisma.teamMember.findFirst.mockResolvedValue(null);

      await expect(service.removeTeamMember(mockTeamId, memberId)).rejects.toThrow(
        new ApiError(ErrorCode.NOT_FOUND, 'Team membership not found', 404),
      );
    });
  });

  describe('getAvailableChannels', () => {
    it('should return available channels with assignment status', async () => {
      const mockChannels = [
        {
          channelId: 'C1111111111',
          name: 'general',
          teams: [],
        },
        {
          channelId: 'C2222222222',
          name: 'development',
          teams: [{ name: 'Dev Team' }],
        },
      ];

      mockPrisma.channel.findMany.mockResolvedValue(
        mockChannels as (Channel & { teams: { name: string }[] })[],
      );

      const result = await service.getAvailableChannels(mockOrgId);

      expect(result.channels).toHaveLength(2);
      expect(result.channels[0]).toEqual({
        id: 'C1111111111',
        name: 'general',
        isAssigned: false,
        assignedTeamName: undefined,
      });
      expect(result.channels[1]).toEqual({
        id: 'C2222222222',
        name: 'development',
        isAssigned: true,
        assignedTeamName: 'Dev Team',
      });
    });
  });

  describe('getAvailableMembers', () => {
    it('should return available members from stored integration users', async () => {
      const mockIntegrations = [
        {
          id: mockIntegrationId,
          platform: 'slack',
          integrationUsers: [
            IntegrationFactory.createMockIntegrationUser({
              externalUserId: 'U1111111111',
              name: 'User 1',
              displayName: 'user1',
              email: 'user1@example.com',
            }),
            IntegrationFactory.createMockIntegrationUser({
              externalUserId: 'U2222222222',
              name: 'User 2',
              displayName: 'user2',
              email: 'user2@example.com',
            }),
          ],
        },
      ];

      mockPrisma.integration.findMany.mockResolvedValue(
        mockIntegrations as unknown as (Integration & { integrationUsers: IntegrationUser[] })[],
      );
      mockPrisma.teamMember.count.mockResolvedValue(1); // Both users are in 1 team
      mockPrisma.teamMember.groupBy.mockResolvedValue([
        { integrationUserId: 'user1-id', platformUserId: 'U1111111111', _count: { id: 1 } },
        { integrationUserId: 'user2-id', platformUserId: 'U2222222222', _count: { id: 1 } },
      ]);

      const result = await service.getAvailableMembers(mockOrgId);

      expect(result.members).toHaveLength(2);
      expect(result.members[0]).toEqual({
        id: 'U1111111111',
        name: 'user1',
        platformUserId: 'U1111111111',
        email: 'user1@example.com',
        profileImage: expect.any(String),
        platform: 'slack',
        inTeamCount: 1,
        lastSyncAt: expect.any(Date),
      });
    });

    it('should fall back to API calls when no stored users found', async () => {
      mockPrisma.integration.findMany.mockResolvedValue([
        { id: mockIntegrationId, platform: 'slack', integrationUsers: [] },
      ] as unknown as (Integration & { integrationUsers: IntegrationUser[] })[]);
      mockPrisma.teamMember.groupBy.mockResolvedValue([]);

      // Mock the private method call
      const getAvailableMembersFromAPISpy = jest
        .spyOn(
          service as unknown as { getAvailableMembersFromAPI: jest.Mock },
          'getAvailableMembersFromAPI',
        )
        .mockResolvedValue({
          members: [
            {
              id: 'U1111111111',
              name: 'API User',
              platformUserId: 'U1111111111',
              inTeamCount: 0,
            },
          ],
        });

      const result = await service.getAvailableMembers(mockOrgId);

      expect(getAvailableMembersFromAPISpy).toHaveBeenCalledWith(mockOrgId);
      expect(result.members).toHaveLength(1);
      expect(result.members[0].name).toBe('API User');
    });
  });

  describe('validateChannelAccess', () => {
    it('should return valid response when channel access is successful', async () => {
      (mockSlackApiService as unknown as { callSlackApi: jest.Mock }).callSlackApi = jest
        .fn()
        .mockResolvedValue({
          channel: { name: 'test-channel' },
        });

      const result = await service.validateChannelAccess(mockChannelId, mockIntegrationId);

      expect(result).toEqual({
        valid: true,
        channelName: 'test-channel',
      });
    });

    it('should return invalid response when channel access fails', async () => {
      (mockSlackApiService as unknown as { callSlackApi: jest.Mock }).callSlackApi = jest
        .fn()
        .mockRejectedValue(new Error('Channel not found'));

      const result = await service.validateChannelAccess(mockChannelId, mockIntegrationId);

      expect(result).toEqual({
        valid: false,
        error: 'Bot does not have access to this channel or channel does not exist',
      });
    });
  });
});
