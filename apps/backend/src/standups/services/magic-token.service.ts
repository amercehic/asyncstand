import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';

export interface MagicTokenPayload {
  standupInstanceId: string;
  teamMemberId: string;
  platformUserId: string;
  orgId: string;
  iat?: number;
  exp?: number;
}

export interface MagicTokenInfo {
  token: string;
  expiresAt: Date;
  submissionUrl: string;
}

@Injectable()
export class MagicTokenService {
  private readonly jwtSecret: string;
  private readonly baseUrl: string;

  constructor(
    private readonly jwt: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.jwtSecret = this.configService.get<string>('jwtSecret') || 'fallback-secret';
    this.baseUrl = this.configService.get<string>('appUrl') || 'http://localhost:3000';
    this.logger.setContext(MagicTokenService.name);
  }

  /**
   * Generate a magic token for standup response submission
   */
  async generateMagicToken(
    standupInstanceId: string,
    teamMemberId: string,
    platformUserId: string,
    orgId: string,
    expirationHours: number = 24,
  ): Promise<MagicTokenInfo> {
    this.logger.info('Generating magic token', {
      standupInstanceId,
      teamMemberId,
      platformUserId,
      orgId,
      expirationHours,
    });

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expirationHours);

    // Create JWT payload
    const payload: MagicTokenPayload = {
      standupInstanceId,
      teamMemberId,
      platformUserId,
      orgId,
    };

    // Generate the token with custom expiration
    const token = this.jwt.sign(payload, {
      secret: this.jwtSecret,
      expiresIn: `${expirationHours}h`,
    });

    // Create the submission URL
    const submissionUrl = `${this.baseUrl}/standup/respond/${token}`;

    this.logger.info('Magic token generated successfully', {
      standupInstanceId,
      teamMemberId,
      expiresAt: expiresAt.toISOString(),
      urlGenerated: true,
    });

    return {
      token,
      expiresAt,
      submissionUrl,
    };
  }

  /**
   * Validate and decode a magic token
   */
  async validateMagicToken(token: string): Promise<MagicTokenPayload | null> {
    try {
      this.logger.debug('Validating magic token');

      // Verify and decode the token
      const decoded = this.jwt.verify<MagicTokenPayload>(token, {
        secret: this.jwtSecret,
      });

      // Validate that the standup instance still exists and is accepting responses
      const instance = await this.prisma.standupInstance.findFirst({
        where: {
          id: decoded.standupInstanceId,
          team: { orgId: decoded.orgId },
        },
        include: {
          team: {
            include: {
              members: {
                where: { id: decoded.teamMemberId, active: true },
              },
            },
          },
        },
      });

      if (!instance) {
        this.logger.warn('Magic token validation failed: instance not found', {
          instanceId: decoded.standupInstanceId,
          orgId: decoded.orgId,
        });
        return null;
      }

      if (instance.team.members.length === 0) {
        this.logger.warn('Magic token validation failed: team member not found or inactive', {
          teamMemberId: decoded.teamMemberId,
          instanceId: decoded.standupInstanceId,
        });
        return null;
      }

      // Check if the standup is still accepting responses
      if (instance.state !== 'collecting') {
        this.logger.warn('Magic token validation failed: standup not accepting responses', {
          instanceId: decoded.standupInstanceId,
          currentState: instance.state,
        });
        return null;
      }

      // Check if response window is still open (using config snapshot)
      const configSnapshot = instance.configSnapshot as {
        responseTimeoutHours: number;
        questions: string[];
      };

      const timeoutAt = new Date(
        instance.createdAt.getTime() + configSnapshot.responseTimeoutHours * 60 * 60 * 1000,
      );

      if (new Date() > timeoutAt) {
        this.logger.warn('Magic token validation failed: response window closed', {
          instanceId: decoded.standupInstanceId,
          timeoutAt: timeoutAt.toISOString(),
          currentTime: new Date().toISOString(),
        });
        return null;
      }

      this.logger.info('Magic token validated successfully', {
        instanceId: decoded.standupInstanceId,
        teamMemberId: decoded.teamMemberId,
        orgId: decoded.orgId,
      });

      return decoded;
    } catch (error) {
      this.logger.error('Magic token validation error', {
        error: error instanceof Error ? error.message : String(error),
        tokenProvided: !!token,
      });
      return null;
    }
  }

  /**
   * Get standup instance information for a validated token
   */
  async getStandupInfoForToken(tokenPayload: MagicTokenPayload) {
    const instance = await this.prisma.standupInstance.findFirst({
      where: {
        id: tokenPayload.standupInstanceId,
        team: { orgId: tokenPayload.orgId },
      },
      include: {
        team: {
          include: {
            members: {
              where: { id: tokenPayload.teamMemberId },
              include: {
                integrationUser: true,
              },
            },
          },
        },
      },
    });

    if (!instance || instance.team.members.length === 0) {
      return null;
    }

    const configSnapshot = instance.configSnapshot as {
      questions: string[];
      responseTimeoutHours: number;
    };

    const teamMember = instance.team.members[0];
    const timeoutAt = new Date(
      instance.createdAt.getTime() + configSnapshot.responseTimeoutHours * 60 * 60 * 1000,
    );

    return {
      instance: {
        id: instance.id,
        targetDate: instance.targetDate,
        createdAt: instance.createdAt,
        state: instance.state,
        timeoutAt,
      },
      team: {
        id: instance.team.id,
        name: instance.team.name,
      },
      member: {
        id: teamMember.id,
        name: teamMember.name || teamMember.integrationUser?.name || 'Unknown',
        platformUserId: teamMember.platformUserId,
      },
      questions: configSnapshot.questions,
    };
  }

  /**
   * Check if a member has already submitted responses
   */
  async hasExistingResponses(standupInstanceId: string, teamMemberId: string): Promise<boolean> {
    const existingAnswers = await this.prisma.answer.findFirst({
      where: {
        standupInstanceId,
        teamMemberId,
      },
    });

    return !!existingAnswers;
  }
}
