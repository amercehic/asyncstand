import { ApiProperty } from '@nestjs/swagger';

export class StandupInstanceConfigSnapshot {
  @ApiProperty({
    description: 'Name of the standup configuration',
    example: 'Daily Standup',
  })
  name: string;

  @ApiProperty({
    description: 'Questions for the standup',
    example: ['What did you work on?', 'What will you work on today?', 'Any blockers?'],
  })
  questions: string[];

  @ApiProperty({
    description: 'Response timeout in hours',
    example: 2,
  })
  responseTimeoutHours: number;

  @ApiProperty({
    description: 'Reminder time before standup in minutes',
    example: 10,
  })
  reminderMinutesBefore: number;

  @ApiProperty({
    description: 'Participating team members',
  })
  participatingMembers: Array<{
    id: string;
    name: string;
    platformUserId: string;
  }>;

  @ApiProperty({
    description: 'Team timezone',
    example: 'America/New_York',
  })
  timezone: string;

  @ApiProperty({
    description: "Standup time in team's local time",
    example: '09:00',
  })
  timeLocal: string;
}

export class StandupInstanceDto {
  @ApiProperty({
    description: 'Standup instance ID',
    example: 'clv8k1234567890abcdef1234',
  })
  id: string;

  @ApiProperty({
    description: 'Team ID',
    example: 'clv8k1234567890abcdef5678',
  })
  teamId: string;

  @ApiProperty({
    description: 'Team name',
    example: 'Engineering Team',
  })
  teamName: string;

  @ApiProperty({
    description: 'Name of the standup configuration',
    example: 'Daily Standup',
  })
  configName: string;

  @ApiProperty({
    description: 'Target date for this standup instance',
    example: '2024-01-15',
  })
  targetDate: string;

  @ApiProperty({
    description: 'Current state of the standup instance',
    example: 'collecting',
  })
  state: string;

  @ApiProperty({
    description: 'Configuration snapshot at time of creation',
    type: StandupInstanceConfigSnapshot,
  })
  configSnapshot: StandupInstanceConfigSnapshot;

  @ApiProperty({
    description: 'When this instance was created',
    example: '2024-01-15T08:45:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Total number of participating members',
    example: 5,
  })
  totalMembers: number;

  @ApiProperty({
    description: 'Number of members who have responded',
    example: 3,
  })
  respondedMembers: number;

  @ApiProperty({
    description: 'Response rate as percentage',
    example: 60,
  })
  responseRate: number;

  @ApiProperty({
    description: 'Detailed member information',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Member ID' },
        name: { type: 'string', description: 'Member name' },
        platformUserId: { type: 'string', description: 'Platform user ID' },
        status: {
          type: 'string',
          enum: ['not_started', 'in_progress', 'completed'],
          description: 'Response status',
        },
        lastReminderSent: {
          type: 'string',
          format: 'date-time',
          description: 'Last reminder time',
        },
        reminderCount: { type: 'number', description: 'Number of reminders sent' },
        responseTime: { type: 'string', format: 'date-time', description: 'Time of response' },
        isLate: { type: 'boolean', description: 'Whether response was late' },
      },
    },
  })
  members: Array<{
    id: string;
    name: string;
    platformUserId: string;
    status: 'not_started' | 'in_progress' | 'completed';
    lastReminderSent?: string;
    reminderCount: number;
    responseTime?: string;
    isLate: boolean;
  }>;
}
