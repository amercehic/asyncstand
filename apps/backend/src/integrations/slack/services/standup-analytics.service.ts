import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';
import type { StandupInstance, Answer, TeamMember, ParticipationSnapshot } from '@prisma/client';

type StandupInstanceWithAnswers = StandupInstance & {
  answers: (Answer & {
    teamMember: TeamMember;
  })[];
  participationSnapshots?: ParticipationSnapshot[];
};

export interface StandupAnalytics {
  teamId: string;
  period: {
    start: Date;
    end: Date;
  };
  totalStandups: number;
  averageParticipation: number;
  participationTrend: 'increasing' | 'decreasing' | 'stable';
  memberStats: MemberStats[];
  responseTimes: {
    average: number; // minutes
    median: number;
  };
  consistencyScore: number; // 0-100
}

export interface MemberStats {
  memberId: string;
  memberName: string | null;
  participationRate: number; // 0-100
  averageResponseTime: number; // minutes
  totalResponses: number;
  streak: number; // consecutive days
}

@Injectable()
export class StandupAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(StandupAnalyticsService.name);
  }

  async getTeamAnalytics(
    teamId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<StandupAnalytics> {
    const instances = await this.prisma.standupInstance.findMany({
      where: {
        teamId,
        targetDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        answers: {
          include: {
            teamMember: true,
          },
        },
        participationSnapshots: true,
      },
      orderBy: {
        targetDate: 'asc',
      },
    });

    const memberStats = await this.calculateMemberStats(teamId, instances);
    const participationTrend = this.calculateParticipationTrend(instances);
    const responseTimes = await this.calculateResponseTimes(instances);
    const consistencyScore = this.calculateConsistencyScore(instances);

    return {
      teamId,
      period: { start: startDate, end: endDate },
      totalStandups: instances.length,
      averageParticipation: this.calculateAverageParticipation(instances),
      participationTrend,
      memberStats,
      responseTimes,
      consistencyScore,
    };
  }

  async getOrgAnalytics(orgId: string, startDate: Date, endDate: Date): Promise<unknown> {
    const teams = await this.prisma.team.findMany({
      where: { orgId },
      include: {
        instances: {
          where: {
            targetDate: {
              gte: startDate,
              lte: endDate,
            },
          },
          include: {
            answers: true,
            participationSnapshots: true,
          },
        },
      },
    });

    const orgStats = {
      totalTeams: teams.length,
      activeTeams: teams.filter((t) => t.instances.length > 0).length,
      totalStandups: teams.reduce((sum, t) => sum + t.instances.length, 0),
      totalResponses: teams.reduce(
        (sum, t) => sum + t.instances.reduce((s, i) => s + i.answers.length, 0),
        0,
      ),
      averageTeamParticipation: 0,
      teams: [] as Array<{ teamId: string; teamName: string | null; analytics: StandupAnalytics }>,
    };

    for (const team of teams) {
      if (team.instances.length > 0) {
        const teamAnalytics = await this.getTeamAnalytics(team.id, startDate, endDate);
        orgStats.teams.push({
          teamId: team.id,
          teamName: team.name,
          analytics: teamAnalytics,
        });
      }
    }

    orgStats.averageTeamParticipation =
      orgStats.teams.length > 0
        ? orgStats.teams.reduce((sum, t) => sum + t.analytics.averageParticipation, 0) /
          orgStats.teams.length
        : 0;

    return orgStats;
  }

  private async calculateMemberStats(
    teamId: string,
    instances: StandupInstanceWithAnswers[],
  ): Promise<MemberStats[]> {
    const members = await this.prisma.teamMember.findMany({
      where: { teamId, active: true },
    });

    const memberStats: MemberStats[] = [];

    for (const member of members) {
      const memberAnswers = instances.flatMap((i) =>
        i.answers.filter((a) => a.teamMemberId === member.id),
      );

      const participationRate =
        instances.length > 0 ? (memberAnswers.length / instances.length) * 100 : 0;

      const responseTimes = memberAnswers
        .map((answer) => {
          const instance = instances.find((i) => i.id === answer.standupInstanceId);
          return instance?.createdAt
            ? this.calculateResponseTime(answer.submittedAt, instance.createdAt)
            : null;
        })
        .filter((rt): rt is number => rt !== null);

      const averageResponseTime =
        responseTimes.length > 0
          ? responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length
          : 0;

      const streak = await this.calculateMemberStreak(member.id, instances);

      memberStats.push({
        memberId: member.id,
        memberName: member.name,
        participationRate,
        averageResponseTime,
        totalResponses: memberAnswers.length,
        streak,
      });
    }

    return memberStats.sort((a, b) => b.participationRate - a.participationRate);
  }

  private calculateParticipationTrend(
    instances: StandupInstanceWithAnswers[],
  ): 'increasing' | 'decreasing' | 'stable' {
    if (instances.length < 3) return 'stable';

    const recentThird = instances.slice(-Math.ceil(instances.length / 3));
    const middleThird = instances.slice(
      Math.floor(instances.length / 3),
      Math.floor((instances.length * 2) / 3),
    );

    const recentAvg = this.calculateAverageParticipation(recentThird);
    const middleAvg = this.calculateAverageParticipation(middleThird);

    const difference = recentAvg - middleAvg;
    const threshold = 5; // 5% threshold

    if (difference > threshold) return 'increasing';
    if (difference < -threshold) return 'decreasing';
    return 'stable';
  }

  private calculateAverageParticipation(instances: StandupInstanceWithAnswers[]): number {
    if (instances.length === 0) return 0;

    const totalParticipation = instances.reduce((sum, instance) => {
      const snapshot = instance.participationSnapshots?.[0];
      if (snapshot) {
        const total = snapshot.answersCount + snapshot.membersMissing;
        return sum + (total > 0 ? (snapshot.answersCount / total) * 100 : 0);
      }
      return sum;
    }, 0);

    return totalParticipation / instances.length;
  }

  private async calculateResponseTimes(
    instances: StandupInstanceWithAnswers[],
  ): Promise<{ average: number; median: number }> {
    const responseTimes: number[] = [];

    for (const instance of instances) {
      for (const answer of instance.answers) {
        const responseTime = this.calculateResponseTime(answer.submittedAt, instance.createdAt);
        if (responseTime !== null) {
          responseTimes.push(responseTime);
        }
      }
    }

    if (responseTimes.length === 0) {
      return { average: 0, median: 0 };
    }

    const average = responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length;

    responseTimes.sort((a, b) => a - b);
    const median =
      responseTimes.length % 2 === 0
        ? (responseTimes[responseTimes.length / 2 - 1] + responseTimes[responseTimes.length / 2]) /
          2
        : responseTimes[Math.floor(responseTimes.length / 2)];

    return { average: Math.round(average), median: Math.round(median) };
  }

  private calculateResponseTime(submittedAt: Date, instanceCreatedAt: Date): number | null {
    if (!submittedAt || !instanceCreatedAt) return null;
    return Math.round((submittedAt.getTime() - instanceCreatedAt.getTime()) / (1000 * 60)); // minutes
  }

  private calculateConsistencyScore(instances: StandupInstanceWithAnswers[]): number {
    if (instances.length === 0) return 0;

    // Score based on regularity of standups and participation consistency
    const expectedFrequency = this.calculateExpectedFrequency(instances);
    const actualFrequency = instances.length;
    const frequencyScore = Math.min(100, (actualFrequency / expectedFrequency) * 100);

    const participationVariance = this.calculateParticipationVariance(instances);
    const consistencyScore = Math.max(0, 100 - participationVariance * 2);

    return Math.round((frequencyScore + consistencyScore) / 2);
  }

  private calculateExpectedFrequency(instances: StandupInstanceWithAnswers[]): number {
    if (instances.length === 0) return 1;

    // Simplified: assume 5 workdays per week
    const startDate = instances[0].targetDate;
    const endDate = instances[instances.length - 1].targetDate;
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const weekdays = Math.floor((daysDiff * 5) / 7); // Approximate weekdays

    return Math.max(1, weekdays);
  }

  private calculateParticipationVariance(instances: StandupInstanceWithAnswers[]): number {
    const participationRates = instances.map((instance) => {
      const snapshot = instance.participationSnapshots?.[0];
      if (snapshot) {
        const total = snapshot.answersCount + snapshot.membersMissing;
        return total > 0 ? (snapshot.answersCount / total) * 100 : 0;
      }
      return 0;
    });

    if (participationRates.length === 0) return 0;

    const mean =
      participationRates.reduce((sum, rate) => sum + rate, 0) / participationRates.length;
    const variance =
      participationRates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) /
      participationRates.length;

    return Math.sqrt(variance);
  }

  private async calculateMemberStreak(
    memberId: string,
    instances: StandupInstanceWithAnswers[],
  ): Promise<number> {
    let streak = 0;
    const sortedInstances = [...instances].sort(
      (a, b) => new Date(b.targetDate).getTime() - new Date(a.targetDate).getTime(),
    );

    for (const instance of sortedInstances) {
      const hasAnswer = instance.answers.some((a) => a.teamMemberId === memberId);
      if (hasAnswer) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }
}
