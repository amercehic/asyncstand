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
import { RolesGuard } from '@/auth/guards/roles.guard';
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
@Controller()
export class StandupConfigController {
  constructor(private readonly standupConfigService: StandupConfigService) {}

  // Configuration CRUD endpoints

  @Post('teams/:teamId/standup-config')
  @SwaggerCreateStandupConfig()
  async createStandupConfig(
    @Param('teamId') teamId: string,
    @CurrentOrg('id') orgId: string,
    @CurrentUser('id') userId: string,
    @Body(ValidationPipe) data: CreateStandupConfigDto,
  ): Promise<{ id: string }> {
    return this.standupConfigService.createStandupConfig(teamId, orgId, userId, data);
  }

  @Get('teams/:teamId/standup-config')
  @SwaggerGetStandupConfig()
  async getStandupConfig(
    @Param('teamId') teamId: string,
    @CurrentOrg('id') orgId: string,
  ): Promise<StandupConfigResponse> {
    return this.standupConfigService.getStandupConfig(teamId, orgId);
  }

  @Put('teams/:teamId/standup-config')
  @SwaggerUpdateStandupConfig()
  async updateStandupConfig(
    @Param('teamId') teamId: string,
    @CurrentOrg('id') orgId: string,
    @Body(ValidationPipe) data: UpdateStandupConfigDto,
  ): Promise<{ message: string }> {
    await this.standupConfigService.updateStandupConfig(teamId, orgId, data);
    return { message: 'Standup configuration updated successfully' };
  }

  @Delete('teams/:teamId/standup-config')
  @SwaggerDeleteStandupConfig()
  async deleteStandupConfig(
    @Param('teamId') teamId: string,
    @CurrentOrg('id') orgId: string,
  ): Promise<{ message: string }> {
    await this.standupConfigService.deleteStandupConfig(teamId, orgId);
    return { message: 'Standup configuration deleted successfully' };
  }

  @Get('teams/:teamId/standup-config/preview')
  @SwaggerGetStandupPreview()
  async getStandupPreview(
    @Param('teamId') teamId: string,
    @CurrentOrg('id') orgId: string,
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
  async updateMemberParticipation(
    @Param('teamId') teamId: string,
    @Param('memberId') memberId: string,
    @Body(ValidationPipe) data: UpdateMemberParticipationDto,
  ): Promise<{ message: string }> {
    await this.standupConfigService.updateMemberParticipation(teamId, memberId, data);
    return { message: 'Member participation updated successfully' };
  }

  @Post('teams/:teamId/standup-config/members/bulk')
  @SwaggerBulkUpdateParticipation()
  async bulkUpdateParticipation(
    @Param('teamId') teamId: string,
    @Body(ValidationPipe) data: BulkUpdateParticipationDto,
  ): Promise<{ message: string }> {
    await this.standupConfigService.bulkUpdateParticipation(teamId, data);
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
    @CurrentOrg('id') orgId: string,
  ): Promise<{ teamId: string; teamName: string; isActive: boolean }[]> {
    return this.standupConfigService.listTeamsWithStandups(orgId);
  }
}
