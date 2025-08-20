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
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '@/auth/guards/roles.guard';
import { OrgRole } from '@prisma/client';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { CurrentOrg } from '@/auth/decorators/current-org.decorator';
import { StandupConfigService } from '@/standups/standup-config.service';
import { CreateStandupConfigDto } from '@/standups/dto/create-standup-config.dto';
import { UpdateStandupConfigDto } from '@/standups/dto/update-standup-config.dto';
import { UpdateMemberParticipationDto } from '@/standups/dto/update-member-participation.dto';
import { BulkUpdateParticipationDto } from '@/standups/dto/bulk-update-participation.dto';
import {
  StandupConfigResponse,
  MemberParticipationResponse,
  PreviewResponse,
  QuestionTemplate,
} from '@/standups/types/standup-config.types';
import { Audit } from '@/common/audit/audit.decorator';
import { AuditCategory, AuditSeverity } from '@/common/audit/types';
import {
  SwaggerCreateStandupConfig,
  SwaggerGetStandupConfig,
  SwaggerUpdateStandupConfig,
  SwaggerDeleteStandupConfig,
  SwaggerGetStandupPreview,
  SwaggerGetMemberParticipation,
  SwaggerUpdateMemberParticipation,
  SwaggerBulkUpdateParticipation,
  SwaggerGetValidTimezones,
  SwaggerGetQuestionTemplates,
  SwaggerListTeamsWithStandups,
} from '@/swagger/standup-config.swagger';

@ApiTags('Standup Configuration')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('standups/config')
export class StandupConfigController {
  constructor(private readonly standupConfigService: StandupConfigService) {}

  // Configuration CRUD endpoints

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @SwaggerCreateStandupConfig()
  @UseGuards(RolesGuard)
  @Roles(OrgRole.owner, OrgRole.admin)
  @Audit({
    action: 'standup_config.created',
    category: AuditCategory.STANDUP_CONFIG,
    severity: AuditSeverity.MEDIUM,
    resourcesFromResult: (result) => [
      { type: 'standup_config', id: result?.id, action: 'CREATED' },
    ],
  })
  async createStandupConfigFromBody(
    @CurrentOrg() orgId: string,
    @CurrentUser('userId') userId: string,
    @Body(ValidationPipe) data: CreateStandupConfigDto & { teamId: string },
  ): Promise<StandupConfigResponse> {
    if (!data.teamId) {
      throw new Error('teamId is required');
    }
    await this.standupConfigService.createStandupConfig(data.teamId, orgId, userId, data);

    // Return the created config with full details for the test
    const config = await this.standupConfigService.getStandupConfig(data.teamId, orgId);
    return config;
  }

  // Get specific config by ID
  @Get(':configId')
  @SwaggerGetStandupConfig()
  async getStandupConfigById(
    @Param('configId') configId: string,
    @CurrentOrg() orgId: string,
  ): Promise<StandupConfigResponse> {
    return this.standupConfigService.getStandupConfigById(configId, orgId);
  }

  // Get all standup configurations for a team
  @Get('teams/:teamId/standups')
  @SwaggerGetStandupConfig()
  async getTeamStandupConfigs(
    @Param('teamId') teamId: string,
    @CurrentOrg() orgId: string,
  ): Promise<StandupConfigResponse[]> {
    return this.standupConfigService.getTeamStandupConfigs(teamId, orgId);
  }

  @Post(':id/members/bulk')
  @SwaggerBulkUpdateParticipation()
  @UseGuards(RolesGuard)
  @Roles(OrgRole.owner, OrgRole.admin)
  @Audit({
    action: 'standup_config.participation_bulk_updated',
    category: AuditCategory.STANDUP_CONFIG,
    severity: AuditSeverity.LOW,
    resourcesFromRequest: (req) => [
      { type: 'standup_config', id: req.params.id, action: 'UPDATED' },
    ],
  })
  async bulkUpdateParticipationById(
    @Param('id', ParseUUIDPipe) configId: string,
    @CurrentOrg() orgId: string,
    @Body(ValidationPipe) data: BulkUpdateParticipationDto,
  ): Promise<{ success: boolean; updated: number }> {
    await this.standupConfigService.bulkUpdateParticipationById(configId, orgId, data);
    return { success: true, updated: data.members?.length || 0 };
  }

