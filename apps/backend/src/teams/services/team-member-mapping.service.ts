import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { LoggerService } from '@/common/logger.service';

@Injectable()
export class TeamMemberMappingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(TeamMemberMappingService.name);
  }

  /**
   * Map a user ID to team member ID for a specific team
   * This handles the relationship between authenticated users and team members
   */
  async mapUserToTeamMember(userId: string, teamId: string): Promise<string> {
    // First, try to find a direct mapping via userId
    let teamMember = await this.prisma.teamMember.findFirst({
      where: {
        teamId,
        userId,
        active: true,
      },
    });

    if (teamMember) {
      return teamMember.id;
    }

    // If no direct mapping, try to find via integration user
    // Get the user's organization to find related integrations
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        orgMembers: {
          include: {
            org: {
              include: {
                integrations: {
                  include: {
                    integrationUsers: {
                      where: {
                        email: {
                          // Match by email if available
                          not: null,
                        },
                        isDeleted: false,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'User not found', HttpStatus.NOT_FOUND);
    }

    // Try to match by email across integration users
    for (const orgMember of user.orgMembers) {
      for (const integration of orgMember.org.integrations) {
        for (const integrationUser of integration.integrationUsers) {
          if (integrationUser.email === user.email) {
            // Found a matching integration user, check if they're a team member
            teamMember = await this.prisma.teamMember.findFirst({
              where: {
                teamId,
                OR: [
                  { integrationUserId: integrationUser.id },
                  { platformUserId: integrationUser.externalUserId },
                ],
                active: true,
              },
            });

            if (teamMember) {
              // Update the team member to link to the user for future lookups
              await this.prisma.teamMember.update({
                where: { id: teamMember.id },
                data: { userId },
              });

              return teamMember.id;
            }
          }
        }
      }
    }

    throw new ApiError(
      ErrorCode.FORBIDDEN,
      'User is not a member of this team',
      HttpStatus.FORBIDDEN,
    );
  }

  /**
   * Get team member details by user ID and team ID
   */
  async getTeamMemberByUser(userId: string, teamId: string) {
    const teamMemberId = await this.mapUserToTeamMember(userId, teamId);

    return await this.prisma.teamMember.findUnique({
      where: { id: teamMemberId },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            orgId: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        integrationUser: {
          select: {
            id: true,
            name: true,
            externalUserId: true,
          },
        },
      },
    });
  }

  /**
   * Batch map multiple users to team members for a specific team
   */
  async batchMapUsersToTeamMembers(
    userIds: string[],
    teamId: string,
  ): Promise<Map<string, string>> {
    const mappings = new Map<string, string>();

    // Get all existing direct mappings
    const existingMappings = await this.prisma.teamMember.findMany({
      where: {
        teamId,
        userId: {
          in: userIds,
        },
        active: true,
      },
      select: {
        id: true,
        userId: true,
      },
    });

    // Add existing mappings
    existingMappings.forEach((mapping) => {
      if (mapping.userId) {
        mappings.set(mapping.userId, mapping.id);
      }
    });

    // For remaining users, try individual mapping
    const remainingUserIds = userIds.filter((userId) => !mappings.has(userId));

    for (const userId of remainingUserIds) {
      try {
        const teamMemberId = await this.mapUserToTeamMember(userId, teamId);
        mappings.set(userId, teamMemberId);
      } catch (error) {
        this.logger.warn('Failed to map user to team member', {
          userId,
          teamId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return mappings;
  }

  /**
   * Check if a user is a member of a specific team
   */
  async isUserTeamMember(userId: string, teamId: string): Promise<boolean> {
    try {
      await this.mapUserToTeamMember(userId, teamId);
      return true;
    } catch {
      return false;
    }
  }
}
