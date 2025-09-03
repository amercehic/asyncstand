import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CreateFeatureDto } from '@/features/dto/create-feature.dto';
import { UpdateFeatureDto } from '@/features/dto/update-feature.dto';

export const SwaggerGetEnabledFeatures = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get all enabled features for the current organization',
      description:
        "Retrieves a list of all feature flags that are currently enabled for the authenticated user's organization. " +
        'This takes into account global feature settings, environment restrictions, plan-based features, and rollout configurations.',
    }),
    ApiResponse({
      status: 200,
      description: 'List of enabled features returned successfully',
      schema: {
        type: 'object',
        properties: {
          features: {
            type: 'array',
            items: {
              type: 'string',
            },
            example: ['advanced-analytics', 'custom-integrations', 'team-management'],
            description: 'Array of feature keys that are enabled for the organization',
          },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - invalid or missing authentication token',
    }),
  );

export const SwaggerCheckFeature = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Check if a specific feature is enabled',
      description:
        "Checks whether a specific feature flag is enabled for the authenticated user's organization. " +
        'Returns detailed information about the feature status including the source of the decision (global, environment, plan, or rollout).',
    }),
    ApiParam({
      name: 'featureKey',
      description: 'The unique key identifier for the feature to check',
      example: 'advanced-analytics',
    }),
    ApiResponse({
      status: 200,
      description: 'Feature status returned successfully',
      schema: {
        type: 'object',
        properties: {
          enabled: {
            type: 'boolean',
            description: 'Whether the feature is enabled for the organization',
          },
          source: {
            type: 'string',
            enum: ['global', 'environment', 'plan', 'rollout'],
            description: 'The source that determined the feature status',
          },
          value: {
            type: 'string',
            description: 'Optional custom value associated with the feature',
            nullable: true,
          },
          reason: {
            type: 'string',
            description: 'Optional reason explaining why the feature is disabled',
            nullable: true,
          },
        },
        example: {
          enabled: true,
          source: 'plan',
          value: 'premium',
          reason: null,
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - invalid or missing authentication token',
    }),
  );

export const SwaggerCheckQuota = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Check quota usage for a specific resource type',
      description:
        'Retrieves current usage and limits for a specific quota type (members, teams, standups, storage, or integrations) ' +
        "for the authenticated user's organization. This helps enforce plan-based resource limits.",
    }),
    ApiParam({
      name: 'quotaType',
      description: 'The type of quota to check',
      enum: ['members', 'teams', 'standups', 'storage', 'integrations'],
      example: 'members',
    }),
    ApiResponse({
      status: 200,
      description: 'Quota information returned successfully',
      schema: {
        type: 'object',
        properties: {
          current: {
            type: 'number',
            description: 'Current usage count for the quota type',
          },
          limit: {
            type: 'number',
            description: 'Maximum allowed limit for the quota type (null for unlimited)',
            nullable: true,
          },
          exceeded: {
            type: 'boolean',
            description: 'Whether the quota has been exceeded',
          },
        },
        example: {
          current: 8,
          limit: 10,
          exceeded: false,
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Bad request - invalid quota type specified',
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - invalid or missing authentication token',
    }),
  );

export const SwaggerListFeatures = () =>
  applyDecorators(
    ApiOperation({
      summary: 'List all features (super admin only)',
      description:
        'Retrieves a comprehensive list of all feature flags in the system, including their configuration, plan associations, and override counts. ' +
        'This endpoint is restricted to super administrators only.',
    }),
    ApiQuery({
      name: 'category',
      required: false,
      description: 'Optional category filter to limit results to features in a specific category',
      example: 'analytics',
    }),
    ApiResponse({
      status: 200,
      description: 'Features list returned successfully',
      schema: {
        type: 'object',
        properties: {
          features: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                key: { type: 'string' },
                name: { type: 'string' },
                description: { type: 'string', nullable: true },
                isEnabled: { type: 'boolean' },
                environment: { type: 'array', items: { type: 'string' } },
                category: { type: 'string', nullable: true },
                isPlanBased: { type: 'boolean' },
                requiresAdmin: { type: 'boolean' },
                rolloutType: { type: 'string', nullable: true },
                rolloutValue: { type: 'object', nullable: true },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
                planFeatures: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      plan: { type: 'object' },
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
      description: 'Unauthorized - invalid or missing authentication token',
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - requires super admin role',
    }),
  );

export const SwaggerCreateFeature = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Create a new feature flag (super admin only)',
      description:
        'Creates a new feature flag in the system with the specified configuration. ' +
        'This endpoint is restricted to super administrators only.',
    }),
    ApiBody({ type: CreateFeatureDto }),
    ApiResponse({
      status: 201,
      description: 'Feature created successfully',
      schema: {
        type: 'object',
        properties: {
          feature: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              key: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string', nullable: true },
              isEnabled: { type: 'boolean' },
              environment: { type: 'array', items: { type: 'string' } },
              category: { type: 'string', nullable: true },
              isPlanBased: { type: 'boolean' },
              requiresAdmin: { type: 'boolean' },
              rolloutType: { type: 'string', nullable: true },
              rolloutValue: { type: 'object', nullable: true },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
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
      description: 'Unauthorized - invalid or missing authentication token',
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - requires super admin role',
    }),
    ApiResponse({
      status: 409,
      description: 'Conflict - feature key already exists',
    }),
  );

export const SwaggerUpdateFeature = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Update an existing feature flag (super admin only)',
      description:
        'Updates the configuration of an existing feature flag. Only the provided fields will be updated. ' +
        'This endpoint is restricted to super administrators only.',
    }),
    ApiParam({
      name: 'featureKey',
      description: 'The unique key identifier for the feature to update',
      example: 'advanced-analytics',
    }),
    ApiBody({ type: UpdateFeatureDto }),
    ApiResponse({
      status: 200,
      description: 'Feature updated successfully',
      schema: {
        type: 'object',
        properties: {
          feature: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              key: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string', nullable: true },
              isEnabled: { type: 'boolean' },
              environment: { type: 'array', items: { type: 'string' } },
              category: { type: 'string', nullable: true },
              isPlanBased: { type: 'boolean' },
              requiresAdmin: { type: 'boolean' },
              rolloutType: { type: 'string', nullable: true },
              rolloutValue: { type: 'object', nullable: true },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
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
      description: 'Unauthorized - invalid or missing authentication token',
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - requires super admin role',
    }),
    ApiResponse({
      status: 404,
      description: 'Not found - feature does not exist',
    }),
  );
