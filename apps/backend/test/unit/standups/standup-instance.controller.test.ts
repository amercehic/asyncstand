import { Test, TestingModule } from '@nestjs/testing';

// Mock types for test return values matching actual DTOs
interface MockInstance {
  id: string;
  teamId: string;
  teamName: string;
  targetDate: string;
  state: string;
  configSnapshot: {
    questions: string[];
    responseTimeoutHours: number;
    reminderMinutesBefore: number;
    participatingMembers: Array<{
      id: string;
      name: string;
      platformUserId: string;
    }>;
    timezone: string;
    timeLocal: string;
  };
  createdAt: Date;
  totalMembers: number;
  respondedMembers: number;
  responseRate: number;
}

interface MockParticipationStatus {
  standupInstanceId: string;
  state: string;
  targetDate: string;
  totalMembers: number;
  respondedMembers: number;
  responseRate: number;
  completionRate: number;
  memberStatus: Array<{
    teamMemberId: string;
    name: string;
    platformUserId?: string;
    questionsAnswered: number;
    totalQuestions: number;
    isComplete: boolean;
    lastAnswerAt?: Date;
  }>;
  timeoutAt?: Date;
  canStillSubmit: boolean;
}
import { StandupInstanceController } from '@/standups/standup-instance.controller';
import { StandupInstanceService } from '@/standups/standup-instance.service';
import { AnswerCollectionService } from '@/standups/answer-collection.service';
import { SlackMessagingService } from '@/integrations/slack/slack-messaging.service';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import {
  UpdateInstanceStateDto,
  StandupInstanceState,
} from '@/standups/dto/update-instance-state.dto';
import { SubmitAnswersDto } from '@/standups/dto/submit-answers.dto';

