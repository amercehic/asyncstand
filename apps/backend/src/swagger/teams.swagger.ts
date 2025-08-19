import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiParam, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { CreateTeamDto } from '@/teams/dto/create-team.dto';
import { UpdateTeamDto } from '@/teams/dto/update-team.dto';
import { AddTeamMemberDto } from '@/teams/dto/add-team-member.dto';

export const SwaggerCreateTeam = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Create a new team',
      description:
        'Creates a new team within the organization and assigns it to a specific Slack channel. The team name must be unique within the organization, and the channel cannot be assigned to another team. Validates that the bot has access to the specified channel before creating the team.',
    }),
    ApiBearerAuth('JWT-auth'),
    ApiBody({ type: CreateTeamDto }),
    ApiResponse({
      status: 201,
      description: 'Team created successfully',
      schema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: '123e4567-e89b-12d3-a456-426614174000',
            description: 'Unique team identifier',
          },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Bad request - validation failed or channel access denied',
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - invalid or missing JWT token',
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - insufficient permissions (requires admin or owner role)',
    }),
    ApiResponse({
      status: 404,
      description: 'Not found - integration does not exist or belong to organization',
    }),
    ApiResponse({
      status: 409,
      description: 'Conflict - team name already exists or channel already assigned',
    }),
  );

export const SwaggerListTeams = () =>
  applyDecorators(
    ApiOperation({
      summary: 'List organization teams',
      description:
        'Retrieves all teams within the organization, including member counts, standup configuration status, and creation details. Returns teams ordered by creation date (newest first).',
    }),
    ApiBearerAuth('JWT-auth'),
    ApiResponse({
      status: 200,
      description: 'Teams retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          teams: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  example: '123e4567-e89b-12d3-a456-426614174000',
                  description: 'Unique team identifier',
                },
                name: {
                  type: 'string',
                  example: 'Engineering Team',
                  description: 'Team name',
                },
                channelName: {
                  type: 'string',
                  example: 'engineering',
                  description: 'Slack channel name',
                },
                memberCount: {
                  type: 'number',
                  example: 8,
                  description: 'Number of team members',
                },
                hasStandupConfig: {
                  type: 'boolean',
                  example: true,
                  description: 'Whether team has standup configuration',
                },
                createdAt: {
                  type: 'string',
                  format: 'date-time',
                  example: '2024-08-02T15:30:00.000Z',
                  description: 'Team creation timestamp',
                },
                createdBy: {
                  type: 'object',
                  properties: {
                    name: {
                      type: 'string',
                      example: 'John Doe',
                      description: 'Name of user who created the team',
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - invalid or missing JWT token',
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - insufficient permissions',
    }),
  );

export const SwaggerGetTeamDetails = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get team details',
      description:
        'Retrieves comprehensive details for a specific team, including all members, integration information, channel details, and standup configuration if present. Returns full audit trail of team creation and member additions.',
    }),
    ApiBearerAuth('JWT-auth'),
    ApiParam({
      name: 'id',
      description: 'Team ID to retrieve details for',
      type: 'string',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiResponse({
      status: 200,
      description: 'Team details retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: '123e4567-e89b-12d3-a456-426614174000',
            description: 'Unique team identifier',
          },
          name: {
            type: 'string',
            example: 'Engineering Team',
            description: 'Team name',
          },
          description: {
            type: 'string',
            example: 'Our main engineering team',
            description: 'Team description',
            nullable: true,
          },
          timezone: {
            type: 'string',
            example: 'America/New_York',
            description: 'Team timezone for standup scheduling',
          },
          integration: {
            type: 'object',
            properties: {
              teamName: {
                type: 'string',
                example: 'T098JDJDK0R',
                description: 'Slack workspace team ID',
              },
            },
          },
          channel: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                example: 'C1234567890',
                description: 'Slack channel ID',
              },
              name: {
                type: 'string',
                example: 'engineering',
                description: 'Slack channel name',
              },
            },
          },
          members: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  example: '456e7890-e89b-12d3-a456-426614174000',
                  description: 'Team member ID',
                },
                name: {
                  type: 'string',
                  example: 'Jane Smith',
                  description: 'Member display name',
                },
                platformUserId: {
                  type: 'string',
                  example: 'U1234567890',
                  description: 'Slack user ID',
                },
                addedAt: {
                  type: 'string',
                  format: 'date-time',
                  example: '2024-08-02T15:30:00.000Z',
                  description: 'When member was added to team',
                },
                addedBy: {
                  type: 'object',
                  nullable: true,
                  properties: {
                    name: {
                      type: 'string',
                      example: 'John Doe',
                      description: 'Name of user who added this member',
                    },
                  },
                },
              },
            },
          },
          standupConfig: {
            type: 'object',
            nullable: true,
            properties: {
              id: {
                type: 'string',
                example: '789e1234-e89b-12d3-a456-426614174000',
                description: 'Standup configuration ID',
              },
              questions: {
                type: 'array',
                items: { type: 'string' },
                example: [
                  'What did you work on yesterday?',
                  'What will you work on today?',
                  'Any blockers?',
                ],
                description: 'Standup questions',
              },
              weekdays: {
                type: 'array',
                items: { type: 'number' },
                example: [1, 2, 3, 4, 5],
                description: 'Days of week for standups (0=Sunday)',
              },
              timeLocal: {
                type: 'string',
                example: '09:00',
                description: 'Local time for standups',
              },
              reminderMinutesBefore: {
                type: 'number',
                example: 10,
                description: 'Reminder time before standup',
              },
            },
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2024-08-02T15:30:00.000Z',
            description: 'Team creation timestamp',
          },
          createdBy: {
            type: 'object',
            nullable: true,
            properties: {
              name: {
                type: 'string',
                example: 'John Doe',
                description: 'Name of user who created the team',
              },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - invalid or missing JWT token',
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - insufficient permissions',
    }),
    ApiResponse({
      status: 404,
      description: 'Not found - team does not exist or access denied',
    }),
  );

