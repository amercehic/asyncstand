import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '@/auth/guards/roles.guard';
import { RequestSizeGuard, RequestSizeLimit } from '@/common/guards/request-size.guard';
import { QueryTimeoutInterceptor } from '@/common/interceptors/query-timeout.interceptor';
import { QueryTimeout } from '@/common/decorators/query-timeout.decorator';
import { CurrentOrg } from '@/auth/decorators/current-org.decorator';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { TeamManagementService } from '@/teams/team-management.service';
import { CreateTeamDto } from '@/teams/dto/create-team.dto';
import { UpdateTeamDto } from '@/teams/dto/update-team.dto';
import { AddTeamMemberDto } from '@/teams/dto/add-team-member.dto';
import {
  TeamListResponse,
  TeamDetailsResponse,
  AvailableChannelsResponse,
  AvailableMembersResponse,
} from '@/teams/types/team-management.types';
import { OrgRole } from '@prisma/client';
import { Audit } from '@/common/audit/audit.decorator';
import { AuditCategory, AuditSeverity } from '@/common/audit/types';
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
  SwaggerGetChannelsList,
} from '@/swagger/teams.swagger';

interface AuthenticatedUser {
  userId: string;
  orgId: string;
  role: string;
}

@ApiTags('Team Management')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, RequestSizeGuard)
@UseInterceptors(QueryTimeoutInterceptor)
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamManagementService: TeamManagementService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(OrgRole.admin, OrgRole.owner)
  @QueryTimeout(10000) // 10 seconds for team creation
  @RequestSizeLimit(1024 * 100) // 100KB limit for team data
  @SwaggerCreateTeam()
  @Audit({
    action: 'team.created',
    resourcesFromResult: (result) => [{ type: 'team', id: result?.id, action: 'CREATED' }],
    category: AuditCategory.DATA_MODIFICATION,
    severity: AuditSeverity.MEDIUM,
  })
  async createTeam(
    @Body(ValidationPipe) createTeamDto: CreateTeamDto,
    @CurrentOrg() orgId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ id: string }> {
    return this.teamManagementService.createTeam(orgId, user.userId, createTeamDto);
  }

  @Get()
  @Roles(OrgRole.admin, OrgRole.owner, OrgRole.member)
  @QueryTimeout(15000) // 15 seconds for team listing with pagination
  @SwaggerListTeams()
  async listTeams(
    @CurrentOrg() orgId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<TeamListResponse & { pagination: { page: number; limit: number; total: number } }> {
    return this.teamManagementService.listTeams(orgId, page, limit);
  }

  @Get(':id')
  @Roles(OrgRole.admin, OrgRole.owner, OrgRole.member)
  @SwaggerGetTeamDetails()
  async getTeamDetails(
    @Param('id', ParseUUIDPipe) teamId: string,
    @CurrentOrg() orgId: string,
  ): Promise<TeamDetailsResponse> {
    return this.teamManagementService.getTeamDetails(teamId, orgId);
  }

  @Put(':id')
  @Roles(OrgRole.admin, OrgRole.owner)
  @SwaggerUpdateTeam()
  @Audit({
    action: 'team.updated',
    resourcesFromRequest: (req) => [{ type: 'team', id: req.params.id, action: 'UPDATED' }],
    category: AuditCategory.DATA_MODIFICATION,
    severity: AuditSeverity.MEDIUM,
  })
  async updateTeam(
    @Param('id', ParseUUIDPipe) teamId: string,
    @Body(ValidationPipe) updateTeamDto: UpdateTeamDto,
    @CurrentOrg() orgId: string,
  ): Promise<{ success: boolean }> {
    await this.teamManagementService.updateTeam(teamId, orgId, updateTeamDto);
    return { success: true };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(OrgRole.admin, OrgRole.owner)
  @SwaggerDeleteTeam()
  @Audit({
    action: 'team.deleted',
    resourcesFromRequest: (req) => [{ type: 'team', id: req.params.id, action: 'DELETED' }],
    category: AuditCategory.DATA_MODIFICATION,
    severity: AuditSeverity.HIGH,
  })
  async deleteTeam(
    @Param('id', ParseUUIDPipe) teamId: string,
    @CurrentOrg() orgId: string,
  ): Promise<{ success: boolean }> {
    await this.teamManagementService.deleteTeam(teamId, orgId);
    return { success: true };
  }

  @Get('slack/channels')
  @Roles(OrgRole.admin, OrgRole.owner)
  @QueryTimeout(20000) // 20 seconds for Slack API calls
  @SwaggerGetAvailableChannels()
  async getAvailableChannels(
    @CurrentOrg() orgId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<
    AvailableChannelsResponse & { pagination: { page: number; limit: number; total: number } }
  > {
    return this.teamManagementService.getAvailableChannels(orgId, page, limit);
  }

  @Get('slack/members')
  @Roles(OrgRole.admin, OrgRole.owner)
  @QueryTimeout(30000) // 30 seconds for member fetching (can be very slow)
  @SwaggerGetAvailableMembers()
  async getAvailableMembers(
    @CurrentOrg() orgId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<
    AvailableMembersResponse & { pagination: { page: number; limit: number; total: number } }
  > {
    return this.teamManagementService.getAvailableMembers(orgId, page, limit);
  }

  @Get(':id/members')
  @Roles(OrgRole.admin, OrgRole.owner, OrgRole.member)
  @SwaggerGetTeamMembers()
  async getTeamMembers(@Param('id', ParseUUIDPipe) teamId: string) {
    return this.teamManagementService.getTeamMembers(teamId);
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  @Roles(OrgRole.admin, OrgRole.owner)
  @SwaggerAddTeamMember()
  @Audit({
    action: 'team.member_added',
    resourcesFromRequest: (req) => [
      { type: 'team', id: req.params.id, action: 'UPDATED' },
      { type: 'team_member', id: req.body?.slackUserId, action: 'CREATED' },
    ],
    category: AuditCategory.DATA_MODIFICATION,
    severity: AuditSeverity.MEDIUM,
  })
  async addTeamMember(
    @Param('id', ParseUUIDPipe) teamId: string,
    @Body(ValidationPipe) addMemberDto: AddTeamMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean }> {
    await this.teamManagementService.addTeamMember(teamId, addMemberDto.slackUserId, user.userId);
    return { success: true };
  }

  @Delete(':id/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(OrgRole.admin, OrgRole.owner)
  @SwaggerRemoveTeamMember()
  @Audit({
    action: 'team.member_removed',
    resourcesFromRequest: (req) => [
      { type: 'team', id: req.params.id, action: 'UPDATED' },
      { type: 'team_member', id: req.params.memberId, action: 'DELETED' },
    ],
    category: AuditCategory.DATA_MODIFICATION,
    severity: AuditSeverity.MEDIUM,
  })
  async removeTeamMember(
    @Param('id', ParseUUIDPipe) teamId: string,
    @Param('memberId') memberId: string,
  ): Promise<{ success: boolean }> {
    await this.teamManagementService.removeTeamMember(teamId, memberId);
    return { success: true };
  }

  @Get('channels')
  @Roles(OrgRole.admin, OrgRole.owner, OrgRole.member)
  @SwaggerGetChannelsList()
  async getChannelsList(@CurrentOrg() orgId: string) {
    return this.teamManagementService.getChannelsList(orgId);
  }

  @Post(':id/sync-members')
  @Roles(OrgRole.admin, OrgRole.owner)
  @Audit({
    action: 'team.members_synced',
    resourcesFromRequest: (req) => [{ type: 'team', id: req.params.id, action: 'UPDATED' }],
    category: AuditCategory.DATA_MODIFICATION,
    severity: AuditSeverity.LOW,
  })
  async syncTeamMembers(
    @Param('id', ParseUUIDPipe) teamId: string,
    @CurrentOrg() orgId: string,
  ): Promise<{ success: boolean; syncedCount: number }> {
    return this.teamManagementService.syncTeamMembers(teamId, orgId);
  }

  @Put(':id/members/:memberId/activate')
  @Roles(OrgRole.admin, OrgRole.owner)
  @Audit({
    action: 'team.member_activated',
    resourcesFromRequest: (req) => [
      { type: 'team_member', id: req.params.memberId, action: 'UPDATED' },
    ],
    category: AuditCategory.DATA_MODIFICATION,
    severity: AuditSeverity.LOW,
  })
  async activateTeamMember(
    @Param('id', ParseUUIDPipe) teamId: string,
    @Param('memberId') memberId: string,
    @CurrentOrg() orgId: string,
  ): Promise<{ success: boolean }> {
    await this.teamManagementService.updateMemberStatus(teamId, memberId, orgId, true);
    return { success: true };
  }

  @Put(':id/members/:memberId/deactivate')
  @Roles(OrgRole.admin, OrgRole.owner)
  @Audit({
    action: 'team.member_deactivated',
    resourcesFromRequest: (req) => [
      { type: 'team_member', id: req.params.memberId, action: 'UPDATED' },
    ],
    category: AuditCategory.DATA_MODIFICATION,
    severity: AuditSeverity.LOW,
  })
  async deactivateTeamMember(
    @Param('id', ParseUUIDPipe) teamId: string,
    @Param('memberId') memberId: string,
    @CurrentOrg() orgId: string,
  ): Promise<{ success: boolean }> {
    await this.teamManagementService.updateMemberStatus(teamId, memberId, orgId, false);
    return { success: true };
  }

  @Get(':id/available-channels')
  @Roles(OrgRole.admin, OrgRole.owner, OrgRole.member)
  async getTeamAvailableChannels(
    @Param('id', ParseUUIDPipe) teamId: string,
    @CurrentOrg() orgId: string,
  ) {
    return this.teamManagementService.getTeamAvailableChannels(teamId, orgId);
  }

  @Get(':id/standups')
  @Roles(OrgRole.admin, OrgRole.owner, OrgRole.member)
  async getTeamStandups(@Param('id', ParseUUIDPipe) teamId: string, @CurrentOrg() orgId: string) {
    return this.teamManagementService.getTeamStandups(teamId, orgId);
  }
}
