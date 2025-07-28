import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from '../token.service';
import { PrismaService } from '@/prisma/prisma.service';
import { createMockPrismaService } from '../../../../test/utils/mocks/prisma.mock';
import { createMockJwtService } from '../../../../test/utils/mocks/services.mock';
import { TestHelpers } from '../../../../test/utils/test-helpers';

describe('TokenService', () => {
  let service: TokenService;
  let mockJwtService: ReturnType<typeof createMockJwtService>;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    mockJwtService = createMockJwtService();
    mockPrisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', async () => {
      const userId = TestHelpers.generateRandomString();
      const orgId = TestHelpers.generateRandomString();
      const ipAddress = '192.168.1.100';

      mockJwtService.sign
        .mockReturnValueOnce('mock_access_token')
        .mockReturnValueOnce('mock_refresh_token');

      const result = await service.generateTokens(userId, orgId, ipAddress);

      expect(mockJwtService.sign).toHaveBeenCalledTimes(2);

      // Check access token generation
      expect(mockJwtService.sign).toHaveBeenNthCalledWith(
        1,
        { sub: userId, orgId },
        { expiresIn: '15m' },
      );

      // Check refresh token generation
      expect(mockJwtService.sign).toHaveBeenNthCalledWith(
        2,
        { sub: userId, jti: expect.stringMatching(new RegExp(`${userId}-\\d+-\\d+`)) },
        { expiresIn: '7d' },
      );

      expect(result).toEqual({
        accessToken: 'mock_access_token',
        refreshToken: 'mock_refresh_token',
        expiresIn: 900,
      });
    });

    it('should store refresh token in database', async () => {
      const userId = TestHelpers.generateRandomString();
      const orgId = TestHelpers.generateRandomString();
      const ipAddress = '192.168.1.100';

      mockJwtService.sign.mockReturnValue('mock_refresh_token');

      await service.generateTokens(userId, orgId, ipAddress);

      expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith({
        data: {
          token: 'mock_refresh_token',
          user: { connect: { id: userId } },
          ipAddress,
          fingerprint: '1234567890',
        },
      });
    });

    it('should use default IP address when not provided', async () => {
      const userId = TestHelpers.generateRandomString();
      const orgId = TestHelpers.generateRandomString();

      mockJwtService.sign.mockReturnValue('mock_refresh_token');

      await service.generateTokens(userId, orgId);

      expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith({
        data: {
          token: 'mock_refresh_token',
          user: { connect: { id: userId } },
          ipAddress: 'unknown',
          fingerprint: '1234567890',
        },
      });
    });

    it('should generate unique JTI for refresh token', async () => {
      const userId = TestHelpers.generateRandomString();
      const orgId = TestHelpers.generateRandomString();

      // Mock Date.now() to ensure consistent JTI
      const mockNow = 1234567890000;
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      await service.generateTokens(userId, orgId);

      expect(mockJwtService.sign).toHaveBeenNthCalledWith(
        2,
        { sub: userId, jti: `${userId}-${mockNow}-0.5` },
        { expiresIn: '7d' },
      );

      // Restore mocks
      jest.restoreAllMocks();
    });

    it('should handle database errors when storing refresh token', async () => {
      const userId = TestHelpers.generateRandomString();
      const orgId = TestHelpers.generateRandomString();

      mockJwtService.sign.mockReturnValue('mock_refresh_token');
      mockPrisma.refreshToken.create.mockRejectedValue(new Error('Database error'));

      await expect(service.generateTokens(userId, orgId)).rejects.toThrow('Database error');

      expect(mockPrisma.refreshToken.create).toHaveBeenCalled();
    });
  });

  describe('revokeRefreshToken', () => {
    it('should mark refresh token as revoked', async () => {
      const token = 'token_to_revoke';

      await service.revokeRefreshToken(token);

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { token },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should not throw error if token does not exist', async () => {
      const token = 'non_existent_token';

      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.revokeRefreshToken(token)).resolves.not.toThrow();

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { token },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should handle database errors', async () => {
      const token = 'token_to_revoke';

      mockPrisma.refreshToken.updateMany.mockRejectedValue(new Error('Database error'));

      await expect(service.revokeRefreshToken(token)).rejects.toThrow('Database error');

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { token },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all tokens for a user', async () => {
      const userId = TestHelpers.generateRandomString();

      await service.revokeAllUserTokens(userId);

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should not throw error if user has no tokens', async () => {
      const userId = TestHelpers.generateRandomString();

      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.revokeAllUserTokens(userId)).resolves.not.toThrow();

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should handle database errors', async () => {
      const userId = TestHelpers.generateRandomString();

      mockPrisma.refreshToken.updateMany.mockRejectedValue(new Error('Database error'));

      await expect(service.revokeAllUserTokens(userId)).rejects.toThrow('Database error');

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('token expiration', () => {
    it('should set correct expiration for access token', async () => {
      const userId = TestHelpers.generateRandomString();
      const orgId = TestHelpers.generateRandomString();

      await service.generateTokens(userId, orgId);

      expect(mockJwtService.sign).toHaveBeenNthCalledWith(
        1,
        { sub: userId, orgId },
        { expiresIn: '15m' },
      );
    });

    it('should set correct expiration for refresh token', async () => {
      const userId = TestHelpers.generateRandomString();
      const orgId = TestHelpers.generateRandomString();

      await service.generateTokens(userId, orgId);

      expect(mockJwtService.sign).toHaveBeenNthCalledWith(2, expect.any(Object), {
        expiresIn: '7d',
      });
    });

    it('should return correct expiresIn value', async () => {
      const userId = TestHelpers.generateRandomString();
      const orgId = TestHelpers.generateRandomString();

      const result = await service.generateTokens(userId, orgId);

      expect(result.expiresIn).toBe(900); // 15 minutes in seconds
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete token lifecycle', async () => {
      const userId = TestHelpers.generateRandomString();
      const orgId = TestHelpers.generateRandomString();
      const ipAddress = '192.168.1.100';

      mockJwtService.sign
        .mockReturnValueOnce('access_token_123')
        .mockReturnValueOnce('refresh_token_123');

      // Generate tokens
      const tokens = await service.generateTokens(userId, orgId, ipAddress);

      expect(tokens).toEqual({
        accessToken: 'access_token_123',
        refreshToken: 'refresh_token_123',
        expiresIn: 900,
      });

      // Revoke the refresh token
      await service.revokeRefreshToken(tokens.refreshToken);

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { token: 'refresh_token_123' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should handle multiple token generation for same user', async () => {
      const userId = TestHelpers.generateRandomString();
      const orgId = TestHelpers.generateRandomString();

      mockJwtService.sign
        .mockReturnValueOnce('access_token_1')
        .mockReturnValueOnce('refresh_token_1')
        .mockReturnValueOnce('access_token_2')
        .mockReturnValueOnce('refresh_token_2');

      // Generate first set of tokens
      const tokens1 = await service.generateTokens(userId, orgId);

      // Generate second set of tokens
      const tokens2 = await service.generateTokens(userId, orgId);

      expect(tokens1.refreshToken).not.toBe(tokens2.refreshToken);
      expect(mockPrisma.refreshToken.create).toHaveBeenCalledTimes(2);
    });
  });
});
