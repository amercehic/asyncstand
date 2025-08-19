import { Test, TestingModule } from '@nestjs/testing';

import { TeamsController } from '@/teams/teams.controller';
import { TeamManagementService } from '@/teams/team-management.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { LoggerService } from '@/common/logger.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { RequestSizeGuard } from '@/common/guards/request-size.guard';
import { CreateTeamDto } from '@/teams/dto/create-team.dto';
import { UpdateTeamDto } from '@/teams/dto/update-team.dto';
import { AddTeamMemberDto } from '@/teams/dto/add-team-member.dto';
import { StandupDeliveryType } from '@prisma/client';
import { createMockLoggerService } from '@/test/utils/mocks/services.mock';

describe('TeamsController', () => {
  let controller: TeamsController;
  let mockTeamManagementService: jest.Mocked<TeamManagementService>;
  let mockAuditLogService: jest.Mocked<AuditLogService>;

  const mockOrgId = 'org-123';
  const mockUserId = 'user-123';
  const mockTeamId = 'team-123';
  const mockMemberId = 'member-123';
  const mockUser = { userId: mockUserId, orgId: mockOrgId, role: 'admin' };

  beforeEach(async () => {
    mockTeamManagementService = {
      createTeam: jest.fn(),
      listTeams: jest.fn(),
      getTeamDetails: jest.fn(),
      updateTeam: jest.fn(),
      deleteTeam: jest.fn(),
      getAvailableChannels: jest.fn(),
      getAvailableMembers: jest.fn(),
      getTeamMembers: jest.fn(),
      addTeamMember: jest.fn(),
      removeTeamMember: jest.fn(),
      getChannelsList: jest.fn(),
      syncTeamMembers: jest.fn(),
      updateMemberStatus: jest.fn(),
      getTeamAvailableChannels: jest.fn(),
      getTeamStandups: jest.fn(),
    } as unknown as jest.Mocked<TeamManagementService>;

    mockAuditLogService = {
      log: jest.fn(),
    } as unknown as jest.Mocked<AuditLogService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeamsController],
      providers: [
        { provide: TeamManagementService, useValue: mockTeamManagementService },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: LoggerService, useValue: createMockLoggerService() },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RequestSizeGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<TeamsController>(TeamsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createTeam', () => {
    it('should create a team', async () => {
      const createDto: CreateTeamDto = {
        name: 'Test Team',
        integrationId: 'integration-123',
        channelId: 'channel-123',
        timezone: 'America/New_York',
        description: 'Test team description',
      };
      const mockResult = { id: mockTeamId };
      mockTeamManagementService.createTeam.mockResolvedValue(mockResult);
      mockAuditLogService.log.mockResolvedValue(undefined);

      const result = await controller.createTeam(createDto, mockOrgId, mockUser);

      expect(result).toEqual(mockResult);
      expect(mockTeamManagementService.createTeam).toHaveBeenCalledWith(
        mockOrgId,
        mockUserId,
        createDto,
      );
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'team.created',
          orgId: mockOrgId,
          actorUserId: mockUserId,
        }),
      );
    });
  });

  describe('listTeams', () => {
    it('should return list of teams', async () => {
      const mockTeams = {
        teams: [
          {
            id: 'team1',
            name: 'Team 1',
            memberCount: 5,
            standupConfigCount: 2,
            createdAt: new Date(),
            createdBy: { name: 'Admin User' },
          },
          {
            id: 'team2',
            name: 'Team 2',
            memberCount: 3,
            standupConfigCount: 1,
            createdAt: new Date(),
            createdBy: { name: 'Admin User' },
          },
        ],
        pagination: { page: 1, limit: 20, total: 2 },
      };
      mockTeamManagementService.listTeams.mockResolvedValue(mockTeams);

      const result = await controller.listTeams(mockOrgId);

      expect(result).toEqual(mockTeams);
      expect(mockTeamManagementService.listTeams).toHaveBeenCalledWith(
        mockOrgId,
        undefined,
        undefined,
      );
    });
  });

  describe('getTeamDetails', () => {
    it('should return team details', async () => {
      const mockDetails = {
        id: mockTeamId,
        name: 'Test Team',
        description: 'Test team description',
        timezone: 'America/New_York',
        integration: {
          teamName: 'test-channel',
        },
        members: [
          {
            id: 'member1',
            name: 'Member 1',
            platformUserId: 'slack-user-1',
            addedAt: new Date(),
            addedBy: { name: 'Admin User' },
          },
        ],
        standupConfigs: [
          {
            id: 'config1',
            name: 'Daily Standup',
            deliveryType: 'slack',
            targetChannel: {
              id: 'channel1',
              name: 'test-channel',
              channelId: 'C1234567890',
            },
            isActive: true,
            memberCount: 5,
          },
        ],
        createdAt: new Date(),
        createdBy: { name: 'Admin User' },
      };
      mockTeamManagementService.getTeamDetails.mockResolvedValue(mockDetails);

      const result = await controller.getTeamDetails(mockTeamId, mockOrgId);

      expect(result).toEqual(mockDetails);
      expect(mockTeamManagementService.getTeamDetails).toHaveBeenCalledWith(mockTeamId, mockOrgId);
    });
  });

  describe('updateTeam', () => {
    it('should update team', async () => {
      const updateDto: UpdateTeamDto = { name: 'Updated Team' };
      mockTeamManagementService.updateTeam.mockResolvedValue(undefined);
      mockAuditLogService.log.mockResolvedValue(undefined);

      const result = await controller.updateTeam(mockTeamId, updateDto, mockOrgId, mockUser);

      expect(result).toEqual({ success: true });
      expect(mockTeamManagementService.updateTeam).toHaveBeenCalledWith(
        mockTeamId,
        mockOrgId,
        updateDto,
      );
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'team.updated',
          orgId: mockOrgId,
          actorUserId: mockUserId,
        }),
      );
    });
  });

  describe('deleteTeam', () => {
    it('should delete team', async () => {
      mockTeamManagementService.deleteTeam.mockResolvedValue(undefined);
      mockAuditLogService.log.mockResolvedValue(undefined);

      const result = await controller.deleteTeam(mockTeamId, mockOrgId, mockUser);

      expect(result).toEqual({ success: true });
      expect(mockTeamManagementService.deleteTeam).toHaveBeenCalledWith(mockTeamId, mockOrgId);
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'team.deleted',
          orgId: mockOrgId,
          actorUserId: mockUserId,
        }),
      );
    });
  });

  describe('getAvailableChannels', () => {
    it('should return available channels', async () => {
      const mockChannels = {
        channels: [
          { id: 'channel1', name: 'Channel 1', isAssigned: false },
          { id: 'channel2', name: 'Channel 2', isAssigned: true, assignedTeamName: 'Other Team' },
        ],
        pagination: { page: 1, limit: 50, total: 2 },
      };
      mockTeamManagementService.getAvailableChannels.mockResolvedValue(mockChannels);

      const result = await controller.getAvailableChannels(mockOrgId);

      expect(result).toEqual(mockChannels);
      expect(mockTeamManagementService.getAvailableChannels).toHaveBeenCalledWith(
        mockOrgId,
        undefined,
        undefined,
      );
    });
  });

  describe('getAvailableMembers', () => {
    it('should return available members', async () => {
      const mockMembers = {
        members: [
          { id: 'member1', name: 'Member 1', platformUserId: 'slack-user-1', inTeamCount: 2 },
          { id: 'member2', name: 'Member 2', platformUserId: 'slack-user-2', inTeamCount: 1 },
        ],
        pagination: { page: 1, limit: 50, total: 2 },
      };
      mockTeamManagementService.getAvailableMembers.mockResolvedValue(mockMembers);

      const result = await controller.getAvailableMembers(mockOrgId);

      expect(result).toEqual(mockMembers);
      expect(mockTeamManagementService.getAvailableMembers).toHaveBeenCalledWith(
        mockOrgId,
        undefined,
        undefined,
      );
    });
  });

  describe('getTeamMembers', () => {
    it('should return team members', async () => {
      const mockMembers = [
        {
          id: 'member1',
          name: 'Member 1',
          platformUserId: 'slack-user-1',
          addedAt: new Date(),
          addedBy: { name: 'Admin User' },
        },
        {
          id: 'member2',
          name: 'Member 2',
          platformUserId: 'slack-user-2',
          addedAt: new Date(),
          addedBy: null,
        },
      ];
      mockTeamManagementService.getTeamMembers.mockResolvedValue(mockMembers);

      const result = await controller.getTeamMembers(mockTeamId);

      expect(result).toEqual(mockMembers);
      expect(mockTeamManagementService.getTeamMembers).toHaveBeenCalledWith(mockTeamId);
    });
  });

  describe('addTeamMember', () => {
    it('should add team member', async () => {
      const addMemberDto: AddTeamMemberDto = { slackUserId: 'slack-user-123' };
      mockTeamManagementService.addTeamMember.mockResolvedValue(undefined);
      mockAuditLogService.log.mockResolvedValue(undefined);

      const result = await controller.addTeamMember(mockTeamId, addMemberDto, mockUser);

      expect(result).toEqual({ success: true });
      expect(mockTeamManagementService.addTeamMember).toHaveBeenCalledWith(
        mockTeamId,
        'slack-user-123',
        mockUserId,
      );
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'team.member_added',
          orgId: mockOrgId,
          actorUserId: mockUserId,
        }),
      );
    });
  });

  describe('removeTeamMember', () => {
    it('should remove team member', async () => {
      mockTeamManagementService.removeTeamMember.mockResolvedValue(undefined);
      mockAuditLogService.log.mockResolvedValue(undefined);

      const result = await controller.removeTeamMember(mockTeamId, mockMemberId, mockUser);

      expect(result).toEqual({ success: true });
      expect(mockTeamManagementService.removeTeamMember).toHaveBeenCalledWith(
        mockTeamId,
        mockMemberId,
      );
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'team.member_removed',
          orgId: mockOrgId,
          actorUserId: mockUserId,
        }),
      );
    });
  });

  describe('getChannelsList', () => {
    it('should return channels list', async () => {
      const mockChannels = {
        channels: [
          {
            id: 'channel1',
            name: 'Channel 1',
            isPrivate: false,
            isArchived: false,
            isAssigned: false,
          },
          {
            id: 'channel2',
            name: 'Channel 2',
            isPrivate: false,
            isArchived: false,
            isAssigned: true,
            assignedTeamName: 'Other Team',
          },
        ],
      };
      mockTeamManagementService.getChannelsList.mockResolvedValue(mockChannels);

      const result = await controller.getChannelsList(mockOrgId);

      expect(result).toEqual(mockChannels);
      expect(mockTeamManagementService.getChannelsList).toHaveBeenCalledWith(mockOrgId);
    });
  });

  describe('syncTeamMembers', () => {
    it('should sync team members', async () => {
      const mockResult = { success: true, syncedCount: 3 };
      mockTeamManagementService.syncTeamMembers.mockResolvedValue(mockResult);
      mockAuditLogService.log.mockResolvedValue(undefined);

      const result = await controller.syncTeamMembers(mockTeamId, mockOrgId, mockUser);

      expect(result).toEqual(mockResult);
      expect(mockTeamManagementService.syncTeamMembers).toHaveBeenCalledWith(mockTeamId, mockOrgId);
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'team.members_synced',
          orgId: mockOrgId,
          actorUserId: mockUserId,
        }),
      );
    });
  });

  describe('activateTeamMember', () => {
    it('should activate team member', async () => {
      mockTeamManagementService.updateMemberStatus.mockResolvedValue(undefined);
      mockAuditLogService.log.mockResolvedValue(undefined);

      const result = await controller.activateTeamMember(
        mockTeamId,
        mockMemberId,
        mockOrgId,
        mockUser,
      );

      expect(result).toEqual({ success: true });
      expect(mockTeamManagementService.updateMemberStatus).toHaveBeenCalledWith(
        mockTeamId,
        mockMemberId,
        mockOrgId,
        true,
      );
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'team.member_activated',
          orgId: mockOrgId,
          actorUserId: mockUserId,
        }),
      );
    });
  });

  describe('deactivateTeamMember', () => {
    it('should deactivate team member', async () => {
      mockTeamManagementService.updateMemberStatus.mockResolvedValue(undefined);
      mockAuditLogService.log.mockResolvedValue(undefined);

      const result = await controller.deactivateTeamMember(
        mockTeamId,
        mockMemberId,
        mockOrgId,
        mockUser,
      );

      expect(result).toEqual({ success: true });
      expect(mockTeamManagementService.updateMemberStatus).toHaveBeenCalledWith(
        mockTeamId,
        mockMemberId,
        mockOrgId,
        false,
      );
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'team.member_deactivated',
          orgId: mockOrgId,
          actorUserId: mockUserId,
        }),
      );
    });
  });

  describe('getTeamAvailableChannels', () => {
    it('should return team available channels', async () => {
      const mockChannels = {
        channels: [
          {
            id: 'channel1',
            channelId: 'C1234567890',
            name: 'Channel 1',
            topic: 'Channel topic',
            purpose: 'Channel purpose',
            isPrivate: false,
            memberCount: 10,
          },
          {
            id: 'channel2',
            channelId: 'C9876543210',
            name: 'Channel 2',
            topic: 'Another topic',
            purpose: 'Another purpose',
            isPrivate: true,
            memberCount: 5,
          },
        ],
      };
      mockTeamManagementService.getTeamAvailableChannels.mockResolvedValue(mockChannels);

      const result = await controller.getTeamAvailableChannels(mockTeamId, mockOrgId);

      expect(result).toEqual(mockChannels);
      expect(mockTeamManagementService.getTeamAvailableChannels).toHaveBeenCalledWith(
        mockTeamId,
        mockOrgId,
      );
    });
  });

  describe('getTeamStandups', () => {
    it('should return team standups', async () => {
      const mockStandups = {
        standups: [
          {
            id: 'standup1',
            name: 'Daily Standup',
            deliveryType: StandupDeliveryType.channel,
            targetChannel: {
              id: 'channel1',
              name: 'test-channel',
              channelId: 'C1234567890',
            },
            isActive: true,
            weekdays: [1, 2, 3, 4, 5],
            timeLocal: '09:00',
            timezone: 'America/New_York',
            memberCount: 5,
            createdAt: new Date(),
          },
          {
            id: 'standup2',
            name: 'Weekly Review',
            deliveryType: StandupDeliveryType.direct_message,
            targetChannel: null,
            isActive: false,
            weekdays: [5],
            timeLocal: '14:00',
            timezone: 'America/New_York',
            memberCount: 3,
            createdAt: new Date(),
          },
        ],
      };
      mockTeamManagementService.getTeamStandups.mockResolvedValue(mockStandups);

      const result = await controller.getTeamStandups(mockTeamId, mockOrgId);

      expect(result).toEqual(mockStandups);
      expect(mockTeamManagementService.getTeamStandups).toHaveBeenCalledWith(mockTeamId, mockOrgId);
    });
  });
});