describe('StandupInstanceController', () => {
  let controller: StandupInstanceController;
  let mockStandupInstanceService: jest.Mocked<StandupInstanceService>;
  let mockAnswerCollectionService: jest.Mocked<AnswerCollectionService>;
  let mockSlackMessagingService: jest.Mocked<SlackMessagingService>;
  let mockPrismaService: jest.Mocked<PrismaService>;

  const mockOrgId = 'org-123';
  const mockUserId = 'user-123';
  const mockInstanceId = 'instance-123';
  const mockTeamId = 'team-123';

  beforeEach(async () => {
    mockStandupInstanceService = {
      getActiveInstances: jest.fn(),
      getInstanceWithDetails: jest.fn(),
      updateInstanceState: jest.fn(),
      getInstanceParticipation: jest.fn(),
      getParticipatingMembers: jest.fn(),
      isInstanceComplete: jest.fn(),
      calculateResponseRate: jest.fn(),
      createInstancesForDate: jest.fn(),
      calculateNextStandupDate: jest.fn(),
      teamExists: jest.fn(),
      shouldCreateStandupToday: jest.fn(),
    } as unknown as jest.Mocked<StandupInstanceService>;

    mockAnswerCollectionService = {
      submitFullResponse: jest.fn(),
    } as unknown as jest.Mocked<AnswerCollectionService>;

    mockSlackMessagingService = {
      sendStandupReminder: jest.fn(),
    } as unknown as jest.Mocked<SlackMessagingService>;

    mockPrismaService = {
      teamMember: {
        findFirst: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StandupInstanceController],
      providers: [
        { provide: StandupInstanceService, useValue: mockStandupInstanceService },
        { provide: AnswerCollectionService, useValue: mockAnswerCollectionService },
        { provide: SlackMessagingService, useValue: mockSlackMessagingService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<StandupInstanceController>(StandupInstanceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getActiveInstances', () => {
    it('should return active standup instances', async () => {
      const mockInstances = [
        {
          id: 'instance1',
          teamId: 'team1',
          teamName: 'Team 1',
          targetDate: '2024-01-15',
          state: 'collecting',
          configSnapshot: {
            questions: ['Q1', 'Q2'],
            responseTimeoutHours: 2,
            reminderMinutesBefore: 10,
            participatingMembers: [{ id: 'member1', name: 'Member 1', platformUserId: 'user1' }],
            timezone: 'UTC',
            timeLocal: '09:00',
          },
          createdAt: new Date(),
          totalMembers: 5,
          respondedMembers: 3,
          responseRate: 60,
        },
        {
          id: 'instance2',
          teamId: 'team2',
          teamName: 'Team 2',
          targetDate: '2024-01-16',
          state: 'pending',
          configSnapshot: {
            questions: ['Q1', 'Q2'],
            responseTimeoutHours: 2,
            reminderMinutesBefore: 15,
            participatingMembers: [{ id: 'member2', name: 'Member 2', platformUserId: 'user2' }],
            timezone: 'UTC',
            timeLocal: '10:00',
          },
          createdAt: new Date(),
          totalMembers: 4,
          respondedMembers: 2,
          responseRate: 50,
        },
      ];
      mockStandupInstanceService.getActiveInstances.mockResolvedValue(mockInstances);

      const result = await controller.getActiveInstances(mockOrgId, mockTeamId, 10, 0);

      expect(result).toEqual(mockInstances);
      expect(mockStandupInstanceService.getActiveInstances).toHaveBeenCalledWith(
        mockOrgId,
        mockTeamId,
        10,
        0,
      );
    });
  });

  describe('getInstanceDetails', () => {
    it('should return instance details with answers', async () => {
      const mockInstance = {
        id: mockInstanceId,
        teamId: mockTeamId,
        teamName: 'Test Team',
        targetDate: '2024-01-15',
        state: 'collecting',
        configSnapshot: {
          questions: ['Q1', 'Q2'],
          responseTimeoutHours: 2,
          reminderMinutesBefore: 10,
          participatingMembers: [{ id: 'member1', name: 'Member 1', platformUserId: 'user1' }],
          timezone: 'UTC',
          timeLocal: '09:00',
        },
        createdAt: new Date(),
        totalMembers: 5,
        respondedMembers: 3,
        responseRate: 60,
        answers: [{ questionIndex: 0, text: 'Answer 1' }],
      };
      mockStandupInstanceService.getInstanceWithDetails.mockResolvedValue(mockInstance);

      const result = await controller.getInstanceDetails(mockInstanceId, mockOrgId);

      expect(result).toEqual(mockInstance);
      expect(mockStandupInstanceService.getInstanceWithDetails).toHaveBeenCalledWith(
        mockInstanceId,
        mockOrgId,
      );
    });
  });

  describe('updateInstanceState', () => {
    it('should update instance state', async () => {
      const updateDto: UpdateInstanceStateDto = { state: StandupInstanceState.POSTED };
      mockStandupInstanceService.updateInstanceState.mockResolvedValue(undefined);

      const result = await controller.updateInstanceState(
        mockInstanceId,
        updateDto,
        mockUserId,
        mockOrgId,
      );

      expect(result).toEqual({ success: true });
      expect(mockStandupInstanceService.updateInstanceState).toHaveBeenCalledWith(
        mockInstanceId,
        StandupInstanceState.POSTED,
        mockUserId,
        mockOrgId,
      );
    });
  });

  describe('submitAnswers', () => {
    it('should submit answers for standup instance', async () => {
      const submitDto: SubmitAnswersDto = {
        standupInstanceId: mockInstanceId,
        answers: [{ questionIndex: 0, text: 'My answer' }],
      };
      const mockInstance = { id: mockInstanceId, teamId: mockTeamId };
      const mockTeamMember = { id: 'member-123', teamId: mockTeamId, active: true };
      const mockResult = { success: true, answersSubmitted: 1 };

      mockStandupInstanceService.getInstanceWithDetails.mockResolvedValue(
        mockInstance as MockInstance & { answers: unknown[] },
      );
      (mockPrismaService.teamMember.findFirst as jest.Mock).mockResolvedValue(mockTeamMember);
      mockAnswerCollectionService.submitFullResponse.mockResolvedValue(mockResult);

      const result = await controller.submitAnswers(mockInstanceId, submitDto, mockOrgId);

      expect(result).toEqual(mockResult);
      expect(mockAnswerCollectionService.submitFullResponse).toHaveBeenCalledWith(
        submitDto,
        'member-123',
        mockOrgId,
      );
    });
  });

  describe('getParticipationStatus', () => {
    it('should return participation status', async () => {
      const mockStatus = {
        standupInstanceId: mockInstanceId,
        state: 'collecting',
        targetDate: '2024-01-15',
        totalMembers: 5,
        respondedMembers: 3,
        responseRate: 60,
        completionRate: 40,
        memberStatus: [],
        canStillSubmit: true,
      };
      mockStandupInstanceService.getInstanceParticipation.mockResolvedValue(
        mockStatus as MockParticipationStatus,
      );

      const result = await controller.getParticipationStatus(mockInstanceId, mockOrgId);

      expect(result).toEqual(mockStatus);
      expect(mockStandupInstanceService.getInstanceParticipation).toHaveBeenCalledWith(
        mockInstanceId,
        mockOrgId,
      );
    });
  });

  describe('getParticipatingMembers', () => {
    it('should return participating members', async () => {
      const mockMembers = [
        { id: 'member1', name: 'Member 1', platformUserId: 'slack-user-1' },
        { id: 'member2', name: 'Member 2', platformUserId: 'slack-user-2' },
      ];
      mockStandupInstanceService.getParticipatingMembers.mockResolvedValue(mockMembers);

      const result = await controller.getParticipatingMembers(mockInstanceId);

      expect(result).toEqual(mockMembers);
      expect(mockStandupInstanceService.getParticipatingMembers).toHaveBeenCalledWith(
        mockInstanceId,
      );
    });
  });

  describe('checkCompletion', () => {
    it('should check if instance is complete', async () => {
      mockStandupInstanceService.isInstanceComplete.mockResolvedValue(true);
      mockStandupInstanceService.calculateResponseRate.mockResolvedValue(85);

      const result = await controller.checkCompletion(mockInstanceId, mockOrgId);

      expect(result).toEqual({ isComplete: true, responseRate: 85 });
      expect(mockStandupInstanceService.isInstanceComplete).toHaveBeenCalledWith(
        mockInstanceId,
        mockOrgId,
      );
      expect(mockStandupInstanceService.calculateResponseRate).toHaveBeenCalledWith(
        mockInstanceId,
        mockOrgId,
      );
    });
  });

  describe('createInstancesForDate', () => {
    it('should create instances for date', async () => {
      const body = { targetDate: '2024-01-15' };
      const mockResult = { created: ['instance1', 'instance2'], skipped: [] };
      mockStandupInstanceService.createInstancesForDate.mockResolvedValue(mockResult);

      const result = await controller.createInstancesForDate(body);

      expect(result).toEqual(mockResult);
      expect(mockStandupInstanceService.createInstancesForDate).toHaveBeenCalledWith(
        new Date('2024-01-15'),
      );
    });
  });

  describe('createInstancesAndTrigger', () => {
    it('should create instances and send Slack messages', async () => {
      const body = { targetDate: '2024-01-15' };
      const mockCreateResult = { created: ['instance1'], skipped: [] };
      const mockMessageResult = { ok: true, ts: 'message-ts-123' };

      mockStandupInstanceService.createInstancesForDate.mockResolvedValue(mockCreateResult);
      mockSlackMessagingService.sendStandupReminder.mockResolvedValue(mockMessageResult);

      const result = await controller.createInstancesAndTrigger(body);

      expect(result).toEqual({
        created: ['instance1'],
        skipped: [],
        messages: [{ instanceId: 'instance1', success: true, error: undefined }],
      });
    });
  });

  describe('triggerReminder', () => {
    it('should trigger Slack reminder for instance', async () => {
      const mockInstance = { id: mockInstanceId, teamId: mockTeamId };
      const mockMessageResult = { ok: true, ts: 'message-ts-123' };

      mockStandupInstanceService.getInstanceWithDetails.mockResolvedValue(
        mockInstance as MockInstance & { answers: unknown[] },
      );
      mockSlackMessagingService.sendStandupReminder.mockResolvedValue(mockMessageResult);

      const result = await controller.triggerReminder(mockInstanceId, mockOrgId);

      expect(result).toEqual({
        success: true,
        messageTs: 'message-ts-123',
        error: undefined,
      });
    });
  });

  describe('getNextStandupDate', () => {
    it('should return next standup date for team', async () => {
      const nextDate = new Date('2024-01-16');
      mockStandupInstanceService.calculateNextStandupDate.mockResolvedValue(nextDate);
      mockStandupInstanceService.teamExists.mockResolvedValue(true);

      const result = await controller.getNextStandupDate(mockTeamId);

      expect(result).toEqual({ nextStandupDate: '2024-01-16' });
      expect(mockStandupInstanceService.calculateNextStandupDate).toHaveBeenCalledWith(mockTeamId);
    });
  });

  describe('shouldCreateToday', () => {
    it('should check if team should create standup today', async () => {
      mockStandupInstanceService.shouldCreateStandupToday.mockResolvedValue(true);

      const result = await controller.shouldCreateToday(mockTeamId, '2024-01-15');

      expect(result).toEqual({
        shouldCreate: true,
        date: '2024-01-15',
      });
      expect(mockStandupInstanceService.shouldCreateStandupToday).toHaveBeenCalledWith(
        mockTeamId,
        new Date('2024-01-15'),
      );
    });
  });
});
