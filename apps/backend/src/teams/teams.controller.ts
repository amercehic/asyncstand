import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '@/auth/guards/roles.guard';
import { CurrentOrg } from '@/auth/decorators/current-org.decorator';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { TeamManagementService } from '@/teams/team-management.service';
import { CreateTeamDto } from '@/teams/dto/create-team.dto';
import { UpdateTeamDto } from '@/teams/dto/update-team.dto';
import { AddTeamMemberDto } from '@/teams/dto/add-team-member.dto';
import { ValidateChannelDto } from '@/teams/dto/validate-channel.dto';
import {
  TeamListResponse,
  TeamDetailsResponse,
  AvailableChannelsResponse,
  AvailableMembersResponse,
  ChannelValidationResponse,
} from '@/teams/types/team-management.types';
import { OrgRole } from '@prisma/client';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { AuditActorType, AuditCategory, AuditSeverity, ResourceAction } from '@/common/audit/types';
import {
  SwaggerCreateTeam,
  SwaggerListTeams,
  SwaggerGetTeamDetails,
  SwaggerUpdateTeam,
  SwaggerDeleteTeam,
  SwaggerGetTeamMembers,
  SwaggerAddTeamMember,
  SwaggerRemoveTeamMember,
  SwaggerGetAvailableChannels,
  SwaggerGetAvailableMembers,
  SwaggerValidateChannelAccess,
} from '@/swagger/teams.swagger';

interface AuthenticatedUser {
  userId: string;
  orgId: string;
  role: string;
}

