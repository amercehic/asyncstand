import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { MagicTokenController } from '@/standups/controllers/magic-token.controller';
import { MagicTokenService } from '@/standups/services/magic-token.service';
import { MagicTokenGuard } from '@/standups/guards/magic-token.guard';
import { AnswerCollectionService } from '@/standups/answer-collection.service';
import { LoggerService } from '@/common/logger.service';

describe('Magic Token Middleware Integration', () => {
  let app: INestApplication;
  let mockMagicTokenService: jest.Mocked<MagicTokenService>;
  let mockAnswerCollectionService: jest.Mocked<AnswerCollectionService>;

  const mockTokenPayload = {
    standupInstanceId: 'instance-123',
    teamMemberId: 'member-123',
    platformUserId: 'platform-user-123',
    orgId: 'org-123',
  };

  const mockStandupInfo = {
    instance: {
      id: 'instance-123',
      targetDate: new Date('2024-01-01'),
      createdAt: new Date('2024-01-01T10:00:00Z'),
      state: 'collecting' as const,
      timeoutAt: new Date('2024-01-02T10:00:00Z'),
    },
    team: {
      id: 'team-123',
      name: 'Engineering Team',
    },
    member: {
      id: 'member-123',
      name: 'John Doe',
      platformUserId: 'platform-user-123',
    },
    questions: ['What did you work on?', 'What are you working on today?'],
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [MagicTokenController],
      providers: [
        MagicTokenGuard,
        {
          provide: MagicTokenService,
          useValue: {
            validateMagicToken: jest.fn(),
            getStandupInfoForToken: jest.fn(),
            hasExistingResponses: jest.fn(),
          },
        },
        {
          provide: AnswerCollectionService,
          useValue: {
            submitFullResponse: jest.fn(),
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

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    mockMagicTokenService = moduleFixture.get(MagicTokenService);
    mockAnswerCollectionService = moduleFixture.get(AnswerCollectionService);

    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /magic-token/validate', () => {
    it('should validate token from Authorization header', async () => {
      mockMagicTokenService.validateMagicToken.mockResolvedValue(mockTokenPayload);

      const response = await request(app.getHttpServer())
        .get('/magic-token/validate')
        .set('Authorization', 'Bearer valid-token-123')
        .expect(200);

      expect(response.body).toEqual({
        valid: true,
        tokenInfo: {
          standupInstanceId: 'instance-123',
          teamMemberId: 'member-123',
          platformUserId: 'platform-user-123',
          orgId: 'org-123',
        },
      });

      expect(mockMagicTokenService.validateMagicToken).toHaveBeenCalledWith('valid-token-123');
    });

    it('should validate token from query parameter', async () => {
      mockMagicTokenService.validateMagicToken.mockResolvedValue(mockTokenPayload);

      const response = await request(app.getHttpServer())
        .get('/magic-token/validate?token=query-token-123')
        .expect(200);

      expect(response.body).toEqual({
        valid: true,
        tokenInfo: mockTokenPayload,
      });

      expect(mockMagicTokenService.validateMagicToken).toHaveBeenCalledWith('query-token-123');
    });

    it('should return 401 when no token provided', async () => {
      const response = await request(app.getHttpServer()).get('/magic-token/validate').expect(401);

      expect(response.body.message).toBe('Magic token is required');
      expect(mockMagicTokenService.validateMagicToken).not.toHaveBeenCalled();
    });

    it('should return 401 when token is invalid', async () => {
      mockMagicTokenService.validateMagicToken.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get('/magic-token/validate')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.message).toBe('Invalid or expired magic token');
    });

    it('should return 401 when token validation fails', async () => {
      mockMagicTokenService.validateMagicToken.mockRejectedValue(new Error('Database error'));

      const response = await request(app.getHttpServer())
        .get('/magic-token/validate')
        .set('Authorization', 'Bearer error-token')
        .expect(401);

      expect(response.body.message).toBe('Token validation failed');
    });
  });

  describe('GET /magic-token/standup-info', () => {
    it('should return standup info for valid token', async () => {
      mockMagicTokenService.validateMagicToken.mockResolvedValue(mockTokenPayload);
      mockMagicTokenService.getStandupInfoForToken.mockResolvedValue(mockStandupInfo);
      mockMagicTokenService.hasExistingResponses.mockResolvedValue(false);

      const response = await request(app.getHttpServer())
        .get('/magic-token/standup-info')
        .set('Authorization', 'Bearer valid-token-123')
        .expect(200);

      expect(response.body).toEqual({
        instance: {
          ...mockStandupInfo.instance,
          targetDate: mockStandupInfo.instance.targetDate.toISOString(),
          createdAt: mockStandupInfo.instance.createdAt.toISOString(),
          timeoutAt: mockStandupInfo.instance.timeoutAt.toISOString(),
        },
        team: mockStandupInfo.team,
        member: mockStandupInfo.member,
        questions: mockStandupInfo.questions,
        hasExistingResponses: false,
      });

      expect(mockMagicTokenService.validateMagicToken).toHaveBeenCalledWith('valid-token-123');
      expect(mockMagicTokenService.getStandupInfoForToken).toHaveBeenCalledWith(mockTokenPayload);
      expect(mockMagicTokenService.hasExistingResponses).toHaveBeenCalledWith(
        'instance-123',
        'member-123',
      );
    });

    it('should return hasExistingResponses true when member has responses', async () => {
      mockMagicTokenService.validateMagicToken.mockResolvedValue(mockTokenPayload);
      mockMagicTokenService.getStandupInfoForToken.mockResolvedValue(mockStandupInfo);
      mockMagicTokenService.hasExistingResponses.mockResolvedValue(true);

      const response = await request(app.getHttpServer())
        .get('/magic-token/standup-info')
        .set('Authorization', 'Bearer valid-token-123')
        .expect(200);

      expect(response.body.hasExistingResponses).toBe(true);
    });

    it('should return 401 when token is invalid', async () => {
      mockMagicTokenService.validateMagicToken.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get('/magic-token/standup-info')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.message).toBe('Invalid or expired magic token');
      expect(mockMagicTokenService.getStandupInfoForToken).not.toHaveBeenCalled();
    });

    it('should handle error when standup info is not available', async () => {
      mockMagicTokenService.validateMagicToken.mockResolvedValue(mockTokenPayload);
      mockMagicTokenService.getStandupInfoForToken.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get('/magic-token/standup-info')
        .set('Authorization', 'Bearer valid-token-123')
        .expect(500);

      expect(response.body.message).toBe('Internal server error');
    });
  });

  describe('Token extraction priority', () => {
    it('should prioritize Authorization header over query parameter', async () => {
      mockMagicTokenService.validateMagicToken.mockResolvedValue(mockTokenPayload);

      await request(app.getHttpServer())
        .get('/magic-token/validate?token=query-token')
        .set('Authorization', 'Bearer header-token')
        .expect(200);

      expect(mockMagicTokenService.validateMagicToken).toHaveBeenCalledWith('header-token');
    });

    it('should use query parameter when Authorization header is missing', async () => {
      mockMagicTokenService.validateMagicToken.mockResolvedValue(mockTokenPayload);

      await request(app.getHttpServer()).get('/magic-token/validate?token=query-token').expect(200);

      expect(mockMagicTokenService.validateMagicToken).toHaveBeenCalledWith('query-token');
    });
  });

  describe('Error handling', () => {
    it('should handle malformed Authorization header', async () => {
      const response = await request(app.getHttpServer())
        .get('/magic-token/validate')
        .set('Authorization', 'InvalidFormat token-123')
        .expect(401);

      expect(response.body.message).toBe('Magic token is required');
      expect(mockMagicTokenService.validateMagicToken).not.toHaveBeenCalled();
    });

    it('should handle empty token in Authorization header', async () => {
      mockMagicTokenService.validateMagicToken.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get('/magic-token/validate')
        .set('Authorization', 'Bearer ')
        .expect(401);

      expect(response.body.message).toBe('Magic token is required');
      expect(mockMagicTokenService.validateMagicToken).not.toHaveBeenCalled();
    });

    it('should handle service errors gracefully', async () => {
      mockMagicTokenService.validateMagicToken.mockRejectedValue(
        new Error('Unexpected service error'),
      );

      const response = await request(app.getHttpServer())
        .get('/magic-token/validate')
        .set('Authorization', 'Bearer valid-token')
        .expect(401);

      expect(response.body.message).toBe('Token validation failed');
    });
  });

  describe('POST /magic-token/submit', () => {
    const mockAnswers = [
      { questionIndex: 0, answer: 'I worked on the API endpoints' },
      { questionIndex: 1, answer: 'Today I will work on the frontend' },
    ];

    it('should submit responses with valid token', async () => {
      mockMagicTokenService.validateMagicToken.mockResolvedValue(mockTokenPayload);
      mockAnswerCollectionService.submitFullResponse.mockResolvedValue({
        success: true,
        answersSubmitted: 2,
      });

      const response = await request(app.getHttpServer())
        .post('/magic-token/submit')
        .set('Authorization', 'Bearer valid-token-123')
        .send({ answers: mockAnswers })
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        answersSubmitted: 2,
        message: 'Your standup responses have been submitted successfully!',
      });

      expect(mockAnswerCollectionService.submitFullResponse).toHaveBeenCalledWith(
        {
          standupInstanceId: 'instance-123',
          answers: [
            { questionIndex: 0, text: 'I worked on the API endpoints' },
            { questionIndex: 1, text: 'Today I will work on the frontend' },
          ],
        },
        'member-123',
        'org-123',
      );
    });

    it('should return 401 when token is invalid', async () => {
      mockMagicTokenService.validateMagicToken.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .post('/magic-token/submit')
        .set('Authorization', 'Bearer invalid-token')
        .send({ answers: mockAnswers })
        .expect(401);

      expect(response.body.message).toBe('Invalid or expired magic token');
      expect(mockAnswerCollectionService.submitFullResponse).not.toHaveBeenCalled();
    });

    it('should handle submission errors gracefully', async () => {
      mockMagicTokenService.validateMagicToken.mockResolvedValue(mockTokenPayload);
      mockAnswerCollectionService.submitFullResponse.mockRejectedValue(
        new Error('Standup instance not found'),
      );

      const response = await request(app.getHttpServer())
        .post('/magic-token/submit')
        .set('Authorization', 'Bearer valid-token-123')
        .send({ answers: mockAnswers })
        .expect(500);

      expect(response.body.message).toBe('Failed to submit responses');
    });

    it('should return 409 when responses already submitted', async () => {
      mockMagicTokenService.validateMagicToken.mockResolvedValue(mockTokenPayload);
      mockAnswerCollectionService.submitFullResponse.mockRejectedValue(
        new Error('Response already submitted for this standup'),
      );

      const response = await request(app.getHttpServer())
        .post('/magic-token/submit')
        .set('Authorization', 'Bearer valid-token-123')
        .send({ answers: mockAnswers })
        .expect(409);

      expect(response.body.message).toBe(
        'You have already submitted your responses for this standup',
      );
    });
  });
});
