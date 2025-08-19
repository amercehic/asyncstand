import { Test, TestingModule } from '@nestjs/testing';

// Mock types for test return values matching actual DTOs
interface MockTeamListResponse {
  teams: Array<{
    id: string;
    name: string;
    memberCount: number;
    standupConfigCount: number;
    createdAt: Date;
    createdBy: {
      name: string;
    };
  }>;
}

interface MockTeamDetailsResponse {
  id: string;
  name: string;
  description?: string;
  timezone: string;
  integration: {
    teamName: string;
  };
  members: Array<{
    id: string;
    name: string;
    platformUserId: string;
    addedAt: Date;
    addedBy: {
      name: string;
    } | null;
  }>;
  standupConfigs: Array<{
    id: string;
    name: string;
    deliveryType: string;
    targetChannel?: {
      id: string;
      name: string;
      channelId: string;
    };
    isActive: boolean;
    memberCount: number;
  }>;
  createdAt: Date;
  createdBy: {
    name: string;
  } | null;
}

interface MockChannelsResponse {
  channels: Array<{
    id: string;
    name: string;
    isAssigned: boolean;
    assignedTeamName?: string;
  }>;
}

interface MockMembersResponse {
  members: Array<{
    id: string;
    name: string;
    platformUserId: string;
    inTeamCount: number;
  }>;
}

interface MockTeamMember {
  id: string;
  name: string;
  platformUserId: string;
  addedAt: Date;
  addedBy: {
    name: string;
  } | null;
}

interface MockChannelDetails {
  id: string;
  name: string;
  topic?: string;
  purpose?: string;
  isPrivate: boolean;
  isArchived: boolean;
  memberCount?: number;
  isAssigned: boolean;
  assignedTeamName?: string;
  lastSyncAt?: Date;
}

interface MockTeamChannelDetails {
  id: string;
  channelId: string;
  name: string;
  topic: string;
  purpose: string;
  isPrivate: boolean;
  memberCount: number;
}

interface MockStandup {
  id: string;
  name: string;
  deliveryType: StandupDeliveryType;
  targetChannel: { id: string; name: string; channelId: string } | null;
  isActive: boolean;
  weekdays: number[];
  timeLocal: string;
  timezone: string;
  memberCount: number;
  createdAt: Date;
}
import { TeamsController } from '@/teams/teams.controller';
import { TeamManagementService } from '@/teams/team-management.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { CreateTeamDto } from '@/teams/dto/create-team.dto';
import { UpdateTeamDto } from '@/teams/dto/update-team.dto';
import { AddTeamMemberDto } from '@/teams/dto/add-team-member.dto';
import { StandupDeliveryType } from '@prisma/client';

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
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
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
      };
      mockTeamManagementService.listTeams.mockResolvedValue(mockTeams as MockTeamListResponse);

      const result = await controller.listTeams(mockOrgId);

      expect(result).toEqual(mockTeams);
      expect(mockTeamManagementService.listTeams).toHaveBeenCalledWith(mockOrgId);
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
      mockTeamManagementService.getTeamDetails.mockResolvedValue(
        mockDetails as MockTeamDetailsResponse,
      );

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
      };
      mockTeamManagementService.getAvailableChannels.mockResolvedValue(
        mockChannels as MockChannelsResponse,
      );

      const result = await controller.getAvailableChannels(mockOrgId);

      expect(result).toEqual(mockChannels);
      expect(mockTeamManagementService.getAvailableChannels).toHaveBeenCalledWith(mockOrgId);
    });
  });

  describe('getAvailableMembers', () => {
    it('should return available members', async () => {
      const mockMembers = {
        members: [
          { id: 'member1', name: 'Member 1', platformUserId: 'slack-user-1', inTeamCount: 2 },
          { id: 'member2', name: 'Member 2', platformUserId: 'slack-user-2', inTeamCount: 1 },
        ],
      };
      mockTeamManagementService.getAvailableMembers.mockResolvedValue(
        mockMembers as MockMembersResponse,
      );

      const result = await controller.getAvailableMembers(mockOrgId);

      expect(result).toEqual(mockMembers);
      expect(mockTeamManagementService.getAvailableMembers).toHaveBeenCalledWith(mockOrgId);
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
      mockTeamManagementService.getTeamMembers.mockResolvedValue(mockMembers as MockTeamMember[]);

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
      mockTeamManagementService.getChannelsList.mockResolvedValue(
        mockChannels as { channels: MockChannelDetails[] },
      );

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
      mockTeamManagementService.getTeamAvailableChannels.mockResolvedValue(
        mockChannels as { channels: MockTeamChannelDetails[] },
      );

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
      mockTeamManagementService.getTeamStandups.mockResolvedValue(
        mockStandups as { standups: MockStandup[] },
      );

      const result = await controller.getTeamStandups(mockTeamId, mockOrgId);

      expect(result).toEqual(mockStandups);
      expect(mockTeamManagementService.getTeamStandups).toHaveBeenCalledWith(mockTeamId, mockOrgId);
    });
  });
});
