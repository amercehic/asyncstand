import { ApiProperty } from '@nestjs/swagger';

export class StandupConfigResponseSwagger {
  @ApiProperty({ description: 'Configuration ID' })
  id: string;

  @ApiProperty({ description: 'Standup questions', type: [String] })
  questions: string[];

  @ApiProperty({ description: 'Weekdays for standups (0=Sunday)', type: [Number] })
  weekdays: number[];

  @ApiProperty({ description: 'Local time in HH:MM format' })
  timeLocal: string;

  @ApiProperty({ description: 'Timezone' })
  timezone: string;

  @ApiProperty({ description: 'Minutes before standup to send reminder' })
  reminderMinutesBefore: number;

  @ApiProperty({ description: 'Hours to wait for responses' })
  responseTimeoutHours: number;

  @ApiProperty({ description: 'Whether configuration is active' })
  isActive: boolean;

  @ApiProperty({
    description: 'Team information',
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      channelName: { type: 'string' },
    },
  })
  team: {
    id: string;
    name: string;
    channelName: string;
  };

  @ApiProperty({
    description: 'Member participation settings',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        teamMember: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            platformUserId: { type: 'string' },
          },
        },
        include: { type: 'boolean' },
        role: { type: 'string', nullable: true },
      },
    },
  })
  memberParticipation: Array<{
    teamMember: {
      id: string;
      name: string;
      platformUserId: string;
    };
    include: boolean;
    role?: string;
  }>;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class PreviewResponseSwagger {
  @ApiProperty({
    description: 'Schedule information',
    type: 'object',
    properties: {
      weekdays: { type: 'array', items: { type: 'string' } },
      timeLocal: { type: 'string' },
      timezone: { type: 'string' },
      nextStandup: { type: 'string', format: 'date-time' },
    },
  })
  schedule: {
    weekdays: string[];
    timeLocal: string;
    timezone: string;
    nextStandup: Date;
  };

  @ApiProperty({ description: 'Standup questions', type: [String] })
  questions: string[];

  @ApiProperty({ description: 'Number of participating members' })
  participatingMembers: number;

  @ApiProperty({ description: 'Total number of team members' })
  totalMembers: number;

  @ApiProperty({
    description: 'Reminder settings',
    type: 'object',
    properties: {
      minutesBefore: { type: 'number' },
      timeoutHours: { type: 'number' },
    },
  })
  reminderSettings: {
    minutesBefore: number;
    timeoutHours: number;
  };
}

export class QuestionTemplateSwagger {
  @ApiProperty({ description: 'Template name' })
  name: string;

  @ApiProperty({ description: 'Template questions', type: [String] })
  questions: string[];
}