export const SwaggerUpdateTeam = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Update team details',
      description:
        'Updates team information such as name, channel assignment, timezone, or description. Validates that new team names are unique within the organization and new channel assignments are available. All fields are optional for partial updates.',
    }),
    ApiBearerAuth('JWT-auth'),
    ApiParam({
      name: 'id',
      description: 'Team ID to update',
      type: 'string',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiBody({ type: UpdateTeamDto }),
    ApiResponse({
      status: 200,
      description: 'Team updated successfully',
      schema: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true,
            description: 'Confirms the team was successfully updated',
          },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Bad request - validation failed or channel access denied',
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - invalid or missing JWT token',
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - insufficient permissions (requires admin or owner role)',
    }),
    ApiResponse({
      status: 404,
      description: 'Not found - team does not exist or access denied',
    }),
    ApiResponse({
      status: 409,
      description: 'Conflict - team name already exists or channel already assigned',
    }),
  );

export const SwaggerDeleteTeam = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Delete team and all associated data',
      description:
        'Permanently deletes a team and all associated data including members, standup configurations, standup instances, answers, and digest posts. This is a destructive operation that cannot be undone. The operation is performed within a database transaction to ensure data consistency.',
    }),
    ApiBearerAuth('JWT-auth'),
    ApiParam({
      name: 'id',
      description: 'Team ID to delete',
      type: 'string',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiResponse({
      status: 200,
      description: 'Team deleted successfully',
      schema: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true,
            description: 'Confirms the team was successfully deleted',
          },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - invalid or missing JWT token',
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - insufficient permissions (requires admin or owner role)',
    }),
    ApiResponse({
      status: 404,
      description: 'Not found - team does not exist or access denied',
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error - failed to delete team',
    }),
  );

export const SwaggerGetTeamMembers = () =>
  applyDecorators(
    ApiOperation({
      summary: 'List team members',
      description:
        'Retrieves all members of a specific team, including their display names, Slack user IDs, and audit information about when and by whom they were added to the team.',
    }),
    ApiBearerAuth('JWT-auth'),
    ApiParam({
      name: 'id',
      description: 'Team ID to list members for',
      type: 'string',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiResponse({
      status: 200,
      description: 'Team members retrieved successfully',
      schema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: '456e7890-e89b-12d3-a456-426614174000',
              description: 'Team member ID',
            },
            name: {
              type: 'string',
              example: 'Jane Smith',
              description: 'Member display name',
            },
            platformUserId: {
              type: 'string',
              example: 'U1234567890',
              description: 'Slack user ID',
            },
            addedAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-08-02T15:30:00.000Z',
              description: 'When member was added to team',
            },
            addedBy: {
              type: 'object',
              nullable: true,
              properties: {
                name: {
                  type: 'string',
                  example: 'John Doe',
                  description: 'Name of user who added this member',
                },
              },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - invalid or missing JWT token',
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - insufficient permissions',
    }),
    ApiResponse({
      status: 404,
      description: 'Not found - team does not exist or access denied',
    }),
  );

export const SwaggerAddTeamMember = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Add member to team',
      description:
        'Adds a Slack user to a team by their Slack user ID. The user must be a member of the Slack workspace associated with the team. Users can belong to multiple teams. Prevents duplicate memberships.',
    }),
    ApiBearerAuth('JWT-auth'),
    ApiParam({
      name: 'id',
      description: 'Team ID to add member to',
      type: 'string',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiBody({ type: AddTeamMemberDto }),
    ApiResponse({
      status: 201,
      description: 'Member added to team successfully',
      schema: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true,
            description: 'Confirms the member was successfully added',
          },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Bad request - validation failed',
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - invalid or missing JWT token',
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - insufficient permissions (requires admin or owner role)',
    }),
    ApiResponse({
      status: 404,
      description: 'Not found - team or member does not exist',
    }),
    ApiResponse({
      status: 409,
      description: 'Conflict - member is already in this team',
    }),
  );

