import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';
import {
  StandupMetricsDto,
  MemberStatsDto,
  RecentInstanceDto,
  StandupDetailsResponseDto,
} from '@/standups/dto/standup-metrics.dto';

interface ConfigSnapshot {
  configId?: string;
  participatingMembers?: Array<{
    id: string;
    name: string;
  }>;
}

@Injectable()
export class StandupMetricsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(StandupMetricsService.name);
  }

  async getStandupMetrics(configId: string, orgId: string): Promise<StandupMetricsDto> {
    // Verify the config belongs to the org
    const config = await this.prisma.standupConfig.findFirst({
      where: {
        id: configId,
        team: {
          orgId: orgId,
        },
      },
    });

    if (!config) {
      throw new Error('Standup configuration not found');
    }

    // Get all instances related to this team and config (using configSnapshot)
    const instances = await this.prisma.standupInstance.findMany({
      where: {
        teamId: config.teamId,
        // Note: We can't directly filter by configId as it's not a field,
        // but we can filter by team and then check configSnapshot
      },
      include: {
        _count: {
          select: {
            answers: true,
          },
        },
      },
      orderBy: {
        targetDate: 'desc',
      },
    });

    // Filter instances that match this config ID from configSnapshot
    const filteredInstances = instances.filter((instance) => {
      const configSnapshot = instance.configSnapshot as ConfigSnapshot;
      return configSnapshot?.configId === configId;
    });

    // Calculate metrics
    const totalInstances = filteredInstances.length;
    const completedInstances = filteredInstances.filter((i) => i.state === 'posted').length;
    const cancelledInstances = 0; // There's no cancelled state in the current schema

    // Calculate average response rate
    let totalResponseRate = 0;
    let responseRateCount = 0;
    const dayResponseRates: Record<string, number[]> = {};

    for (const instance of filteredInstances) {
      if (instance.state === 'posted' || instance.state === 'collecting') {
        const configSnapshot = instance.configSnapshot as ConfigSnapshot;
        const totalMembers = configSnapshot?.participatingMembers?.length || 0;
        const respondedMembers = instance._count.answers;

        if (totalMembers > 0) {
          const responseRate = (respondedMembers / totalMembers) * 100;
          totalResponseRate += responseRate;
          responseRateCount++;

          // Track by day of week
          const dayOfWeek = new Date(instance.targetDate).toLocaleDateString('en-US', {
            weekday: 'long',
          });
          if (!dayResponseRates[dayOfWeek]) {
            dayResponseRates[dayOfWeek] = [];
          }
          dayResponseRates[dayOfWeek].push(responseRate);
        }
      }
    }

    const averageResponseRate =
      responseRateCount > 0 ? Math.round(totalResponseRate / responseRateCount) : 0;

    // Find best and worst days
    let bestDay = 'N/A';
    let worstDay = 'N/A';
    let bestDayRate = 0;
    let worstDayRate = 100;

    for (const [day, rates] of Object.entries(dayResponseRates)) {
      const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
      if (avgRate > bestDayRate) {
        bestDayRate = avgRate;
        bestDay = day;
      }
      if (avgRate < worstDayRate) {
        worstDayRate = avgRate;
        worstDay = day;
      }
    }

    // Calculate average response time
    const instanceIds = filteredInstances.map((i) => i.id);
    const answers = await this.prisma.answer.findMany({
      where: {
        standupInstanceId: {
          in: instanceIds,
        },
      },
      include: {
        standupInstance: true,
      },
    });

    let totalResponseTime = 0;
    let responseTimeCount = 0;

    for (const answer of answers) {
      const instanceCreated = new Date(answer.standupInstance.createdAt);
      const answerCreated = new Date(answer.submittedAt);
      const responseTime = Math.round(
        (answerCreated.getTime() - instanceCreated.getTime()) / (1000 * 60),
      ); // in minutes

      if (responseTime > 0 && responseTime < 1440) {
        // Ignore if over 24 hours
        totalResponseTime += responseTime;
        responseTimeCount++;
      }
    }

    const averageResponseTime =
      responseTimeCount > 0 ? Math.round(totalResponseTime / responseTimeCount) : 0;

    // Calculate completion streak
    let completionStreak = 0;
    for (const instance of filteredInstances) {
      if (instance.state === 'posted') {
        const configSnapshot = instance.configSnapshot as ConfigSnapshot;
        const totalMembers = configSnapshot?.participatingMembers?.length || 0;
        const respondedMembers = instance._count.answers;

        if (totalMembers > 0 && respondedMembers === totalMembers) {
          completionStreak++;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    // Calculate trend (compare last 5 instances with previous 5)
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (filteredInstances.length >= 10) {
      const recent5 = filteredInstances.slice(0, 5);
      const previous5 = filteredInstances.slice(5, 10);

      const recentAvg = this.calculateAverageResponseRate(recent5);
      const previousAvg = this.calculateAverageResponseRate(previous5);

      if (recentAvg > previousAvg + 5) {
        trend = 'up';
      } else if (recentAvg < previousAvg - 5) {
        trend = 'down';
      }
    }

    const successRate =
      totalInstances > 0 ? Math.round((completedInstances / totalInstances) * 100) : 0;

    return {
      averageResponseRate,
      averageResponseTime,
      completionStreak,
      totalInstances,
      completedInstances,
      cancelledInstances,
      bestDay,
      worstDay,
      trend,
      successRate,
    };
  }

  async getMemberStats(configId: string, orgId: string): Promise<MemberStatsDto[]> {
    // Get the config with team members
    const config = await this.prisma.standupConfig.findFirst({
      where: {
        id: configId,
        team: {
          orgId: orgId,
        },
      },
      include: {
        configMembers: {
          include: {
            teamMember: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (!config) {
      throw new Error('Standup configuration not found');
    }

    // Get all instances for this config from this team
    const allInstances = await this.prisma.standupInstance.findMany({
      where: {
        teamId: config.teamId,
      },
      include: {
        answers: true,
      },
      orderBy: {
        targetDate: 'desc',
      },
    });

    // Filter instances that match this config ID
    const configInstances = allInstances.filter((instance) => {
      const configSnapshot = instance.configSnapshot as ConfigSnapshot;
      return configSnapshot?.configId === configId;
    });

    const memberStats: MemberStatsDto[] = [];

    for (const participation of config.configMembers) {
      const member = participation.teamMember;
      const instanceIds = configInstances.map((i) => i.id);
      const memberAnswers = await this.prisma.answer.findMany({
        where: {
          teamMemberId: member.id,
          standupInstanceId: {
            in: instanceIds,
          },
        },
        include: {
          standupInstance: true,
        },
        orderBy: {
          submittedAt: 'desc',
        },
      });

      // Calculate response rate
      const totalInstances = configInstances.filter(
        (i) => i.state === 'posted' || i.state === 'collecting',
      ).length;
      const respondedInstances = memberAnswers.length;
      const responseRate =
        totalInstances > 0 ? Math.round((respondedInstances / totalInstances) * 100) : 0;

      // Calculate average response time
      let totalResponseTime = 0;
      let responseTimeCount = 0;

      for (const answer of memberAnswers) {
        const instanceCreated = new Date(answer.standupInstance.createdAt);
        const answerCreated = new Date(answer.submittedAt);
        const responseTime = Math.round(
          (answerCreated.getTime() - instanceCreated.getTime()) / (1000 * 60),
        );

        if (responseTime > 0 && responseTime < 1440) {
          totalResponseTime += responseTime;
          responseTimeCount++;
        }
      }

      const averageResponseTime =
        responseTimeCount > 0 ? Math.round(totalResponseTime / responseTimeCount) : 0;

      // Calculate streak
      let streak = 0;
      const sortedInstances = configInstances
        .filter((i) => i.state === 'posted' || i.state === 'collecting')
        .sort((a, b) => b.targetDate.getTime() - a.targetDate.getTime());

      for (const instance of sortedInstances) {
        const hasAnswer = memberAnswers.some((a) => a.standupInstanceId === instance.id);
        if (hasAnswer) {
          streak++;
        } else {
          break;
        }
      }

      // Get last response date
      const lastResponseDate =
        memberAnswers.length > 0 ? memberAnswers[0].submittedAt.toISOString() : undefined;

      // Count skipped standups (instances where member didn't respond)
      const skippedCount = totalInstances - respondedInstances;

      memberStats.push({
        id: member.id,
        name: member.name,
        email: member.user?.email,
        responseRate,
        averageResponseTime,
        lastResponseDate,
        streak,
        totalResponses: respondedInstances,
        skippedCount,
      });
    }

    // Sort by response rate descending
    return memberStats.sort((a, b) => b.responseRate - a.responseRate);
  }

  async getRecentInstances(
    configId: string,
    orgId: string,
    limit: number = 10,
  ): Promise<RecentInstanceDto[]> {
    // Get config to verify org ownership
    const config = await this.prisma.standupConfig.findFirst({
      where: {
        id: configId,
        team: {
          orgId: orgId,
        },
      },
    });

    if (!config) {
      throw new Error('Standup configuration not found');
    }

    // Get instances for this team
    const allInstances = await this.prisma.standupInstance.findMany({
      where: {
        teamId: config.teamId,
      },
      include: {
        answers: true,
      },
      orderBy: {
        targetDate: 'desc',
      },
    });

    // Filter instances that match this config ID and limit
    const instances = allInstances
      .filter((instance) => {
        const configSnapshot = instance.configSnapshot as ConfigSnapshot;
        return configSnapshot?.configId === configId;
      })
      .slice(0, limit);

    const recentInstances: RecentInstanceDto[] = [];

    for (const instance of instances) {
      const configSnapshot = instance.configSnapshot as ConfigSnapshot;
      const totalCount = configSnapshot?.participatingMembers?.length || 0;
      const respondedCount = instance.answers.length;
      const responseRate = totalCount > 0 ? Math.round((respondedCount / totalCount) * 100) : 0;

      // Calculate average response time for this instance
      let totalResponseTime = 0;
      let responseTimeCount = 0;

      for (const answer of instance.answers) {
        const instanceCreated = new Date(instance.createdAt);
        const answerCreated = new Date(answer.submittedAt);
        const responseTime = Math.round(
          (answerCreated.getTime() - instanceCreated.getTime()) / (1000 * 60),
        );

        if (responseTime > 0 && responseTime < 1440) {
          totalResponseTime += responseTime;
          responseTimeCount++;
        }
      }

      const averageResponseTime =
        responseTimeCount > 0 ? Math.round(totalResponseTime / responseTimeCount) : undefined;

      // Map state to status
      let status: 'completed' | 'collecting' | 'cancelled';
      if (instance.state === 'posted') {
        status = 'completed';
      } else if (instance.state === 'pending') {
        status = 'collecting';
      } else {
        status = 'collecting'; // Default fallback
      }

      recentInstances.push({
        id: instance.id,
        date: instance.targetDate.toISOString(),
        status,
        responseRate,
        respondedCount,
        totalCount,
        averageResponseTime,
      });
    }

    return recentInstances;
  }

  async getStandupDetails(configId: string, orgId: string): Promise<StandupDetailsResponseDto> {
    const [metrics, memberStats, recentInstances] = await Promise.all([
      this.getStandupMetrics(configId, orgId),
      this.getMemberStats(configId, orgId),
      this.getRecentInstances(configId, orgId),
    ]);

    return {
      metrics,
      memberStats,
      recentInstances,
    };
  }

  private calculateAverageResponseRate(
    instances: Array<{ configSnapshot: unknown; _count?: { answers: number } }>,
  ): number {
    let total = 0;
    let count = 0;

    for (const instance of instances) {
      const configSnapshot = instance.configSnapshot as ConfigSnapshot;
      const totalMembers = configSnapshot?.participatingMembers?.length || 0;
      const respondedMembers = instance._count?.answers || 0;

      if (totalMembers > 0) {
        total += (respondedMembers / totalMembers) * 100;
        count++;
      }
    }

    return count > 0 ? total / count : 0;
  }
}
