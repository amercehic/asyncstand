import {
  Controller,
  Get,
  Post,
  Put,
  Query,
  Param,
  Body,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/guards/roles.guard';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { CurrentOrg } from '@/auth/decorators/current-org.decorator';
import { StandupInstanceService } from '@/standups/standup-instance.service';
import { AnswerCollectionService } from '@/standups/answer-collection.service';
import { StandupInstanceDto } from '@/standups/dto/standup-instance.dto';
import { ParticipationStatusDto } from '@/standups/dto/participation-status.dto';
import { UpdateInstanceStateDto } from '@/standups/dto/update-instance-state.dto';
import { SubmitAnswersDto } from '@/standups/dto/submit-answers.dto';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';

@ApiTags('Standup Instances')
@Controller('standups/instances')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StandupInstanceController {
  constructor(
    private readonly standupInstanceService: StandupInstanceService,
    private readonly answerCollectionService: AnswerCollectionService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List active standup instances' })
  @ApiResponse({
    status: 200,
    description: 'List of active standup instances',
    type: [StandupInstanceDto],
  })
  async getActiveInstances(
    @CurrentOrg() orgId: string,
    @Query('teamId') teamId?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<StandupInstanceDto[]> {
    const limitValue = Math.min(limit || 50, 100); // Max 100 items
    const offsetValue = Math.max(offset || 0, 0);

    return this.standupInstanceService.getActiveInstances(orgId, teamId, limitValue, offsetValue);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get standup instance details' })
  @ApiResponse({
    status: 200,
    description: 'Standup instance details with answers',
  })
  @ApiResponse({
    status: 404,
    description: 'Standup instance not found',
  })
  async getInstanceDetails(
    @Param('id') instanceId: string,
    @CurrentOrg() orgId: string,
  ): Promise<StandupInstanceDto & { answers: unknown[] }> {
    return this.standupInstanceService.getInstanceWithDetails(instanceId, orgId);
  }

  @Put(':id/state')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Update standup instance state (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Instance state updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid state transition',
  })
  @ApiResponse({
    status: 403,
    description: 'Admin role required',
  })
  @ApiResponse({
    status: 404,
    description: 'Standup instance not found',
  })
  async updateInstanceState(
    @Param('id') instanceId: string,
    @Body() updateStateDto: UpdateInstanceStateDto,
    @CurrentUser() userId: string,
    @CurrentOrg() orgId: string,
  ): Promise<{ success: boolean }> {
    await this.standupInstanceService.updateInstanceState(
      instanceId,
      updateStateDto.state,
      userId,
      orgId,
    );

    return { success: true };
  }

  @Post(':id/answers')
  @ApiOperation({ summary: 'Submit answers for a standup instance' })
  @ApiResponse({
    status: 201,
    description: 'Answers submitted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid submission or collection window closed',
  })
  @ApiResponse({
    status: 403,
    description: 'Member not participating in this standup',
  })
  @ApiResponse({
    status: 404,
    description: 'Standup instance not found',
  })
  async submitAnswers(
    @Param('id') instanceId: string,
    @Body() submitAnswersDto: SubmitAnswersDto,
    @CurrentUser() userId: string,
    @CurrentOrg() orgId: string,
  ): Promise<{ success: boolean; answersSubmitted: number }> {
    // Validate that the instanceId matches the DTO
    if (submitAnswersDto.standupInstanceId && submitAnswersDto.standupInstanceId !== instanceId) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        'Instance ID mismatch',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Set the instanceId from the URL parameter
    submitAnswersDto.standupInstanceId = instanceId;

    // TODO: Map userId to teamMemberId - for now assume they're the same
    // In a real implementation, you'd need to look up the teamMember record
    const teamMemberId = userId; // This is a simplification

    return this.answerCollectionService.submitFullResponse(submitAnswersDto, teamMemberId, orgId);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get participation status for a standup instance' })
  @ApiResponse({
    status: 200,
    description: 'Participation status and response metrics',
    type: ParticipationStatusDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Standup instance not found',
  })
  async getParticipationStatus(
    @Param('id') instanceId: string,
    @CurrentOrg() orgId: string,
  ): Promise<ParticipationStatusDto> {
    return this.standupInstanceService.getInstanceParticipation(instanceId, orgId);
  }

  @Get(':id/participating-members')
  @ApiOperation({ summary: 'Get list of participating members for an instance' })
  @ApiResponse({
    status: 200,
    description: 'List of participating members',
  })
  @ApiResponse({
    status: 404,
    description: 'Standup instance not found',
  })
  async getParticipatingMembers(
    @Param('id') instanceId: string,
  ): Promise<Array<{ id: string; name: string; platformUserId: string }>> {
    return this.standupInstanceService.getParticipatingMembers(instanceId);
  }

  @Get(':id/completion-check')
  @ApiOperation({ summary: 'Check if standup instance is complete' })
  @ApiResponse({
    status: 200,
    description: 'Completion status',
  })
  async checkCompletion(
    @Param('id') instanceId: string,
  ): Promise<{ isComplete: boolean; responseRate: number }> {
    const isComplete = await this.standupInstanceService.isInstanceComplete(instanceId);
    const responseRate = await this.standupInstanceService.calculateResponseRate(instanceId);

    return { isComplete, responseRate };
  }

  @Post('create-for-date')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Manually create standup instances for a specific date (admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Standup instances created',
  })
  @ApiResponse({
    status: 403,
    description: 'Admin role required',
  })
  async createInstancesForDate(
    @Body() body: { targetDate: string },
  ): Promise<{ created: string[]; skipped: string[] }> {
    const targetDate = new Date(body.targetDate);

    if (isNaN(targetDate.getTime())) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        'Invalid date format',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.standupInstanceService.createInstancesForDate(targetDate);
  }

  @Get('team/:teamId/next-standup')
  @ApiOperation({ summary: 'Get next scheduled standup date for a team' })
  @ApiResponse({
    status: 200,
    description: 'Next standup date',
  })
  @ApiResponse({
    status: 404,
    description: 'Team not found or no active configuration',
  })
  async getNextStandupDate(
    @Param('teamId') teamId: string,
  ): Promise<{ nextStandupDate: string | null }> {
    const nextDate = await this.standupInstanceService.calculateNextStandupDate(teamId);

    return {
      nextStandupDate: nextDate ? nextDate.toISOString().split('T')[0] : null,
    };
  }

  @Get('team/:teamId/should-create-today')
  @ApiOperation({ summary: 'Check if a team should have a standup today' })
  @ApiResponse({
    status: 200,
    description: 'Whether team should have standup today',
  })
  async shouldCreateToday(
    @Param('teamId') teamId: string,
    @Query('date') dateStr?: string,
  ): Promise<{ shouldCreate: boolean; date: string }> {
    const date = dateStr ? new Date(dateStr) : new Date();

    if (isNaN(date.getTime())) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        'Invalid date format',
        HttpStatus.BAD_REQUEST,
      );
    }

    const shouldCreate = await this.standupInstanceService.shouldCreateStandupToday(teamId, date);

    return {
      shouldCreate,
      date: date.toISOString().split('T')[0],
    };
  }
}
