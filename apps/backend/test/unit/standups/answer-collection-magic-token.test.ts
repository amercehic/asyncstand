import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { AnswerCollectionService } from '@/standups/answer-collection.service';
import { MagicTokenService } from '@/standups/services/magic-token.service';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { LoggerService } from '@/common/logger.service';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { MagicSubmitAnswersDto } from '@/standups/dto/magic-submit-answers.dto';

describe('AnswerCollectionService - Magic Token Methods', () => {
  let service: AnswerCollectionService;
  let mockMagicTokenService: jest.Mocked<MagicTokenService>;
  let mockPrismaService: {
    standupInstance: {
      findFirst: jest.Mock;
    };
    teamMember: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let mockAuditLogService: jest.Mocked<AuditLogService>;
  let mockLogger: jest.Mocked<LoggerService>;

  const mockInstanceId = 'instance-123';
  const mockTeamMemberId = 'member-123';
  const mockPlatformUserId = 'platform-user-123';
  const mockOrgId = 'org-123';
  const mockToken = 'valid-magic-token';

  const mockTokenPayload = {
    standupInstanceId: mockInstanceId,
    teamMemberId: mockTeamMemberId,
    platformUserId: mockPlatformUserId,
    orgId: mockOrgId,
  };

  const mockInstance = {
    id: mockInstanceId,
    teamId: 'team-123',
    state: 'collecting',
    createdAt: new Date('2024-01-01T10:00:00Z'),
    configSnapshot: {
      questions: ['What did you work on?', 'What are you working on today?'],
      responseTimeoutHours: 24,
      participatingMembers: [
        {
          id: mockTeamMemberId,
          name: 'John Doe',
          platformUserId: mockPlatformUserId,
        },
      ],
    },
    team: {
      id: 'team-123',
      name: 'Engineering Team',
      orgId: mockOrgId,
      members: [
        {
          id: mockTeamMemberId,
          name: 'John Doe',
          platformUserId: mockPlatformUserId,
          active: true,
          integrationUser: {
            name: 'john.doe',
          },
        },
      ],
    },
  };

  const mockTeamMember = {
    id: mockTeamMemberId,
    teamId: 'team-123',
    active: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnswerCollectionService,
        {
          provide: MagicTokenService,
          useValue: {
            validateMagicToken: jest.fn(),
            generateMagicToken: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            standupInstance: {
              findFirst: jest.fn(),
            },
            teamMember: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            log: jest.fn(),
          },
        },
        {
          provide: LoggerService,
          useValue: {
            setContext: jest.fn(),
            info: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AnswerCollectionService>(AnswerCollectionService);
    mockMagicTokenService = module.get(MagicTokenService);
    mockPrismaService = module.get(PrismaService) as typeof mockPrismaService;
    mockAuditLogService = module.get(AuditLogService);
    mockLogger = module.get(LoggerService);

    jest.clearAllMocks();

    // Mock current time to be within response window
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T20:00:00Z')); // 10 hours after creation
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('submitResponseWithMagicToken', () => {
    const validSubmissionData: MagicSubmitAnswersDto = {
      magicToken: mockToken,
      answers: [
        {
          questionIndex: 0,
          text: 'I worked on implementing the magic token system.',
        },
        {
          questionIndex: 1,
          text: 'Today I will work on creating tests for the system.',
        },
      ],
    };

    beforeEach(() => {
      mockMagicTokenService.validateMagicToken.mockResolvedValue(mockTokenPayload);
      mockPrismaService.standupInstance.findFirst.mockResolvedValue(mockInstance);
      mockPrismaService.teamMember.findFirst.mockResolvedValue(mockTeamMember);
      mockPrismaService.teamMember.findUnique.mockResolvedValue({ userId: 'user-123' });
      mockPrismaService.$transaction.mockImplementation((callback) =>
        callback({
          answer: {
            upsert: jest.fn().mockResolvedValue({}),
          },
        }),
      );
    });

    it('should successfully submit responses with valid magic token', async () => {
      mockPrismaService.$transaction.mockResolvedValue(2);

      const result = await service.submitResponseWithMagicToken(validSubmissionData);

      expect(mockMagicTokenService.validateMagicToken).toHaveBeenCalledWith(mockToken);
      expect(mockPrismaService.standupInstance.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockInstanceId,
          team: { orgId: mockOrgId },
        },
        include: {
          team: true,
        },
      });
      expect(mockPrismaService.teamMember.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockTeamMemberId,
          teamId: 'team-123',
          active: true,
        },
      });

      expect(result).toEqual({
        success: true,
        answersSubmitted: 2,
      });

      // Audit logging is now handled by the @Audit decorator in the controller, not in the service
      expect(mockAuditLogService.log).not.toHaveBeenCalled();
    });

    it('should throw error for invalid magic token', async () => {
      mockMagicTokenService.validateMagicToken.mockResolvedValue(null);

      await expect(service.submitResponseWithMagicToken(validSubmissionData)).rejects.toThrow(
        new ApiError(
          ErrorCode.UNAUTHENTICATED,
          'Invalid or expired magic token',
          HttpStatus.UNAUTHORIZED,
        ),
      );

      expect(mockPrismaService.standupInstance.findFirst).not.toHaveBeenCalled();
    });

    it('should throw error when standup instance not found', async () => {
      mockPrismaService.standupInstance.findFirst.mockResolvedValue(null);

      await expect(service.submitResponseWithMagicToken(validSubmissionData)).rejects.toThrow(
        new ApiError(ErrorCode.NOT_FOUND, 'Standup instance not found', HttpStatus.NOT_FOUND),
      );
    });

    it('should throw error when team member not found', async () => {
      mockPrismaService.teamMember.findFirst.mockResolvedValue(null);

      await expect(service.submitResponseWithMagicToken(validSubmissionData)).rejects.toThrow(
        new ApiError(ErrorCode.NOT_FOUND, 'Team member not found', HttpStatus.NOT_FOUND),
      );
    });

    it('should throw error when response window has closed', async () => {
      // Set time to be after response window
      jest.setSystemTime(new Date('2024-01-02T11:00:00Z')); // 25 hours after creation

      await expect(service.submitResponseWithMagicToken(validSubmissionData)).rejects.toThrow(
        new ApiError(
          ErrorCode.VALIDATION_FAILED,
          'Response collection window has closed',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should throw error for invalid question index', async () => {
      const invalidSubmissionData: MagicSubmitAnswersDto = {
        magicToken: mockToken,
        answers: [
          {
            questionIndex: 5, // Invalid index (only 2 questions exist)
            text: 'Invalid answer',
          },
        ],
      };

      await expect(service.submitResponseWithMagicToken(invalidSubmissionData)).rejects.toThrow(
        new ApiError(
          ErrorCode.VALIDATION_FAILED,
          'Invalid question index: 5',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should validate negative question index', async () => {
      const invalidSubmissionData: MagicSubmitAnswersDto = {
        magicToken: mockToken,
        answers: [
          {
            questionIndex: -1,
            text: 'Invalid answer',
          },
        ],
      };

      await expect(service.submitResponseWithMagicToken(invalidSubmissionData)).rejects.toThrow(
        new ApiError(
          ErrorCode.VALIDATION_FAILED,
          'Invalid question index: -1',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should handle transaction properly with multiple answers', async () => {
      const mockTransaction = {
        answer: {
          upsert: jest.fn().mockResolvedValue({}),
        },
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        await callback(mockTransaction);
        return validSubmissionData.answers.length;
      });

      await service.submitResponseWithMagicToken(validSubmissionData);

      expect(mockTransaction.answer.upsert).toHaveBeenCalledTimes(2);
      expect(mockTransaction.answer.upsert).toHaveBeenCalledWith({
        where: {
          standupInstanceId_teamMemberId_questionIndex: {
            standupInstanceId: mockInstanceId,
            teamMemberId: mockTeamMemberId,
            questionIndex: 0,
          },
        },
        update: {
          text: 'I worked on implementing the magic token system.',
          submittedAt: expect.any(Date),
        },
        create: {
          standupInstanceId: mockInstanceId,
          teamMemberId: mockTeamMemberId,
          questionIndex: 0,
          text: 'I worked on implementing the magic token system.',
        },
      });
    });
  });

  describe('generateMagicTokensForInstance', () => {
    beforeEach(() => {
      mockMagicTokenService.generateMagicToken.mockResolvedValue({
        token: 'generated-token',
        expiresAt: new Date(),
        submissionUrl: 'http://localhost:3000/standup/respond/generated-token',
      });
    });

    it('should generate magic tokens for all participating members', async () => {
      mockPrismaService.standupInstance.findFirst.mockResolvedValue(mockInstance);

      const result = await service.generateMagicTokensForInstance(mockInstanceId, mockOrgId);

      expect(mockPrismaService.standupInstance.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockInstanceId,
          team: { orgId: mockOrgId },
        },
        include: {
          team: {
            include: {
              members: {
                where: { active: true },
                include: {
                  integrationUser: true,
                },
              },
            },
          },
        },
      });

      expect(mockMagicTokenService.generateMagicToken).toHaveBeenCalledWith(
        mockInstanceId,
        mockTeamMemberId,
        mockPlatformUserId,
        mockOrgId,
        24, // responseTimeoutHours from config snapshot
      );

      expect(result).toEqual([
        {
          teamMemberId: mockTeamMemberId,
          memberName: 'John Doe',
          magicToken: 'generated-token',
          submissionUrl: 'http://localhost:3000/standup/respond/generated-token',
        },
      ]);
    });

    it('should throw error when standup instance not found', async () => {
      mockPrismaService.standupInstance.findFirst.mockResolvedValue(null);

      await expect(
        service.generateMagicTokensForInstance(mockInstanceId, mockOrgId),
      ).rejects.toThrow(
        new ApiError(ErrorCode.NOT_FOUND, 'Standup instance not found', HttpStatus.NOT_FOUND),
      );
    });

    it('should only generate tokens for participating members', async () => {
      const instanceWithNonParticipatingMember = {
        ...mockInstance,
        team: {
          ...mockInstance.team,
          members: [
            ...mockInstance.team.members,
            {
              id: 'non-participating-member',
              name: 'Jane Doe',
              platformUserId: 'jane-platform-id',
              active: true,
              integrationUser: { name: 'jane.doe' },
            },
          ],
        },
      };

      mockPrismaService.standupInstance.findFirst.mockResolvedValue(
        instanceWithNonParticipatingMember,
      );

      const result = await service.generateMagicTokensForInstance(mockInstanceId, mockOrgId);

      expect(mockMagicTokenService.generateMagicToken).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
      expect(result[0].teamMemberId).toBe(mockTeamMemberId);
    });

    it('should handle member name fallback gracefully', async () => {
      const instanceWithMemberWithoutName = {
        ...mockInstance,
        team: {
          ...mockInstance.team,
          members: [
            {
              id: mockTeamMemberId,
              name: null,
              platformUserId: mockPlatformUserId,
              active: true,
              integrationUser: {
                name: 'john.doe',
              },
            },
          ],
        },
      };

      mockPrismaService.standupInstance.findFirst.mockResolvedValue(instanceWithMemberWithoutName);

      const result = await service.generateMagicTokensForInstance(mockInstanceId, mockOrgId);

      expect(result[0].memberName).toBe('john.doe');
    });

    it('should handle member with no name gracefully', async () => {
      const instanceWithMemberWithoutAnyName = {
        ...mockInstance,
        team: {
          ...mockInstance.team,
          members: [
            {
              id: mockTeamMemberId,
              name: null,
              platformUserId: mockPlatformUserId,
              active: true,
              integrationUser: null,
            },
          ],
        },
      };

      mockPrismaService.standupInstance.findFirst.mockResolvedValue(
        instanceWithMemberWithoutAnyName,
      );

      const result = await service.generateMagicTokensForInstance(mockInstanceId, mockOrgId);

      expect(result[0].memberName).toBe('Unknown');
    });

    it('should handle token generation failures gracefully', async () => {
      const instanceWithMultipleMembers = {
        ...mockInstance,
        configSnapshot: {
          ...mockInstance.configSnapshot,
          participatingMembers: [
            {
              id: mockTeamMemberId,
              name: 'John Doe',
              platformUserId: mockPlatformUserId,
            },
            {
              id: 'member-2',
              name: 'Jane Doe',
              platformUserId: 'jane-platform-id',
            },
          ],
        },
        team: {
          ...mockInstance.team,
          members: [
            ...mockInstance.team.members,
            {
              id: 'member-2',
              name: 'Jane Doe',
              platformUserId: 'jane-platform-id',
              active: true,
              integrationUser: { name: 'jane.doe' },
            },
          ],
        },
      };

      mockPrismaService.standupInstance.findFirst.mockResolvedValue(instanceWithMultipleMembers);

      // Mock first token generation to succeed, second to fail
      mockMagicTokenService.generateMagicToken
        .mockResolvedValueOnce({
          token: 'token-1',
          expiresAt: new Date(),
          submissionUrl: 'http://localhost:3000/standup/respond/token-1',
        })
        .mockRejectedValueOnce(new Error('Token generation failed'));

      const result = await service.generateMagicTokensForInstance(mockInstanceId, mockOrgId);

      expect(result).toHaveLength(1); // Only successful token generation
      expect(result[0].teamMemberId).toBe(mockTeamMemberId);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to generate magic token for member', {
        memberId: 'member-2',
        memberName: 'Jane Doe',
        error: 'Token generation failed',
      });
    });

    it('should return empty array when no participating members are active', async () => {
      const instanceWithInactiveMembers = {
        ...mockInstance,
        team: {
          ...mockInstance.team,
          members: [], // No active members
        },
      };

      mockPrismaService.standupInstance.findFirst.mockResolvedValue(instanceWithInactiveMembers);

      const result = await service.generateMagicTokensForInstance(mockInstanceId, mockOrgId);

      expect(result).toEqual([]);
      expect(mockMagicTokenService.generateMagicToken).not.toHaveBeenCalled();
    });
  });
});