  @Put(':id')
  @SwaggerUpdateStandupConfig()
  @UseGuards(RolesGuard)
  @Roles(OrgRole.owner, OrgRole.admin)
  @Audit({
    action: 'standup_config.updated',
    category: AuditCategory.STANDUP_CONFIG,
    severity: AuditSeverity.MEDIUM,
    resourcesFromRequest: (req) => [
      { type: 'standup_config', id: req.params.id, action: 'UPDATED' },
    ],
  })
  async updateStandupConfigById(
    @Param('id', ParseUUIDPipe) configId: string,
    @CurrentOrg() orgId: string,
    @Body(ValidationPipe) data: UpdateStandupConfigDto,
  ): Promise<{ success: boolean }> {
    await this.standupConfigService.updateStandupConfigById(configId, orgId, data);
    return { success: true };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @SwaggerDeleteStandupConfig()
  @UseGuards(RolesGuard)
  @Roles(OrgRole.owner, OrgRole.admin)
  @Audit({
    action: 'standup_config.deleted',
    category: AuditCategory.STANDUP_CONFIG,
    severity: AuditSeverity.HIGH,
    resourcesFromRequest: (req) => [
      { type: 'standup_config', id: req.params.id, action: 'DELETED' },
    ],
  })
  async deleteStandupConfigById(
    @Param('id', ParseUUIDPipe) configId: string,
    @CurrentOrg() orgId: string,
  ): Promise<{ success: boolean }> {
    await this.standupConfigService.deleteStandupConfigById(configId, orgId);
    return { success: true };
  }

  @Get('teams/:teamId/standup-config/preview')
  @SwaggerGetStandupPreview()
  async getStandupPreview(
    @Param('teamId') teamId: string,
    @CurrentOrg() orgId: string,
  ): Promise<PreviewResponse> {
    return this.standupConfigService.getPreview(teamId, orgId);
  }

  // Member participation endpoints

  @Get('teams/:teamId/standup-config/members')
  @SwaggerGetMemberParticipation()
  async getMemberParticipation(
    @Param('teamId') teamId: string,
  ): Promise<MemberParticipationResponse[]> {
    return this.standupConfigService.getMemberParticipation(teamId);
  }

  @Put('teams/:teamId/standup-config/members/:memberId')
  @SwaggerUpdateMemberParticipation()
  @Audit({
    action: 'standup_config.member_participation_updated',
    category: AuditCategory.STANDUP_CONFIG,
    severity: AuditSeverity.LOW,
    resourcesFromRequest: (req) => [
      { type: 'team_member', id: req.params.memberId, action: 'UPDATED' },
    ],
  })
  async updateMemberParticipation(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('memberId') memberId: string,
    @Body(ValidationPipe) data: UpdateMemberParticipationDto,
  ): Promise<{ message: string }> {
    await this.standupConfigService.updateMemberParticipation(teamId, memberId, data);
    return { message: 'Member participation updated successfully' };
  }

  // Utility endpoints

  @Get('standup-config/timezones')
  @SwaggerGetValidTimezones()
  async getValidTimezones(): Promise<string[]> {
    return this.standupConfigService.getValidTimezones();
  }

  @Get('standup-config/templates')
  @SwaggerGetQuestionTemplates()
  async getQuestionTemplates(): Promise<QuestionTemplate[]> {
    return this.standupConfigService.getQuestionTemplates();
  }

  // Organization-level endpoint

  @Get('standup-config/teams')
  @SwaggerListTeamsWithStandups()
  async listTeamsWithStandups(
    @CurrentOrg() orgId: string,
  ): Promise<{ teamId: string; teamName: string; isActive: boolean }[]> {
    return this.standupConfigService.listTeamsWithStandups(orgId);
  }
}