export const SwaggerRemoveTeamMember = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Remove member from team',
      description:
        'Removes a member from a team. This does not delete the member from the organization or other teams they may belong to. Only removes the association between the member and this specific team.',
    }),
    ApiBearerAuth('JWT-auth'),
    ApiParam({
      name: 'id',
      description: 'Team ID to remove member from',
      type: 'string',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiParam({
      name: 'memberId',
      description: 'Member ID to remove from team',
      type: 'string',
      example: '456e7890-e89b-12d3-a456-426614174000',
    }),
    ApiResponse({
      status: 200,
      description: 'Member removed from team successfully',
      schema: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true,
            description: 'Confirms the member was successfully removed',
          },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - invalid or missing JWT token',
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - insufficient permissions (requires admin or owner role)',
    }),
    ApiResponse({
      status: 404,
      description: 'Not found - team membership does not exist',
    }),
  );

export const SwaggerGetAvailableChannels = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get available Slack channels for team assignment',
      description:
        "Retrieves all public Slack channels that the bot has access to within the organization's integrations. Shows which channels are already assigned to teams and which are available for new team assignments.",
    }),
    ApiBearerAuth('JWT-auth'),
    ApiResponse({
      status: 200,
      description: 'Available channels retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          channels: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  example: 'C1234567890',
                  description: 'Slack channel ID',
                },
                name: {
                  type: 'string',
                  example: 'engineering',
                  description: 'Slack channel name',
                },
                isAssigned: {
                  type: 'boolean',
                  example: false,
                  description: 'Whether channel is already assigned to a team',
                },
                assignedTeamName: {
                  type: 'string',
                  example: 'Engineering Team',
                  description: 'Name of team assigned to this channel (if any)',
                  nullable: true,
                },
              },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - invalid or missing JWT token',
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - insufficient permissions (requires admin or owner role)',
    }),
  );

export const SwaggerGetAvailableMembers = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get available Slack users for team membership',
      description:
        "Retrieves all Slack users that have been synced from the organization's integrations and are available to be added to teams. Shows how many teams each user is currently a member of.",
    }),
    ApiBearerAuth('JWT-auth'),
    ApiResponse({
      status: 200,
      description: 'Available members retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          members: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  example: '456e7890-e89b-12d3-a456-426614174000',
                  description: 'Team member ID',
                },
                name: {
                  type: 'string',
                  example: 'Jane Smith',
                  description: 'Member display name',
                },
                platformUserId: {
                  type: 'string',
                  example: 'U1234567890',
                  description: 'Slack user ID',
                },
                inTeamCount: {
                  type: 'number',
                  example: 2,
                  description: 'Number of teams this member belongs to',
                },
              },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - invalid or missing JWT token',
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - insufficient permissions (requires admin or owner role)',
    }),
  );

export const SwaggerGetChannelsList = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get all channels with detailed information',
      description:
        'Retrieves all channels from organization integrations with comprehensive metadata including topic, purpose, member count, team assignments, and sync status. Channels are ordered by archived status and name.',
    }),
    ApiBearerAuth('JWT-auth'),
    ApiResponse({
      status: 200,
      description: 'Channels list retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          channels: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  example: '123e4567-e89b-12d3-a456-426614174000',
                  description: 'Internal channel ID',
                },
                name: {
                  type: 'string',
                  example: 'engineering',
                  description: 'Channel name',
                },
                topic: {
                  type: 'string',
                  example: 'Engineering team discussions',
                  description: 'Channel topic/description',
                  nullable: true,
                },
                purpose: {
                  type: 'string',
                  example: 'Daily standups and technical discussions',
                  description: 'Channel purpose',
                  nullable: true,
                },
                isPrivate: {
                  type: 'boolean',
                  example: false,
                  description: 'Whether channel is private',
                },
                isArchived: {
                  type: 'boolean',
                  example: false,
                  description: 'Whether channel is archived',
                },
                memberCount: {
                  type: 'number',
                  example: 12,
                  description: 'Number of members in channel',
                  nullable: true,
                },
                isAssigned: {
                  type: 'boolean',
                  example: true,
                  description: 'Whether channel is assigned to a team',
                },
                assignedTeamName: {
                  type: 'string',
                  example: 'Engineering Team',
                  description: 'Name of team assigned to this channel',
                  nullable: true,
                },
                lastSyncAt: {
                  type: 'string',
                  format: 'date-time',
                  example: '2024-08-02T15:30:00.000Z',
                  description: 'When channel info was last synced',
                  nullable: true,
                },
              },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - invalid or missing JWT token',
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - insufficient permissions',
    }),
  );
