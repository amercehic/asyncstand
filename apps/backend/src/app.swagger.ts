import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

export const SwaggerGetHello = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get welcome message',
      description:
        'Returns a simple welcome message to confirm the API is running and accessible. This endpoint is useful for health checks and API connectivity testing.',
    }),
    ApiResponse({
      status: 200,
      description: 'Welcome message returned successfully',
      schema: {
        type: 'string',
        example: 'Hello World!',
      },
    }),
  );

export const SwaggerGetHealth = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get application health status',
      description:
        'Provides comprehensive health information about the application including status, timestamp, version, and environment details. This endpoint is commonly used by monitoring systems, load balancers, and deployment tools to verify the application is healthy and ready to serve requests.',
    }),
    ApiResponse({
      status: 200,
      description: 'Health status returned successfully',
      schema: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'ok' },
          timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
          version: { type: 'string', example: '1.0.0' },
          envInfo: { type: 'object' },
        },
      },
    }),
  );
