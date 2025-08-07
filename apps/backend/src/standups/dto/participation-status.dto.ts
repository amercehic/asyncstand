import { ApiProperty } from '@nestjs/swagger';

export class MemberParticipationStatus {
  @ApiProperty({
    description: 'Team member ID',
    example: 'clv8k1234567890abcdef1234',
  })
  teamMemberId: string;

  @ApiProperty({
    description: 'Member name',
    example: 'John Doe',
  })
  name: string;

  @ApiProperty({
    description: 'Platform user ID (e.g., Slack user ID)',
    example: 'U1234567890',
  })
  platformUserId?: string;

  @ApiProperty({
    description: 'Number of questions answered',
    example: 2,
  })
  questionsAnswered: number;

  @ApiProperty({
    description: 'Total number of questions',
    example: 3,
  })
  totalQuestions: number;

  @ApiProperty({
    description: 'Whether the member has completed all questions',
    example: false,
  })
  isComplete: boolean;

  @ApiProperty({
    description: 'When the member last submitted an answer',
    example: '2024-01-15T10:30:00Z',
    nullable: true,
  })
  lastAnswerAt?: Date;
}

export class ParticipationStatusDto {
  @ApiProperty({
    description: 'Standup instance ID',
    example: 'clv8k1234567890abcdef1234',
  })
  standupInstanceId: string;

  @ApiProperty({
    description: 'Current state of the standup instance',
    example: 'collecting',
  })
  state: string;

  @ApiProperty({
    description: 'Target date for this standup',
    example: '2024-01-15',
  })
  targetDate: string;

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
    description: 'Overall response rate as percentage',
    example: 60,
  })
  responseRate: number;

  @ApiProperty({
    description: 'Overall completion rate as percentage',
    example: 40,
  })
  completionRate: number;

  @ApiProperty({
    description: 'Individual member participation status',
    type: [MemberParticipationStatus],
  })
  memberStatus: MemberParticipationStatus[];

  @ApiProperty({
    description: 'When the collection window closes',
    example: '2024-01-15T12:00:00Z',
    nullable: true,
  })
  timeoutAt?: Date;

  @ApiProperty({
    description: 'Whether responses can still be submitted',
    example: true,
  })
  canStillSubmit: boolean;
}
