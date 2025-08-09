import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiBody, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { CreateStandupConfigDto } from '@/standups/dto/create-standup-config.dto';
import { UpdateStandupConfigDto } from '@/standups/dto/update-standup-config.dto';
import { UpdateMemberParticipationDto } from '@/standups/dto/update-member-participation.dto';
import { BulkUpdateParticipationDto } from '@/standups/dto/bulk-update-participation.dto';

// Swagger decorators for standup config endpoints
export const SwaggerCreateStandupConfig = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Create standup configuration for a team',
      description:
        'Creates a new standup configuration for the specified team with questions, schedule, and member participation settings.',
    }),
    ApiParam({
      name: 'teamId',
      description: 'Team ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiBody({ type: CreateStandupConfigDto }),
    ApiResponse({
      status: 201,
      description: 'Standup configuration created successfully',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        },
      },
    }),
    ApiResponse({ status: 400, description: 'Bad request - validation failed' }),
    ApiResponse({ status: 404, description: 'Team not found' }),
    ApiResponse({ status: 409, description: 'Configuration already exists for this team' }),
  );

export const SwaggerGetStandupConfig = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get standup configuration for a team',
      description:
        'Retrieves the complete standup configuration for the specified team including questions, schedule, and member participation.',
    }),
    ApiParam({
      name: 'teamId',
      description: 'Team ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiResponse({
      status: 200,
      description: 'Standup configuration retrieved successfully',
      type: StandupConfigResponseSwagger,
    }),
    ApiResponse({ status: 404, description: 'Configuration not found' }),
  );

export const SwaggerUpdateStandupConfig = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Update standup configuration for a team',
      description:
        'Updates the standup configuration for the specified team. Only provided fields will be updated.',
    }),
    ApiParam({
      name: 'teamId',
      description: 'Team ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiBody({ type: UpdateStandupConfigDto }),
    ApiResponse({
      status: 200,
      description: 'Standup configuration updated successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Standup configuration updated successfully' },
        },
      },
    }),
    ApiResponse({ status: 400, description: 'Bad request - validation failed' }),
    ApiResponse({ status: 404, description: 'Configuration not found' }),
  );

export const SwaggerDeleteStandupConfig = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Delete standup configuration for a team',
      description: 'Permanently deletes the standup configuration for the specified team.',
    }),
    ApiParam({
      name: 'teamId',
      description: 'Team ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiResponse({
      status: 200,
      description: 'Standup configuration deleted successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Standup configuration deleted successfully' },
        },
      },
    }),
    ApiResponse({ status: 404, description: 'Configuration not found' }),
  );

export const SwaggerGetStandupPreview = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Preview how standup will work with current configuration',
      description:
        'Generates a preview of how the standup will function with the current configuration, including schedule and participant information.',
    }),
    ApiParam({
      name: 'teamId',
      description: 'Team ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiResponse({
      status: 200,
      description: 'Standup preview generated successfully',
      type: PreviewResponseSwagger,
    }),
    ApiResponse({ status: 404, description: 'Configuration not found' }),
  );

export const SwaggerGetMemberParticipation = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get member participation settings for a team',
      description: 'Retrieves the participation settings for all team members in the standup.',
    }),
    ApiParam({
      name: 'teamId',
      description: 'Team ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiResponse({
      status: 200,
      description: 'Member participation retrieved successfully',
      type: [MemberParticipationResponseSwagger],
    }),
    ApiResponse({ status: 404, description: 'Configuration not found' }),
  );

export const SwaggerUpdateMemberParticipation = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Update member participation in standups',
      description: 'Updates the participation settings for a specific team member in the standup.',
    }),
    ApiParam({
      name: 'teamId',
      description: 'Team ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiParam({
      name: 'memberId',
      description: 'Team Member ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiBody({ type: UpdateMemberParticipationDto }),
    ApiResponse({
      status: 200,
      description: 'Member participation updated successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Member participation updated successfully' },
        },
      },
    }),
    ApiResponse({ status: 404, description: 'Team member not found' }),
  );

export const SwaggerBulkUpdateParticipation = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Bulk update member participation in standups',
      description: 'Updates participation settings for multiple team members at once.',
    }),
    ApiParam({
      name: 'teamId',
      description: 'Team ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiBody({ type: BulkUpdateParticipationDto }),
    ApiResponse({
      status: 200,
      description: 'Member participation updated successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Member participation updated successfully' },
        },
      },
    }),
    ApiResponse({ status: 404, description: 'One or more team members not found' }),
  );

export const SwaggerGetValidTimezones = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get list of valid timezones',
      description:
        'Returns a list of all valid timezone identifiers that can be used in standup configurations.',
    }),
    ApiResponse({
      status: 200,
      description: 'Valid timezones retrieved successfully',
      schema: {
        type: 'array',
        items: { type: 'string' },
        example: ['America/New_York', 'Europe/London', 'Asia/Tokyo', 'UTC'],
      },
    }),
  );

export const SwaggerGetQuestionTemplates = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get default question templates',
      description:
        'Returns predefined question templates that can be used as starting points for standup configurations.',
    }),
    ApiResponse({
      status: 200,
      description: 'Question templates retrieved successfully',
      type: [QuestionTemplateSwagger],
    }),
  );

export const SwaggerListTeamsWithStandups = () =>
  applyDecorators(
    ApiOperation({
      summary: 'List teams with standup configurations',
      description:
        'Returns a list of all teams in the organization that have standup configurations.',
    }),
    ApiResponse({
      status: 200,
      description: 'Teams with standups retrieved successfully',
      schema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            teamId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
            teamName: { type: 'string', example: 'Engineering Team' },
            isActive: { type: 'boolean', example: true },
          },
        },
        example: [
          {
            teamId: '123e4567-e89b-12d3-a456-426614174000',
            teamName: 'Engineering Team',
            isActive: true,
          },
          {
            teamId: '456e7890-e89b-12d3-a456-426614174000',
            teamName: 'Design Team',
            isActive: false,
          },
        ],
      },
    }),
  );

// Swagger response classes
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

export class MemberParticipationResponseSwagger {
  @ApiProperty({
    description: 'Team member information',
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      platformUserId: { type: 'string' },
    },
  })
  teamMember: {
    id: string;
    name: string;
    platformUserId: string;
  };

  @ApiProperty({ description: 'Whether member is included in standups' })
  include: boolean;

  @ApiProperty({ description: 'Member role in standups', nullable: true })
  role?: string;
}

export class QuestionTemplateSwagger {
  @ApiProperty({ description: 'Template name' })
  name: string;

  @ApiProperty({ description: 'Template questions', type: [String] })
  questions: string[];
}
