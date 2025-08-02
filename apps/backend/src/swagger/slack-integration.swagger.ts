import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiParam, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

export const SwaggerListSlackIntegrations = () =>
  applyDecorators(
    ApiOperation({
      summary: 'List organization Slack integrations',
      description:
        'Retrieves all Slack workspace integrations for the organization, including their current sync status, token health, and configuration details. Only admin and owner roles can access this endpoint. Returns sync timestamps and any error messages from the last synchronization attempts.',
    }),
    ApiBearerAuth('JWT-auth'),
    ApiResponse({
      status: 200,
      description: 'List of Slack integrations retrieved successfully',
      schema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: '746720d3-5908-4e5b-ad39-133677f57cee',
              description: 'Unique integration identifier',
            },
            externalTeamId: {
              type: 'string',
              example: 'T098JDJDK0R',
              description: 'Slack workspace team ID',
            },
            tokenStatus: {
              type: 'string',
              enum: ['ok', 'expired', 'revoked'],
              example: 'ok',
              description: 'Current status of the Slack API tokens',
            },
            scopes: {
              type: 'array',
              items: { type: 'string' },
              example: ['chat:write', 'channels:read', 'channels:history', 'users:read'],
              description: 'OAuth scopes granted by the Slack workspace',
            },
            installedAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-08-02T10:30:00.000Z',
              description: 'When the integration was first installed',
            },
            syncState: {
              type: 'object',
              nullable: true,
              properties: {
                lastUsersSyncAt: {
                  type: 'string',
                  format: 'date-time',
                  nullable: true,
                  example: '2024-08-02T10:45:00.000Z',
                  description: 'Last successful users synchronization timestamp',
                },
                lastChannelsSyncAt: {
                  type: 'string',
                  format: 'date-time',
                  nullable: true,
                  example: '2024-08-02T10:45:00.000Z',
                  description: 'Last successful channels synchronization timestamp',
                },
                errorMsg: {
                  type: 'string',
                  nullable: true,
                  example: null,
                  description: 'Error message from the last sync attempt if any',
                },
              },
              description: 'Current synchronization state and history',
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

export const SwaggerTriggerSlackSync = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Trigger manual Slack workspace synchronization',
      description:
        'Manually initiates synchronization of users and channels from the specified Slack workspace. This operation fetches all workspace members and public channels that the bot has access to, then updates the local database. The sync process filters out bots, deleted users, and archived channels. Returns detailed statistics about the sync operation including counts of added/updated records and any errors encountered.',
    }),
    ApiBearerAuth('JWT-auth'),
    ApiParam({
      name: 'id',
      description: 'Integration ID to synchronize',
      type: 'string',
      example: '746720d3-5908-4e5b-ad39-133677f57cee',
    }),
    ApiResponse({
      status: 201,
      description: 'Sync operation completed successfully',
      schema: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true,
            description: 'Whether the sync operation completed successfully',
          },
          usersAdded: {
            type: 'number',
            example: 12,
            description: 'Number of new users added to the database',
          },
          usersUpdated: {
            type: 'number',
            example: 3,
            description: 'Number of existing users updated',
          },
          channelsAdded: {
            type: 'number',
            example: 5,
            description: 'Number of new channels added to the database',
          },
          channelsUpdated: {
            type: 'number',
            example: 2,
            description: 'Number of existing channels updated',
          },
          errors: {
            type: 'array',
            items: { type: 'string' },
            example: [],
            description: 'List of errors encountered during sync (empty if successful)',
          },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Bad request - invalid integration ID or token status not ok',
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - invalid or missing JWT token',
    }),
    ApiResponse({
      status: 403,
      description:
        'Forbidden - integration belongs to different organization or insufficient permissions',
    }),
    ApiResponse({
      status: 404,
      description: 'Not found - integration does not exist',
    }),
    ApiResponse({
      status: 429,
      description: 'Too many requests - Slack API rate limit exceeded',
    }),
    ApiResponse({
      status: 502,
      description: 'Bad gateway - Slack API error',
    }),
  );

export const SwaggerRemoveSlackIntegration = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Remove Slack integration and all associated data',
      description:
        'Permanently removes a Slack integration from the organization, including all associated teams, channels, users, standup configurations, and historical data. This is a destructive operation that cannot be undone. All standup instances, answers, and sync state will be deleted. The operation is performed within a database transaction to ensure data consistency.',
    }),
    ApiBearerAuth('JWT-auth'),
    ApiParam({
      name: 'id',
      description: 'Integration ID to remove',
      type: 'string',
      example: '746720d3-5908-4e5b-ad39-133677f57cee',
    }),
    ApiResponse({
      status: 200,
      description: 'Integration removed successfully',
      schema: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true,
            description: 'Confirms the integration was successfully removed',
          },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Bad request - invalid integration ID or not a Slack integration',
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - invalid or missing JWT token',
    }),
    ApiResponse({
      status: 403,
      description:
        'Forbidden - integration belongs to different organization or insufficient permissions',
    }),
    ApiResponse({
      status: 404,
      description: 'Not found - integration does not exist',
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error - failed to remove integration',
    }),
  );

export const SwaggerSlackOAuthStart = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Initiate Slack OAuth authorization flow',
      description:
        'Starts the Slack OAuth 2.0 authorization process by redirecting to Slack with the appropriate scopes and state parameter. The state parameter contains the organization ID for security validation. Users will be redirected to Slack to authorize the AsyncStand app to access their workspace.',
    }),
    ApiQuery({
      name: 'orgId',
      description: 'Organization ID to associate the integration with',
      type: 'string',
      example: '5a8e9973-76b7-4d43-bb28-1260129acf9d',
    }),
    ApiResponse({
      status: 302,
      description: 'Redirect to Slack OAuth authorization URL',
      headers: {
        Location: {
          description: 'Slack OAuth authorization URL',
          schema: {
            type: 'string',
            example: 'https://slack.com/oauth/v2/authorize?client_id=...&scope=...&state=...',
          },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Bad request - invalid or missing organization ID',
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - Slack OAuth is not enabled',
    }),
    ApiResponse({
      status: 404,
      description: 'Not found - organization does not exist',
    }),
  );

export const SwaggerSlackOAuthCallback = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Handle Slack OAuth authorization callback',
      description:
        'Processes the OAuth callback from Slack, exchanges the authorization code for access tokens, and stores the integration in the database with encrypted tokens. Validates the state parameter for security and handles duplicate workspace connections.',
    }),
    ApiQuery({
      name: 'code',
      description: 'OAuth authorization code from Slack',
      type: 'string',
      example:
        '9290460461025.9316029341520.9cad235273938b13a0aa71f09c8f65af8fe05f1e357339a70a3e4545a6c595ef',
    }),
    ApiQuery({
      name: 'state',
      description: 'State parameter for CSRF protection',
      type: 'string',
      example: '10d8494a785fa133d9bb9406786cb2825da67533140296180bfff9a7c8e8c692',
    }),
    ApiResponse({
      status: 200,
      description: 'OAuth flow completed successfully',
      schema: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true,
            description: 'Confirms the integration was successfully created',
          },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Bad request - invalid or expired state parameter, or Slack API error',
    }),
    ApiResponse({
      status: 409,
      description: 'Conflict - Slack workspace already connected to this organization',
    }),
    ApiResponse({
      status: 502,
      description: 'Bad gateway - failed to exchange code with Slack',
    }),
  );