@ApiTags('Team Management')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('teams')
export class TeamsController {
  constructor(
    private readonly teamManagementService: TeamManagementService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Post()
  @Roles(OrgRole.admin, OrgRole.owner)
  @SwaggerCreateTeam()
  async createTeam(
    @Body(ValidationPipe) createTeamDto: CreateTeamDto,
    @CurrentOrg() orgId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ id: string }> {
    const result = await this.teamManagementService.createTeam(orgId, user.userId, createTeamDto);

    await this.auditLogService.log({
      action: 'team.created',
      orgId,
      actorType: AuditActorType.USER,
      actorUserId: user.userId,
      category: AuditCategory.DATA_MODIFICATION,
      severity: AuditSeverity.MEDIUM,
      requestData: {
        method: 'POST',
        path: '/teams',
        ipAddress: '127.0.0.1',
        body: createTeamDto,
      },
      resources: [
        {
          type: 'team',
          id: result.id,
          action: ResourceAction.CREATED,
        },
      ],
    });

    return result;
  }

  @Get()
  @Roles(OrgRole.admin, OrgRole.owner, OrgRole.member)
  @SwaggerListTeams()
  async listTeams(@CurrentOrg() orgId: string): Promise<TeamListResponse> {
    return this.teamManagementService.listTeams(orgId);
  }

  @Get(':id')
  @Roles(OrgRole.admin, OrgRole.owner, OrgRole.member)
  @SwaggerGetTeamDetails()
  async getTeamDetails(
    @Param('id') teamId: string,
    @CurrentOrg() orgId: string,
  ): Promise<TeamDetailsResponse> {
    return this.teamManagementService.getTeamDetails(teamId, orgId);
  }

  @Put(':id')
  @Roles(OrgRole.admin, OrgRole.owner)
  @SwaggerUpdateTeam()
  async updateTeam(
    @Param('id') teamId: string,
    @Body(ValidationPipe) updateTeamDto: UpdateTeamDto,
    @CurrentOrg() orgId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean }> {
    await this.teamManagementService.updateTeam(teamId, orgId, updateTeamDto);

    await this.auditLogService.log({
      action: 'team.updated',
      orgId,
      actorType: AuditActorType.USER,
      actorUserId: user.userId,
      category: AuditCategory.DATA_MODIFICATION,
      severity: AuditSeverity.MEDIUM,
      requestData: {
        method: 'PUT',
        path: `/teams/${teamId}`,
        ipAddress: '127.0.0.1',
        body: updateTeamDto,
      },
      resources: [
        {
          type: 'team',
          id: teamId,
          action: ResourceAction.UPDATED,
        },
      ],
    });

    return { success: true };
  }

  @Delete(':id')
  @Roles(OrgRole.admin, OrgRole.owner)
  @SwaggerDeleteTeam()
  async deleteTeam(
    @Param('id') teamId: string,
    @CurrentOrg() orgId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean }> {
    await this.teamManagementService.deleteTeam(teamId, orgId);

    await this.auditLogService.log({
      action: 'team.deleted',
      orgId,
      actorType: AuditActorType.USER,
      actorUserId: user.userId,
      category: AuditCategory.DATA_MODIFICATION,
      severity: AuditSeverity.HIGH,
      requestData: {
        method: 'DELETE',
        path: `/teams/${teamId}`,
        ipAddress: '127.0.0.1',
      },
      resources: [
        {
          type: 'team',
          id: teamId,
          action: ResourceAction.DELETED,
        },
      ],
    });

    return { success: true };
  }

  @Get(':id/members')
  @Roles(OrgRole.admin, OrgRole.owner, OrgRole.member)
  @SwaggerGetTeamMembers()
  async getTeamMembers(@Param('id') teamId: string) {
    return this.teamManagementService.getTeamMembers(teamId);
  }

  @Post(':id/members')
  @Roles(OrgRole.admin, OrgRole.owner)
  @SwaggerAddTeamMember()
  async addTeamMember(
    @Param('id') teamId: string,
    @Body(ValidationPipe) addMemberDto: AddTeamMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean }> {
    await this.teamManagementService.addTeamMember(teamId, addMemberDto.teamMemberId, user.userId);

    await this.auditLogService.log({
      action: 'team.member_added',
      orgId: user.orgId,
      actorType: AuditActorType.USER,
      actorUserId: user.userId,
      category: AuditCategory.DATA_MODIFICATION,
      severity: AuditSeverity.MEDIUM,
      requestData: {
        method: 'POST',
        path: `/teams/${teamId}/members`,
        ipAddress: '127.0.0.1',
        body: addMemberDto,
      },
      resources: [
        {
          type: 'team',
          id: teamId,
          action: ResourceAction.UPDATED,
        },
        {
          type: 'team_member',
          id: addMemberDto.teamMemberId,
          action: ResourceAction.CREATED,
        },
      ],
    });

    return { success: true };
  }

  @Delete(':id/members/:memberId')
  @Roles(OrgRole.admin, OrgRole.owner)
  @SwaggerRemoveTeamMember()
  async removeTeamMember(
    @Param('id') teamId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean }> {
    await this.teamManagementService.removeTeamMember(teamId, memberId);

    await this.auditLogService.log({
      action: 'team.member_removed',
      orgId: user.orgId,
      actorType: AuditActorType.USER,
      actorUserId: user.userId,
      category: AuditCategory.DATA_MODIFICATION,
      severity: AuditSeverity.MEDIUM,
      requestData: {
        method: 'DELETE',
        path: `/teams/${teamId}/members/${memberId}`,
        ipAddress: '127.0.0.1',
      },
      resources: [
        {
          type: 'team',
          id: teamId,
          action: ResourceAction.UPDATED,
        },
        {
          type: 'team_member',
          id: memberId,
          action: ResourceAction.DELETED,
        },
      ],
    });

    return { success: true };
  }

  @Get('slack/channels')
  @Roles(OrgRole.admin, OrgRole.owner)
  @SwaggerGetAvailableChannels()
  async getAvailableChannels(@CurrentOrg() orgId: string): Promise<AvailableChannelsResponse> {
    return this.teamManagementService.getAvailableChannels(orgId);
  }

  @Get('slack/members')
  @Roles(OrgRole.admin, OrgRole.owner)
  @SwaggerGetAvailableMembers()
  async getAvailableMembers(@CurrentOrg() orgId: string): Promise<AvailableMembersResponse> {
    return this.teamManagementService.getAvailableMembers(orgId);
  }

  @Post(':id/validate-channel')
  @Roles(OrgRole.admin, OrgRole.owner)
  @SwaggerValidateChannelAccess()
  async validateChannelAccess(
    @Body(ValidationPipe) validateChannelDto: ValidateChannelDto,
  ): Promise<ChannelValidationResponse> {
    // For now, we'll implement a simple validation
    // In a real implementation, we'd get the team's integration ID
    return {
      valid: true,
      channelName: validateChannelDto.channelId,
    };
  }
}
