import { ApiProperty } from '@nestjs/swagger';

export class StandupMetricsDto {
  @ApiProperty({ description: 'Average response rate percentage' })
  averageResponseRate: number;

  @ApiProperty({ description: 'Average response time in minutes' })
  averageResponseTime: number;

  @ApiProperty({ description: 'Current completion streak in days' })
  completionStreak: number;

  @ApiProperty({ description: 'Total number of standup instances' })
  totalInstances: number;

  @ApiProperty({ description: 'Number of completed instances' })
  completedInstances: number;

  @ApiProperty({ description: 'Best performing day of the week' })
  bestDay: string;

  @ApiProperty({ description: 'Worst performing day of the week' })
  worstDay: string;

  @ApiProperty({ description: 'Response rate trend', enum: ['up', 'down', 'stable'] })
  trend: 'up' | 'down' | 'stable';

  @ApiProperty({ description: 'Number of cancelled instances' })
  cancelledInstances: number;

  @ApiProperty({ description: 'Success rate percentage' })
  successRate: number;
}

export class MemberStatsDto {
  @ApiProperty({ description: 'Member ID' })
  id: string;

  @ApiProperty({ description: 'Member name' })
  name: string;

  @ApiProperty({ description: 'Member email', required: false })
  email?: string;

  @ApiProperty({ description: 'Response rate percentage' })
  responseRate: number;

  @ApiProperty({ description: 'Average response time in minutes' })
  averageResponseTime: number;

  @ApiProperty({ description: 'Last response date', required: false })
  lastResponseDate?: string;

  @ApiProperty({ description: 'Current response streak' })
  streak: number;

  @ApiProperty({ description: 'Total number of responses' })
  totalResponses: number;

  @ApiProperty({ description: 'Number of skipped standups' })
  skippedCount: number;
}

export class RecentInstanceDto {
  @ApiProperty({ description: 'Instance ID' })
  id: string;

  @ApiProperty({ description: 'Instance date' })
  date: string;

  @ApiProperty({ description: 'Instance status', enum: ['completed', 'collecting', 'cancelled'] })
  status: 'completed' | 'collecting' | 'cancelled';

  @ApiProperty({ description: 'Response rate percentage' })
  responseRate: number;

  @ApiProperty({ description: 'Number of members who responded' })
  respondedCount: number;

  @ApiProperty({ description: 'Total number of members' })
  totalCount: number;

  @ApiProperty({ description: 'Average response time in minutes', required: false })
  averageResponseTime?: number;
}

export class StandupDetailsResponseDto {
  @ApiProperty({ description: 'Standup configuration metrics' })
  metrics: StandupMetricsDto;

  @ApiProperty({ description: 'Member statistics', type: [MemberStatsDto] })
  memberStats: MemberStatsDto[];

  @ApiProperty({ description: 'Recent instances', type: [RecentInstanceDto] })
  recentInstances: RecentInstanceDto[];
}
