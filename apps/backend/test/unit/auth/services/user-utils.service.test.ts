/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { UserUtilsService } from '@/auth/services/user-utils.service';
import { PrismaService } from '@/prisma/prisma.service';
import { createMockPrismaService, MockPrismaService } from '@/test/utils/mocks/prisma.mock';

describe('UserUtilsService', () => {
  let service: UserUtilsService;
  let mockPrisma: MockPrismaService;

  const mockUser = {
    id: 'user-1',
    name: 'Test User',
    passwordHash: 'hashed-password',
  };

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [UserUtilsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<UserUtilsService>(UserUtilsService);
  });

  describe('hashPassword', () => {
    it('should hash password using Argon2', async () => {
      const password = 'testPassword123';
      const hashedPassword = await service.hashPassword(password);

      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(50); // Argon2 hashes are long
    });

    it('should produce different hashes for same password due to salt', async () => {
      const password = 'testPassword123';
      const hash1 = await service.hashPassword(password);
      const hash2 = await service.hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('updateUserIfNeeded', () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.user.update.mockResolvedValue(mockUser as any);
    });

    it('should update user with temp_hash password', async () => {
      const userWithTempHash = {
        ...mockUser,
        passwordHash: 'temp_hash',
      };
      mockPrisma.user.findUnique.mockResolvedValue(userWithTempHash as any);

      const result = await service.updateUserIfNeeded('user-1', 'New Name', 'newPassword123');

      expect(result).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          name: 'New Name',
          passwordHash: expect.any(String),
        },
      });
    });

    it('should update user without password', async () => {
      const userWithoutPassword = {
        ...mockUser,
        passwordHash: null,
      };
      mockPrisma.user.findUnique.mockResolvedValue(userWithoutPassword as any);

      const result = await service.updateUserIfNeeded('user-1', 'New Name', 'newPassword123');

      expect(result).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });

    it('should update only name when user has password but name is different', async () => {
      const result = await service.updateUserIfNeeded('user-1', 'Updated Name');

      expect(result).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          name: 'Updated Name',
        },
      });
    });

    it('should not update when no changes needed', async () => {
      const result = await service.updateUserIfNeeded('user-1', 'Test User');

      expect(result).toBe(false);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should throw error for user with temp_hash but missing password', async () => {
      const userWithTempHash = {
        ...mockUser,
        passwordHash: 'temp_hash',
      };
      mockPrisma.user.findUnique.mockResolvedValue(userWithTempHash as any);

      await expect(service.updateUserIfNeeded('user-1', 'New Name')).rejects.toThrow(
        'Name and password are required for new users or users with temporary passwords',
      );
    });

    it('should throw error if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.updateUserIfNeeded('invalid-user')).rejects.toThrow('User not found');
    });
  });
});
