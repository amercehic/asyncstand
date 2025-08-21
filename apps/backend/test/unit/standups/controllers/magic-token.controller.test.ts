import { Test, TestingModule } from '@nestjs/testing';
import { MagicTokenController } from '@/standups/controllers/magic-token.controller';
import { MagicTokenService, MagicTokenPayload } from '@/standups/services/magic-token.service';
import { AnswerCollectionService } from '@/standups/answer-collection.service';
import { LoggerService } from '@/common/logger.service';
import { MagicTokenGuard } from '@/standups/guards/magic-token.guard';
import { StandupInstanceState } from '@/standups/dto/update-instance-state.dto';

describe('MagicTokenController', () => {
  let controller: MagicTokenController;
  let mockMagicTokenService: jest.Mocked<MagicTokenService>;
  let mockAnswerCollectionService: jest.Mocked<AnswerCollectionService>;
  let mockLoggerService: jest.Mocked<LoggerService>;

  const mockTokenPayload: MagicTokenPayload = {
    standupInstanceId: 'instance-123',
    teamMemberId: 'member-123',
    platformUserId: 'slack-user-123',
    orgId: 'org-123',
  };

  beforeEach(async () => {
    mockMagicTokenService = {
      getStandupInfoForToken: jest.fn(),
      hasExistingResponses: jest.fn(),
    } as unknown as jest.Mocked<MagicTokenService>;

    mockAnswerCollectionService = {
      submitFullResponse: jest.fn(),
    } as unknown as jest.Mocked<AnswerCollectionService>;

    mockLoggerService = {
      setContext: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MagicTokenController],
      providers: [
        { provide: MagicTokenService, useValue: mockMagicTokenService },
        { provide: AnswerCollectionService, useValue: mockAnswerCollectionService },
        { provide: LoggerService, useValue: mockLoggerService },
      ],
    })
      .overrideGuard(MagicTokenGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<MagicTokenController>(MagicTokenController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getStandupInfo', () => {
    it('should return standup information for valid token', async () => {
      const mockStandupInfo = {
        instance: {
          id: 'instance-123',
          targetDate: new Date(),
          createdAt: new Date(),
          state: StandupInstanceState.COLLECTING,
          timeoutAt: new Date(),
        },
        team: {
          id: 'team-123',
          name: 'Engineering Team',
        },
        member: {
          id: 'member-123',
          name: 'John Doe',
          platformUserId: 'slack-user-123',
        },
        questions: ['What did you work on yesterday?', 'What are you working on today?'],
      };
      mockMagicTokenService.getStandupInfoForToken.mockResolvedValue(mockStandupInfo);
      mockMagicTokenService.hasExistingResponses.mockResolvedValue(false);

      const result = await controller.getStandupInfo(mockTokenPayload);

      expect(result).toEqual({
        ...mockStandupInfo,
        hasExistingResponses: false,
      });
      expect(mockMagicTokenService.getStandupInfoForToken).toHaveBeenCalledWith(mockTokenPayload);
      expect(mockMagicTokenService.hasExistingResponses).toHaveBeenCalledWith(
        'instance-123',
        'member-123',
      );
    });

    it('should throw error when standup info is not available', async () => {
      mockMagicTokenService.getStandupInfoForToken.mockResolvedValue(null);

      await expect(controller.getStandupInfo(mockTokenPayload)).rejects.toThrow(
        'Standup information not available',
      );
    });
  });

  describe('validateToken', () => {
    it('should return valid token info', async () => {
      const result = await controller.validateToken(mockTokenPayload);

      expect(result).toEqual({
        valid: true,
        tokenInfo: {
          standupInstanceId: 'instance-123',
          teamMemberId: 'member-123',
          platformUserId: 'slack-user-123',
          orgId: 'org-123',
        },
      });
    });
  });

  describe('submitResponses', () => {
    it('should submit responses successfully', async () => {
      const submitData = {
        answers: [
          { questionIndex: 0, answer: 'Yesterday I worked on the API' },
          { questionIndex: 1, answer: 'Today I will work on tests' },
        ],
      };
      const mockResult = { success: true, answersSubmitted: 2 };
      mockAnswerCollectionService.submitFullResponse.mockResolvedValue(mockResult);

      const result = await controller.submitResponses(mockTokenPayload, submitData);

      expect(result).toEqual({
        success: true,
        answersSubmitted: 2,
        message: 'Your standup responses have been submitted successfully!',
      });
      expect(mockAnswerCollectionService.submitFullResponse).toHaveBeenCalledWith(
        {
          standupInstanceId: 'instance-123',
          answers: [
            { questionIndex: 0, text: 'Yesterday I worked on the API' },
            { questionIndex: 1, text: 'Today I will work on tests' },
          ],
        },
        'member-123',
        'org-123',
      );
    });

    it('should handle already submitted responses error', async () => {
      const submitData = {
        answers: [{ questionIndex: 0, answer: 'Test answer' }],
      };
      const error = new Error('Responses already submitted');
      mockAnswerCollectionService.submitFullResponse.mockRejectedValue(error);

      await expect(controller.submitResponses(mockTokenPayload, submitData)).rejects.toThrow(
        'You have already submitted your responses for this standup',
      );
    });

    it('should handle standup not collecting responses error', async () => {
      const submitData = {
        answers: [{ questionIndex: 0, answer: 'Test answer' }],
      };
      const error = new Error('Standup not collecting responses');
      mockAnswerCollectionService.submitFullResponse.mockRejectedValue(error);

      await expect(controller.submitResponses(mockTokenPayload, submitData)).rejects.toThrow(
        'This standup is no longer accepting responses',
      );
    });

    it('should handle invalid question index error', async () => {
      const submitData = {
        answers: [{ questionIndex: 999, answer: 'Test answer' }],
      };
      const error = new Error('invalid question index provided');
      mockAnswerCollectionService.submitFullResponse.mockRejectedValue(error);

      await expect(controller.submitResponses(mockTokenPayload, submitData)).rejects.toThrow(
        'Invalid question index provided',
      );
    });

    it('should handle generic submission error', async () => {
      const submitData = {
        answers: [{ questionIndex: 0, answer: 'Test answer' }],
      };
      const error = new Error('Unknown error');
      mockAnswerCollectionService.submitFullResponse.mockRejectedValue(error);

      await expect(controller.submitResponses(mockTokenPayload, submitData)).rejects.toThrow(
        'Failed to submit responses',
      );
    });
  });
});
