import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
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

@ApiTags('Standup Configuration')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class StandupConfigController {
  constructor(private readonly standupConfigService: StandupConfigService) {}

  // Configuration CRUD endpoints

  @Post('teams/:teamId/standup-config')
  @ApiOperation({ summary: 'Create standup configuration for a team' })
  @ApiParam({ name: 'teamId', description: 'Team ID' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Standup configuration created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Configuration ID' },
      },
    },
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Team not found' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Configuration already exists' })
  async createStandupConfig(
    @Param('teamId') teamId: string,
    @CurrentOrg('id') orgId: string,
    @CurrentUser('id') userId: string,
    @Body(ValidationPipe) data: CreateStandupConfigDto,
  ): Promise<{ id: string }> {
    return this.standupConfigService.createStandupConfig(teamId, orgId, userId, data);
  }

  @Get('teams/:teamId/standup-config')
  @ApiOperation({ summary: 'Get standup configuration for a team' })
  @ApiParam({ name: 'teamId', description: 'Team ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Standup configuration retrieved successfully',
    type: 'object', // Would be StandupConfigResponse in a real implementation
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Configuration not found' })
  async getStandupConfig(
    @Param('teamId') teamId: string,
    @CurrentOrg('id') orgId: string,
  ): Promise<StandupConfigResponse> {
    return this.standupConfigService.getStandupConfig(teamId, orgId);
  }

  @Put('teams/:teamId/standup-config')
  @ApiOperation({ summary: 'Update standup configuration for a team' })
  @ApiParam({ name: 'teamId', description: 'Team ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Standup configuration updated successfully',
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Configuration not found' })
  async updateStandupConfig(
    @Param('teamId') teamId: string,
    @CurrentOrg('id') orgId: string,
    @Body(ValidationPipe) data: UpdateStandupConfigDto,
  ): Promise<{ message: string }> {
    await this.standupConfigService.updateStandupConfig(teamId, orgId, data);
    return { message: 'Standup configuration updated successfully' };
  }

  @Delete('teams/:teamId/standup-config')
  @ApiOperation({ summary: 'Delete standup configuration for a team' })
  @ApiParam({ name: 'teamId', description: 'Team ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Standup configuration deleted successfully',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Configuration not found' })
  async deleteStandupConfig(
    @Param('teamId') teamId: string,
    @CurrentOrg('id') orgId: string,
  ): Promise<{ message: string }> {
    await this.standupConfigService.deleteStandupConfig(teamId, orgId);
    return { message: 'Standup configuration deleted successfully' };
  }

  @Get('teams/:teamId/standup-config/preview')
  @ApiOperation({ summary: 'Preview how standup will work with current configuration' })
  @ApiParam({ name: 'teamId', description: 'Team ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Standup preview generated successfully',
    type: 'object', // Would be PreviewResponse in a real implementation
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Configuration not found' })
  async getStandupPreview(
    @Param('teamId') teamId: string,
    @CurrentOrg('id') orgId: string,
  ): Promise<PreviewResponse> {
    return this.standupConfigService.getPreview(teamId, orgId);
  }

  // Member participation endpoints

  @Get('teams/:teamId/standup-config/members')
  @ApiOperation({ summary: 'Get member participation settings for a team' })
  @ApiParam({ name: 'teamId', description: 'Team ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Member participation retrieved successfully',
    type: 'array',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Configuration not found' })
  async getMemberParticipation(
    @Param('teamId') teamId: string,
  ): Promise<MemberParticipationResponse[]> {
    return this.standupConfigService.getMemberParticipation(teamId);
  }

  @Put('teams/:teamId/standup-config/members/:memberId')
  @ApiOperation({ summary: 'Update member participation in standups' })
  @ApiParam({ name: 'teamId', description: 'Team ID' })
  @ApiParam({ name: 'memberId', description: 'Team Member ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Member participation updated successfully',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Team member not found' })
  async updateMemberParticipation(
    @Param('teamId') teamId: string,
    @Param('memberId') memberId: string,
    @Body(ValidationPipe) data: UpdateMemberParticipationDto,
  ): Promise<{ message: string }> {
    await this.standupConfigService.updateMemberParticipation(teamId, memberId, data);
    return { message: 'Member participation updated successfully' };
  }

  @Post('teams/:teamId/standup-config/members/bulk')
  @ApiOperation({ summary: 'Bulk update member participation in standups' })
  @ApiParam({ name: 'teamId', description: 'Team ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Member participation updated successfully',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'One or more team members not found' })
  async bulkUpdateParticipation(
    @Param('teamId') teamId: string,
    @Body(ValidationPipe) data: BulkUpdateParticipationDto,
  ): Promise<{ message: string }> {
    await this.standupConfigService.bulkUpdateParticipation(teamId, data);
    return { message: 'Member participation updated successfully' };
  }

  // Utility endpoints

  @Get('standup-config/timezones')
  @ApiOperation({ summary: 'Get list of valid timezones' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Valid timezones retrieved successfully',
    schema: {
      type: 'array',
      items: { type: 'string' },
    },
  })
  async getValidTimezones(): Promise<string[]> {
    return this.standupConfigService.getValidTimezones();
  }

  @Get('standup-config/templates')
  @ApiOperation({ summary: 'Get default question templates' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Question templates retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          questions: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  })
  async getQuestionTemplates(): Promise<QuestionTemplate[]> {
    return this.standupConfigService.getQuestionTemplates();
  }

  // Organization-level endpoint

  @Get('standup-config/teams')
  @ApiOperation({ summary: 'List teams with standup configurations' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Teams with standups retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          teamId: { type: 'string' },
          teamName: { type: 'string' },
          isActive: { type: 'boolean' },
        },
      },
    },
  })
  async listTeamsWithStandups(
    @CurrentOrg('id') orgId: string,
  ): Promise<{ teamId: string; teamName: string; isActive: boolean }[]> {
    return this.standupConfigService.listTeamsWithStandups(orgId);
  }
}
