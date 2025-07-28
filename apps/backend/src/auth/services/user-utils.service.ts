import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { hash } from '@node-rs/argon2';

@Injectable()
export class UserUtilsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Hash a password using Argon2 with consistent settings
   */
  async hashPassword(password: string): Promise<string> {
    return hash(password, {
      memoryCost: 1 << 14, // 16 MiB
      timeCost: 3,
    });
  }

  /**
   * Update user's name and password if needed (for new users or users with temp_hash)
   * Returns true if user was updated, false if no update was needed
   */
  async updateUserIfNeeded(userId: string, name?: string, password?: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, name: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if user needs password update (missing or temp_hash)
    const needsPasswordUpdate = !user.passwordHash || user.passwordHash === 'temp_hash';
    const needsNameUpdate = name && name !== user.name;

    // For new users or users with temp_hash, both name and password are required
    if (needsPasswordUpdate) {
      if (!name || !password) {
        throw new Error(
          'Name and password are required for new users or users with temporary passwords',
        );
      }

      const passwordHash = await this.hashPassword(password);

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          name,
          passwordHash,
        },
      });

      return true; // User was updated
    }

    // For existing users, only update name if provided and different
    if (needsNameUpdate) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { name },
      });

      return true; // User was updated
    }

    return false; // No update needed
  }

  /**
   * Get user's current name for audit logging
   */
  async getUserName(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    return user?.name || 'Unknown User';
  }
}
