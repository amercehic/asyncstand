import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiBody, ApiResponse, ApiParam } from '@nestjs/swagger';
import { InviteMemberDto } from '@/auth/dto/invite-member.dto';
import { AcceptInviteDto } from '@/auth/dto/accept-invite.dto';
import { UpdateMemberDto } from '@/auth/dto/update-member.dto';
import { OrgRole, OrgMemberStatus } from '@prisma/client';

export const SwaggerListMembers = () =>
  applyDecorators(
    ApiOperation({
      summary: 'List organization members',
      description:
        'Retrieves a list of all members in the current organization. Requires authentication and active membership status.',
    }),
    ApiResponse({
      status: 200,
      description: 'Members retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          members: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
                email: { type: 'string', example: 'john.doe@example.com' },
                name: { type: 'string', example: 'John Doe' },
                role: { type: 'string', enum: Object.values(OrgRole), example: 'member' },
                status: { type: 'string', enum: Object.values(OrgMemberStatus), example: 'active' },
                joinedAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00Z' },
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
      description: 'Forbidden - insufficient permissions or suspended user',
    }),
  );

export const SwaggerInviteMember = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Invite a new member to the organization',
      description:
        'Sends an invitation to join the organization. Only owners and admins can invite new members. The invitation includes a secure token that expires after 7 days.',
    }),
    ApiBody({ type: InviteMemberDto }),
    ApiResponse({
      status: 201,
      description: 'Invitation sent successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Invitation sent successfully' },
          invitedEmail: { type: 'string', example: 'newmember@example.com' },
          inviteToken: {
            type: 'string',
            example: 'abc123def456...',
            description: 'Invitation token (for testing only)',
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
      description: 'Forbidden - insufficient permissions or suspended user',
    }),
    ApiResponse({
      status: 409,
      description: 'Conflict - user already a member of this organization',
    }),
  );

export const SwaggerAcceptInvite = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Accept an organization invitation',
      description:
        'Accepts an invitation to join an organization using the token received via email. This endpoint does not require prior authentication. For new users, provide name and password to register. For existing users, these fields are optional.',
    }),
    ApiBody({ type: AcceptInviteDto }),
    ApiResponse({
      status: 200,
      description: 'Invitation accepted successfully',
      schema: {
        type: 'object',
        properties: {
          accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          expiresIn: { type: 'number', example: 900 },
          refreshToken: { type: 'string', example: 'refresh-token-value' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
              email: { type: 'string', example: 'user@example.com' },
              name: { type: 'string', example: 'John Doe' },
              role: { type: 'string', enum: Object.values(OrgRole), example: 'member' },
            },
          },
          organization: {
            type: 'object',
            properties: {
              id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
              name: { type: 'string', example: 'Example Organization' },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Bad request - invalid or expired token',
    }),
  );

export const SwaggerUpdateMember = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Update member role or suspend member',
      description:
        "Updates a member's role or suspension status. Only owners and admins can update members. Owners cannot be modified, and only owners can modify admins.",
    }),
    ApiParam({
      name: 'id',
      description: 'User ID of the member to update',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiBody({ type: UpdateMemberDto }),
    ApiResponse({
      status: 200,
      description: 'Member updated successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Member updated successfully' },
          member: {
            type: 'object',
            properties: {
              id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
              email: { type: 'string', example: 'john.doe@example.com' },
              role: { type: 'string', enum: Object.values(OrgRole), example: 'admin' },
              status: { type: 'string', enum: Object.values(OrgMemberStatus), example: 'active' },
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
      description: 'Forbidden - insufficient permissions or suspended user',
    }),
    ApiResponse({
      status: 404,
      description: 'Not found - member not found',
    }),
  );

export const SwaggerDeleteMember = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Remove member from organization',
      description:
        'Removes a member from the organization. Only owners and admins can delete members. Owners cannot be deleted, and only owners can delete admins.',
    }),
    ApiParam({
      name: 'id',
      description: 'User ID of the member to delete',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiResponse({
      status: 200,
      description: 'Member removed successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Member deleted successfully' },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - invalid or missing authentication token',
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - insufficient permissions or suspended user',
    }),
    ApiResponse({
      status: 404,
      description: 'Not found - member not found',
    }),
  );
