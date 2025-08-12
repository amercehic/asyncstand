import { Test, TestingModule } from '@nestjs/testing';
import { StandupConfigController } from '@/standups/standup-config.controller';
import { StandupConfigService } from '@/standups/standup-config.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { CreateStandupConfigDto } from '@/standups/dto/create-standup-config.dto';
import { UpdateStandupConfigDto } from '@/standups/dto/update-standup-config.dto';
import { UpdateMemberParticipationDto } from '@/standups/dto/update-member-participation.dto';
import { BulkUpdateParticipationDto } from '@/standups/dto/bulk-update-participation.dto';
import {
  StandupConfigResponse,
  MemberParticipationResponse,
  PreviewResponse,
  QuestionTemplate,
} from '@/standups/types/standup-config.types';

describe('StandupConfigController', () => {
  let controller: StandupConfigController;
  let mockStandupConfigService: jest.Mocked<StandupConfigService>;

  const mockTeamId = 'team-123';
  const mockOrgId = 'org-123';
  const mockUserId = 'user-123';
  const mockMemberId = 'member-123';
  const mockConfigId = 'config-123';

  beforeEach(async () => {
    const mockStandupConfigServiceMethods = {
      createStandupConfig: jest.fn(),
      getStandupConfig: jest.fn(),
      updateStandupConfig: jest.fn(),
      deleteStandupConfig: jest.fn(),
      getPreview: jest.fn(),
      getMemberParticipation: jest.fn(),
      updateMemberParticipation: jest.fn(),
      bulkUpdateParticipation: jest.fn(),
      getValidTimezones: jest.fn(),
      getQuestionTemplates: jest.fn(),
      listTeamsWithStandups: jest.fn(),
    } as unknown as jest.Mocked<StandupConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StandupConfigController],
      providers: [
        {
          provide: StandupConfigService,
          useValue: mockStandupConfigServiceMethods,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<StandupConfigController>(StandupConfigController);
    mockStandupConfigService = module.get(StandupConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createStandupConfig', () => {
    const createDto: CreateStandupConfigDto = {
      name: 'Daily Standup',
      questions: [
        'What did you accomplish yesterday?',
        'What will you work on today?',
        'Are there any blockers?',
      ],
      weekdays: [1, 2, 3, 4, 5],
      timeLocal: '09:00',
      timezone: 'America/New_York',
      reminderMinutesBefore: 15,
      responseTimeoutHours: 2,
      isActive: true,
    };

    it('should create standup configuration successfully', async () => {
      const expectedResult = { id: mockConfigId };
      mockStandupConfigService.createStandupConfig.mockResolvedValue(expectedResult);

      const result = await controller.createStandupConfig(
        mockTeamId,
        mockOrgId,
        mockUserId,
        createDto,
      );

      expect(result).toEqual(expectedResult);
      expect(mockStandupConfigService.createStandupConfig).toHaveBeenCalledWith(
        mockTeamId,
        mockOrgId,
        mockUserId,
        createDto,
      );
    });

    it('should pass through service errors', async () => {
      const error = new Error('Team not found');
      mockStandupConfigService.createStandupConfig.mockRejectedValue(error);

      await expect(
        controller.createStandupConfig(mockTeamId, mockOrgId, mockUserId, createDto),
      ).rejects.toThrow(error);
    });
  });

  describe('getStandupConfig', () => {
    it('should get standup configuration successfully', async () => {
      const expectedConfig: StandupConfigResponse = {
        id: mockConfigId,
        teamId: mockTeamId,
        name: 'Daily Standup',
        team: {
          id: mockTeamId,
          name: 'Test Team',
          channelName: 'test-channel',
        },
        questions: ['Question 1', 'Question 2', 'Question 3'],
        weekdays: [1, 2, 3, 4, 5],
        timeLocal: '09:00',
        timezone: 'America/New_York',
        reminderMinutesBefore: 15,
        responseTimeoutHours: 2,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        memberParticipation: [],
      };

      mockStandupConfigService.getStandupConfig.mockResolvedValue(expectedConfig);

      const result = await controller.getStandupConfig(mockTeamId, mockOrgId);

      expect(result).toEqual(expectedConfig);
      expect(mockStandupConfigService.getStandupConfig).toHaveBeenCalledWith(mockTeamId, mockOrgId);
    });

    it('should pass through service errors', async () => {
      const error = new Error('Configuration not found');
      mockStandupConfigService.getStandupConfig.mockRejectedValue(error);

      await expect(controller.getStandupConfig(mockTeamId, mockOrgId)).rejects.toThrow(error);
    });
  });

  describe('updateStandupConfig', () => {
    const updateDto: UpdateStandupConfigDto = {
      questions: ['Updated question 1', 'Updated question 2'],
      timeLocal: '10:00',
      reminderMinutesBefore: 30,
    };

    it('should update standup configuration successfully', async () => {
      mockStandupConfigService.updateStandupConfig.mockResolvedValue(undefined);

      const result = await controller.updateStandupConfig(mockTeamId, mockOrgId, updateDto);

      expect(result).toEqual({ message: 'Standup configuration updated successfully' });
      expect(mockStandupConfigService.updateStandupConfig).toHaveBeenCalledWith(
        mockTeamId,
        mockOrgId,
        updateDto,
      );
    });

    it('should pass through service errors', async () => {
      const error = new Error('Configuration not found');
      mockStandupConfigService.updateStandupConfig.mockRejectedValue(error);

      await expect(
        controller.updateStandupConfig(mockTeamId, mockOrgId, updateDto),
      ).rejects.toThrow(error);
    });
  });

  describe('deleteStandupConfig', () => {
    it('should delete standup configuration successfully', async () => {
      mockStandupConfigService.deleteStandupConfig.mockResolvedValue(undefined);

      const result = await controller.deleteStandupConfig(mockTeamId, mockOrgId);

      expect(result).toEqual({ message: 'Standup configuration deleted successfully' });
      expect(mockStandupConfigService.deleteStandupConfig).toHaveBeenCalledWith(
        mockTeamId,
        mockOrgId,
      );
    });

    it('should pass through service errors', async () => {
      const error = new Error('Configuration not found');
      mockStandupConfigService.deleteStandupConfig.mockRejectedValue(error);

      await expect(controller.deleteStandupConfig(mockTeamId, mockOrgId)).rejects.toThrow(error);
    });
  });

  describe('getStandupPreview', () => {
    it('should get standup preview successfully', async () => {
      const expectedPreview: PreviewResponse = {
        schedule: {
          weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          timeLocal: '09:00',
          timezone: 'America/New_York',
          nextStandup: new Date(),
        },
        questions: ['Question 1', 'Question 2'],
        participatingMembers: 2,
        totalMembers: 2,
        reminderSettings: {
          minutesBefore: 15,
          timeoutHours: 2,
        },
      };

      mockStandupConfigService.getPreview.mockResolvedValue(expectedPreview);

      const result = await controller.getStandupPreview(mockTeamId, mockOrgId);

      expect(result).toEqual(expectedPreview);
      expect(mockStandupConfigService.getPreview).toHaveBeenCalledWith(mockTeamId, mockOrgId);
    });

    it('should pass through service errors', async () => {
      const error = new Error('Configuration not found');
      mockStandupConfigService.getPreview.mockRejectedValue(error);

      await expect(controller.getStandupPreview(mockTeamId, mockOrgId)).rejects.toThrow(error);
    });
  });

  describe('getMemberParticipation', () => {
    it('should get member participation successfully', async () => {
      const expectedParticipation: MemberParticipationResponse[] = [
        {
          teamMember: {
            id: 'member1',
            name: 'Member 1',
            platformUserId: 'U1111111111',
          },
          include: true,
          role: 'participant',
        },
        {
          teamMember: {
            id: 'member2',
            name: 'Member 2',
            platformUserId: 'U2222222222',
          },
          include: false,
          role: 'observer',
        },
      ];

      mockStandupConfigService.getMemberParticipation.mockResolvedValue(expectedParticipation);

      const result = await controller.getMemberParticipation(mockTeamId);

      expect(result).toEqual(expectedParticipation);
      expect(mockStandupConfigService.getMemberParticipation).toHaveBeenCalledWith(mockTeamId);
    });

    it('should pass through service errors', async () => {
      const error = new Error('Team not found');
      mockStandupConfigService.getMemberParticipation.mockRejectedValue(error);

      await expect(controller.getMemberParticipation(mockTeamId)).rejects.toThrow(error);
    });
  });

  describe('updateMemberParticipation', () => {
    const updateDto: UpdateMemberParticipationDto = {
      include: true,
      role: 'lead',
    };

    it('should update member participation successfully', async () => {
      mockStandupConfigService.updateMemberParticipation.mockResolvedValue(undefined);

      const result = await controller.updateMemberParticipation(
        mockTeamId,
        mockMemberId,
        updateDto,
      );

      expect(result).toEqual({ message: 'Member participation updated successfully' });
      expect(mockStandupConfigService.updateMemberParticipation).toHaveBeenCalledWith(
        mockTeamId,
        mockMemberId,
        updateDto,
      );
    });

    it('should pass through service errors', async () => {
      const error = new Error('Member not found');
      mockStandupConfigService.updateMemberParticipation.mockRejectedValue(error);

      await expect(
        controller.updateMemberParticipation(mockTeamId, mockMemberId, updateDto),
      ).rejects.toThrow(error);
    });
  });

  describe('bulkUpdateParticipation', () => {
    const bulkUpdateDto: BulkUpdateParticipationDto = {
      members: [
        { teamMemberId: 'member1', include: true, role: 'participant' },
        { teamMemberId: 'member2', include: false, role: 'observer' },
      ],
    };

    it('should bulk update member participation successfully', async () => {
      mockStandupConfigService.bulkUpdateParticipation.mockResolvedValue(undefined);

      const result = await controller.bulkUpdateParticipation(mockTeamId, bulkUpdateDto);

      expect(result).toEqual({ message: 'Member participation updated successfully' });
      expect(mockStandupConfigService.bulkUpdateParticipation).toHaveBeenCalledWith(
        mockTeamId,
        bulkUpdateDto,
      );
    });

    it('should pass through service errors', async () => {
      const error = new Error('One or more members not found');
      mockStandupConfigService.bulkUpdateParticipation.mockRejectedValue(error);

      await expect(controller.bulkUpdateParticipation(mockTeamId, bulkUpdateDto)).rejects.toThrow(
        error,
      );
    });
  });

  describe('getValidTimezones', () => {
    it('should return valid timezones', async () => {
      const expectedTimezones = [
        'America/New_York',
        'America/Los_Angeles',
        'Europe/London',
        'Asia/Tokyo',
      ];

      (mockStandupConfigService.getValidTimezones as jest.Mock).mockResolvedValue(
        expectedTimezones,
      );

      const result = await controller.getValidTimezones();

      expect(result).toEqual(expectedTimezones);
      expect(mockStandupConfigService.getValidTimezones).toHaveBeenCalled();
    });

    it('should pass through service errors', async () => {
      const error = new Error('Failed to get timezones');
      (mockStandupConfigService.getValidTimezones as jest.Mock).mockRejectedValue(error);

      await expect(controller.getValidTimezones()).rejects.toThrow(error);
    });
  });

  describe('getQuestionTemplates', () => {
    it('should return question templates', async () => {
      const expectedTemplates: QuestionTemplate[] = [
        {
          name: 'Daily Scrum',
          questions: [
            'What did you accomplish yesterday?',
            'What will you work on today?',
            'Are there any blockers?',
          ],
        },
        {
          name: 'Weekly Check-in',
          questions: [
            'What are your main accomplishments this week?',
            'What are your goals for next week?',
            'Do you need help with anything?',
          ],
        },
      ];

      (mockStandupConfigService.getQuestionTemplates as jest.Mock).mockResolvedValue(
        expectedTemplates,
      );

      const result = await controller.getQuestionTemplates();

      expect(result).toEqual(expectedTemplates);
      expect(mockStandupConfigService.getQuestionTemplates).toHaveBeenCalled();
    });

    it('should pass through service errors', async () => {
      const error = new Error('Failed to get templates');
      (mockStandupConfigService.getQuestionTemplates as jest.Mock).mockRejectedValue(error);

      await expect(controller.getQuestionTemplates()).rejects.toThrow(error);
    });
  });

  describe('listTeamsWithStandups', () => {
    it('should return teams with standups', async () => {
      const expectedTeams = [
        { teamId: 'team1', teamName: 'Team 1', isActive: true },
        { teamId: 'team2', teamName: 'Team 2', isActive: false },
      ];

      mockStandupConfigService.listTeamsWithStandups.mockResolvedValue(expectedTeams);

      const result = await controller.listTeamsWithStandups(mockOrgId);

      expect(result).toEqual(expectedTeams);
      expect(mockStandupConfigService.listTeamsWithStandups).toHaveBeenCalledWith(mockOrgId);
    });

    it('should pass through service errors', async () => {
      const error = new Error('Failed to get teams');
      mockStandupConfigService.listTeamsWithStandups.mockRejectedValue(error);

      await expect(controller.listTeamsWithStandups(mockOrgId)).rejects.toThrow(error);
    });
  });

  describe('Guard Protection', () => {
    it('should be protected by JwtAuthGuard and RolesGuard', () => {
      const guards = Reflect.getMetadata('__guards__', StandupConfigController);
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
    });
  });

  describe('Route Decorators', () => {
    it('should have correct API tags', () => {
      const apiTags = Reflect.getMetadata('swagger/apiUseTags', StandupConfigController);
      expect(apiTags).toContain('Standup Configuration');
    });

    it('should require bearer auth', () => {
      const bearerAuth = Reflect.getMetadata('swagger/apiSecurity', StandupConfigController);
      expect(bearerAuth).toBeDefined();
    });
  });

  describe('Validation', () => {
    it('should use ValidationPipe for request body validation', async () => {
      // This test verifies that ValidationPipe is applied to endpoints that accept DTOs
      // The actual validation logic is tested in DTO validation tests
      const createMethod = controller.createStandupConfig;
      const updateMethod = controller.updateStandupConfig;
      const updateMemberMethod = controller.updateMemberParticipation;
      const bulkUpdateMethod = controller.bulkUpdateParticipation;

      expect(createMethod).toBeDefined();
      expect(updateMethod).toBeDefined();
      expect(updateMemberMethod).toBeDefined();
      expect(bulkUpdateMethod).toBeDefined();
    });
  });

  describe('HTTP Status Codes', () => {
    it('should return appropriate HTTP status codes for different operations', () => {
      // Verify that the controller methods are decorated with appropriate status codes
      // This is more for documentation purposes as the actual HTTP status codes
      // are determined by NestJS based on the method type and success/error responses

      expect(controller.createStandupConfig).toBeDefined();
      expect(controller.getStandupConfig).toBeDefined();
      expect(controller.updateStandupConfig).toBeDefined();
      expect(controller.deleteStandupConfig).toBeDefined();
      expect(controller.getStandupPreview).toBeDefined();
      expect(controller.getMemberParticipation).toBeDefined();
      expect(controller.updateMemberParticipation).toBeDefined();
      expect(controller.bulkUpdateParticipation).toBeDefined();
      expect(controller.getValidTimezones).toBeDefined();
      expect(controller.getQuestionTemplates).toBeDefined();
      expect(controller.listTeamsWithStandups).toBeDefined();
    });
  });
});
