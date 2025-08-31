import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiBody, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { StandupInstanceDto } from '@/standups/dto/standup-instance.dto';
import { ParticipationStatusDto } from '@/standups/dto/participation-status.dto';
import { UpdateInstanceStateDto } from '@/standups/dto/update-instance-state.dto';
import { SubmitAnswersDto } from '@/standups/dto/submit-answers.dto';

// Swagger decorators for standup instance endpoints
export const SwaggerGetActiveInstances = () =>
  applyDecorators(
    ApiOperation({
      summary: 'List active standup instances',
      description:
        'Retrieves a list of active standup instances with optional filtering by team and pagination.',
    }),
    ApiQuery({ name: 'teamId', required: false, description: 'Filter by team ID' }),
    ApiQuery({
      name: 'limit',
      required: false,
      description: 'Maximum number of items to return (max 100)',
      type: Number,
    }),
    ApiQuery({
      name: 'offset',
      required: false,
      description: 'Number of items to skip',
      type: Number,
    }),
    ApiResponse({
      status: 200,
      description: 'List of active standup instances',
      type: [StandupInstanceDto],
    }),
  );

export const SwaggerGetInstanceDetails = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get standup instance details',
      description:
        'Retrieves detailed information about a specific standup instance including answers.',
    }),
    ApiParam({ name: 'id', description: 'Standup instance ID' }),
    ApiResponse({
      status: 200,
      description: 'Standup instance details with answers',
    }),
    ApiResponse({
      status: 404,
      description: 'Standup instance not found',
    }),
  );

export const SwaggerUpdateInstanceState = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Update standup instance state (admin only)',
      description:
        'Updates the state of a standup instance. Only admin users can perform this action.',
    }),
    ApiParam({ name: 'id', description: 'Standup instance ID' }),
    ApiBody({ type: UpdateInstanceStateDto }),
    ApiResponse({
      status: 200,
      description: 'Instance state updated successfully',
    }),
    ApiResponse({
      status: 400,
      description: 'Invalid state transition',
    }),
    ApiResponse({
      status: 403,
      description: 'Admin role required',
    }),
    ApiResponse({
      status: 404,
      description: 'Standup instance not found',
    }),
  );

export const SwaggerSubmitAnswers = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Submit answers for a standup instance',
      description: 'Submits responses to standup questions for a specific instance.',
    }),
    ApiParam({ name: 'id', description: 'Standup instance ID' }),
    ApiBody({ type: SubmitAnswersDto }),
    ApiResponse({
      status: 201,
      description: 'Answers submitted successfully',
    }),
    ApiResponse({
      status: 400,
      description: 'Invalid submission or collection window closed',
    }),
    ApiResponse({
      status: 403,
      description: 'Member not participating in this standup',
    }),
    ApiResponse({
      status: 404,
      description: 'Standup instance not found',
    }),
  );

export const SwaggerGetParticipationStatus = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get participation status for a standup instance',
      description:
        'Retrieves participation status and response metrics for a specific standup instance.',
    }),
    ApiParam({ name: 'id', description: 'Standup instance ID' }),
    ApiResponse({
      status: 200,
      description: 'Participation status and response metrics',
      type: ParticipationStatusDto,
    }),
    ApiResponse({
      status: 404,
      description: 'Standup instance not found',
    }),
  );

export const SwaggerGetInstanceMembers = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get list of members for an instance',
      description:
        'Retrieves a list of all members participating in a standup instance with their status.',
    }),
    ApiParam({ name: 'id', description: 'Standup instance ID' }),
    ApiResponse({
      status: 200,
      description: 'List of instance members with their status',
    }),
    ApiResponse({
      status: 404,
      description: 'Standup instance not found',
    }),
  );

export const SwaggerGetParticipatingMembers = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get list of participating members for an instance',
      description: 'Retrieves a simplified list of members participating in a standup instance.',
    }),
    ApiParam({ name: 'id', description: 'Standup instance ID' }),
    ApiResponse({
      status: 200,
      description: 'List of participating members',
    }),
    ApiResponse({
      status: 404,
      description: 'Standup instance not found',
    }),
  );

