import { Test, TestingModule } from '@nestjs/testing';
import { AnswerCollectionController } from '@/standups/answer-collection.controller';
import { AnswerCollectionService } from '@/standups/answer-collection.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { SubmitAnswerDto } from '@/standups/dto/submit-answer.dto';
import { SubmitAnswersDto } from '@/standups/dto/submit-answers.dto';

describe('AnswerCollectionController', () => {
  let controller: AnswerCollectionController;
  let mockAnswerCollectionService: jest.Mocked<AnswerCollectionService>;

  const mockOrgId = 'org-123';
  const mockUserId = 'user-123';
  const mockInstanceId = 'instance-123';
  const mockMemberId = 'member-123';
  const mockTeamId = 'team-123';

  beforeEach(async () => {
    mockAnswerCollectionService = {
      submitAnswer: jest.fn(),
      submitFullResponse: jest.fn(),
      getAnswers: jest.fn(),
      getMissingAnswers: jest.fn(),
      isResponseComplete: jest.fn(),
      calculateCompletionStats: jest.fn(),
      deleteMemberResponses: jest.fn(),
      generateParticipationSnapshot: jest.fn(),
      getResponseHistory: jest.fn(),
    } as unknown as jest.Mocked<AnswerCollectionService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnswerCollectionController],
      providers: [{ provide: AnswerCollectionService, useValue: mockAnswerCollectionService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<AnswerCollectionController>(AnswerCollectionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('submitAnswer', () => {
    it('should submit a single answer', async () => {
      const submitDto: SubmitAnswerDto = {
        standupInstanceId: mockInstanceId,
        questionIndex: 0,
        text: 'My answer',
      };
      const expectedResult = { success: true };
      mockAnswerCollectionService.submitAnswer.mockResolvedValue(expectedResult);

      const result = await controller.submitAnswer(submitDto, mockUserId, mockOrgId);

      expect(result).toEqual(expectedResult);
      expect(mockAnswerCollectionService.submitAnswer).toHaveBeenCalledWith(
        submitDto,
        mockUserId,
        mockOrgId,
      );
    });
  });

  describe('submitBulkAnswers', () => {
    it('should submit multiple answers at once', async () => {
      const submitDto: SubmitAnswersDto = {
        standupInstanceId: mockInstanceId,
        answers: [
          { questionIndex: 0, text: 'Answer 1' },
          { questionIndex: 1, text: 'Answer 2' },
        ],
      };
      const expectedResult = { success: true, answersSubmitted: 2 };
      mockAnswerCollectionService.submitFullResponse.mockResolvedValue(expectedResult);

      const result = await controller.submitBulkAnswers(submitDto, mockUserId, mockOrgId);

      expect(result).toEqual(expectedResult);
      expect(mockAnswerCollectionService.submitFullResponse).toHaveBeenCalledWith(
        submitDto,
        mockUserId,
        mockOrgId,
      );
    });
  });

  describe('getInstanceAnswers', () => {
    it('should get answers for an instance', async () => {
      const expectedAnswers = [
        {
          teamMemberId: 'member1',
          memberName: 'Member 1',
          answers: [{ questionIndex: 0, text: 'Answer', submittedAt: new Date() }],
          isComplete: true,
          questionsAnswered: 1,
          totalQuestions: 3,
        },
      ];
      mockAnswerCollectionService.getAnswers.mockResolvedValue(expectedAnswers);

      const result = await controller.getInstanceAnswers(mockInstanceId, mockOrgId);

      expect(result).toEqual(expectedAnswers);
      expect(mockAnswerCollectionService.getAnswers).toHaveBeenCalledWith(
        mockInstanceId,
        mockOrgId,
        undefined,
      );
    });
  });

  describe('getMissingAnswers', () => {
    it('should get missing answers for a member', async () => {
      const expectedMissing = [
        { questionIndex: 1, question: 'What will you work on today?' },
        { questionIndex: 2, question: 'Any blockers?' },
      ];
      mockAnswerCollectionService.getMissingAnswers.mockResolvedValue(expectedMissing);

      const result = await controller.getMissingAnswers(mockInstanceId, mockMemberId, mockOrgId);

      expect(result).toEqual(expectedMissing);
      expect(mockAnswerCollectionService.getMissingAnswers).toHaveBeenCalledWith(
        mockInstanceId,
        mockMemberId,
        mockOrgId,
      );
    });
  });

  describe('checkMemberCompletion', () => {
    it('should check if member has completed response', async () => {
      mockAnswerCollectionService.isResponseComplete.mockResolvedValue(true);

      const result = await controller.checkMemberCompletion(mockInstanceId, mockMemberId);

      expect(result).toEqual({ isComplete: true });
      expect(mockAnswerCollectionService.isResponseComplete).toHaveBeenCalledWith(
        mockInstanceId,
        mockMemberId,
      );
    });
  });

  describe('getCompletionStats', () => {
    it('should get completion statistics for an instance', async () => {
      const expectedStats = {
        totalMembers: 5,
        respondedMembers: 4,
        completeMembers: 3,
        averageResponseTime: 15,
        responseRate: 80,
        completionRate: 60,
      };
      mockAnswerCollectionService.calculateCompletionStats.mockResolvedValue(expectedStats);

      const result = await controller.getCompletionStats(mockInstanceId);

      expect(result).toEqual(expectedStats);
      expect(mockAnswerCollectionService.calculateCompletionStats).toHaveBeenCalledWith(
        mockInstanceId,
      );
    });
  });

  describe('deleteMemberResponses', () => {
    it('should delete member responses from an instance', async () => {
      const mockResult = { deleted: 3 };
      mockAnswerCollectionService.deleteMemberResponses.mockResolvedValue(mockResult);

      const result = await controller.deleteMemberResponses(
        mockInstanceId,
        mockMemberId,
        mockOrgId,
      );

      expect(result).toEqual({ success: true, deleted: 3 });
      expect(mockAnswerCollectionService.deleteMemberResponses).toHaveBeenCalledWith(
        mockInstanceId,
        mockMemberId,
        mockOrgId,
      );
    });
  });

  describe('generateParticipationSnapshot', () => {
    it('should generate participation snapshot', async () => {
      const mockResult = { id: 'snapshot-123' };
      mockAnswerCollectionService.generateParticipationSnapshot.mockResolvedValue(mockResult);

      const result = await controller.generateParticipationSnapshot(mockInstanceId);

      expect(result).toEqual({ success: true, snapshotId: 'snapshot-123' });
      expect(mockAnswerCollectionService.generateParticipationSnapshot).toHaveBeenCalledWith(
        mockInstanceId,
      );
    });
  });

  describe('getTeamResponseHistory', () => {
    it('should get response history for a team', async () => {
      const expectedHistory = [
        {
          date: '2024-01-15',
          instanceId: 'instance1',
          totalMembers: 5,
          respondedMembers: 4,
          responseRate: 80,
          state: 'completed',
        },
      ];
      mockAnswerCollectionService.getResponseHistory.mockResolvedValue(expectedHistory);

      const result = await controller.getTeamResponseHistory(mockTeamId, mockOrgId);

      expect(result).toEqual(expectedHistory);
      expect(mockAnswerCollectionService.getResponseHistory).toHaveBeenCalledWith(
        mockTeamId,
        mockOrgId,
        expect.any(Date),
        expect.any(Date),
      );
    });
  });

  describe('getMyAnswers', () => {
    it('should get current user answers for an instance', async () => {
      const mockAnswers = [
        {
          teamMemberId: mockUserId,
          memberName: 'Test User',
          answers: [{ questionIndex: 0, text: 'My answer', submittedAt: new Date() }],
          isComplete: false,
          questionsAnswered: 1,
          totalQuestions: 3,
        },
      ];
      mockAnswerCollectionService.getAnswers.mockResolvedValue(mockAnswers);
      mockAnswerCollectionService.isResponseComplete.mockResolvedValue(false);

      const result = await controller.getMyAnswers(mockInstanceId, mockUserId, mockOrgId);

      expect(result).toEqual({
        answers: mockAnswers[0].answers,
        isComplete: false,
        questionsAnswered: 1,
        totalQuestions: 3,
        canStillSubmit: true,
      });
      expect(mockAnswerCollectionService.getAnswers).toHaveBeenCalledWith(
        mockInstanceId,
        mockOrgId,
        mockUserId,
      );
    });
  });

  describe('getMyMissingAnswers', () => {
    it('should get current user missing answers for an instance', async () => {
      const expectedMissing = [{ questionIndex: 1, question: 'What will you work on today?' }];
      mockAnswerCollectionService.getMissingAnswers.mockResolvedValue(expectedMissing);

      const result = await controller.getMyMissingAnswers(mockInstanceId, mockUserId, mockOrgId);

      expect(result).toEqual(expectedMissing);
      expect(mockAnswerCollectionService.getMissingAnswers).toHaveBeenCalledWith(
        mockInstanceId,
        mockUserId,
        mockOrgId,
      );
    });
  });
});
