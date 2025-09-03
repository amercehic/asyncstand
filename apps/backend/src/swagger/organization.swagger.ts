import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { UpdateOrganizationDto } from '@/auth/dto/update-organization.dto';

export function SwaggerGetOrganization() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get organization details',
      description: 'Retrieve the current organization information for the authenticated user',
    }),
    ApiResponse({
      status: 200,
      description: 'Organization details retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            example: '123e4567-e89b-12d3-a456-426614174000',
          },
          name: {
            type: 'string',
            example: 'Acme Corporation',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2023-12-01T10:00:00Z',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            example: '2023-12-01T10:00:00Z',
          },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - Invalid or missing authentication token',
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - User is not a member of this organization',
    }),
  );
}

export function SwaggerUpdateOrganization() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update organization name',
      description: 'Update the name of the current organization (requires owner role)',
    }),
    ApiBody({
      type: UpdateOrganizationDto,
      description: 'Organization update data',
    }),
    ApiResponse({
      status: 200,
      description: 'Organization name updated successfully',
      schema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            example: '123e4567-e89b-12d3-a456-426614174000',
          },
          name: {
            type: 'string',
            example: 'Updated Organization Name',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2023-12-01T10:00:00Z',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            example: '2023-12-01T12:30:00Z',
          },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Bad Request - Invalid input data',
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - Invalid or missing authentication token',
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - User does not have permission to update organization',
    }),
    ApiResponse({
      status: 404,
      description: 'Not Found - Organization not found',
    }),
  );
}