export const SwaggerGetMemberResponse = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get individual member response for an instance',
      description: 'Retrieves the response data for a specific member in a standup instance.',
    }),
    ApiParam({ name: 'id', description: 'Standup instance ID' }),
    ApiParam({ name: 'memberId', description: 'Team member ID' }),
    ApiResponse({
      status: 200,
      description: 'Member response data',
    }),
    ApiResponse({
      status: 404,
      description: 'Standup instance or member response not found',
    }),
  );

export const SwaggerCheckCompletion = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Check if standup instance is complete',
      description: 'Checks whether all participants have completed their standup responses.',
    }),
    ApiParam({ name: 'id', description: 'Standup instance ID' }),
    ApiResponse({
      status: 200,
      description: 'Completion status',
    }),
  );

export const SwaggerCreateInstancesForDate = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Manually create standup instances for a specific date (admin/owner only)',
      description: 'Creates standup instances for all eligible teams for a specified target date.',
    }),
    ApiBody({
      schema: {
        type: 'object',
        properties: {
          targetDate: { type: 'string', format: 'date', example: '2024-01-15' },
        },
      },
    }),
    ApiResponse({
      status: 201,
      description: 'Standup instances created',
    }),
    ApiResponse({
      status: 403,
      description: 'Admin or owner role required',
    }),
  );

export const SwaggerCreateInstancesAndTrigger = () =>
  applyDecorators(
    ApiOperation({
      summary:
        'Manually create standup instances and immediately send Slack messages (admin/owner only)',
      description:
        'Creates standup instances for all eligible teams and immediately sends Slack notifications.',
    }),
    ApiBody({
      schema: {
        type: 'object',
        properties: {
          targetDate: { type: 'string', format: 'date', example: '2024-01-15' },
        },
      },
    }),
    ApiResponse({
      status: 201,
      description: 'Standup instances created and messages sent',
    }),
    ApiResponse({
      status: 403,
      description: 'Admin or owner role required',
    }),
  );

export const SwaggerCreateInstanceAndTriggerForConfig = () =>
  applyDecorators(
    ApiOperation({
      summary:
        'Create standup instance for specific config and send Slack message (admin/owner only)',
      description:
        'Creates a standup instance for a specific configuration and immediately sends Slack notification.',
    }),
    ApiParam({ name: 'configId', description: 'Standup configuration ID' }),
    ApiBody({
      schema: {
        type: 'object',
        properties: {
          targetDate: { type: 'string', format: 'date', example: '2024-01-15' },
        },
      },
    }),
    ApiResponse({
      status: 201,
      description: 'Standup instance created and message sent for specific config',
    }),
    ApiResponse({
      status: 403,
      description: 'Admin or owner role required',
    }),
    ApiResponse({
      status: 404,
      description: 'Standup config not found',
    }),
  );

export const SwaggerTriggerReminder = () =>
  applyDecorators(
    ApiOperation({
      summary:
        'Manually trigger Slack reminder for an existing standup instance (admin/owner only)',
      description: 'Sends a Slack reminder for an existing standup instance.',
    }),
    ApiParam({ name: 'id', description: 'Standup instance ID' }),
    ApiResponse({
      status: 200,
      description: 'Slack reminder sent successfully',
    }),
    ApiResponse({
      status: 403,
      description: 'Admin or owner role required',
    }),
    ApiResponse({
      status: 404,
      description: 'Standup instance not found',
    }),
  );

export const SwaggerGetNextStandupDate = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get next scheduled standup date for a team',
      description: 'Calculates and returns the next scheduled standup date for the specified team.',
    }),
    ApiParam({ name: 'teamId', description: 'Team ID' }),
    ApiResponse({
      status: 200,
      description: 'Next standup date',
    }),
    ApiResponse({
      status: 404,
      description: 'Team not found or no active configuration',
    }),
  );

export const SwaggerShouldCreateToday = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Check if a team should have a standup today',
      description:
        'Determines whether a team should have a standup on the specified date based on their configuration.',
    }),
    ApiParam({ name: 'teamId', description: 'Team ID' }),
    ApiQuery({ name: 'date', required: false, description: 'Date to check (defaults to today)' }),
    ApiResponse({
      status: 200,
      description: 'Whether team should have standup today',
    }),
  );
