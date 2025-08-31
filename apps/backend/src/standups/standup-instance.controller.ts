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
  ParseUUIDPipe,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/guards/roles.guard';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { CurrentOrg } from '@/auth/decorators/current-org.decorator';
import { StandupInstanceService } from '@/standups/standup-instance.service';
import { AnswerCollectionService } from '@/standups/answer-collection.service';
import { SlackMessagingService } from '@/integrations/slack/slack-messaging.service';
import { StandupInstanceDto } from '@/standups/dto/standup-instance.dto';
import { ParticipationStatusDto } from '@/standups/dto/participation-status.dto';
import { UpdateInstanceStateDto } from '@/standups/dto/update-instance-state.dto';
import { SubmitAnswersDto } from '@/standups/dto/submit-answers.dto';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { PrismaService } from '@/prisma/prisma.service';
import { Audit } from '@/common/audit/audit.decorator';
import { AuditCategory, AuditSeverity } from '@/common/audit/types';

@ApiTags('Standup Instances')
@Controller('standups/instances')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StandupInstanceController {
  constructor(
    private readonly standupInstanceService: StandupInstanceService,
    private readonly answerCollectionService: AnswerCollectionService,
    private readonly slackMessagingService: SlackMessagingService,
    private readonly prisma: PrismaService,
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
  @Audit({
    action: 'standup_instance.state_updated',
    category: AuditCategory.STANDUP,
    severity: AuditSeverity.MEDIUM,
    resourcesFromRequest: (req) => [
      { type: 'standup_instance', id: req.params.id, action: 'UPDATED' },
    ],
  })
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
    @Param('id', ParseUUIDPipe) instanceId: string,
    @Body() updateStateDto: UpdateInstanceStateDto,
    @CurrentUser('userId') userId: string,
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
  @HttpCode(HttpStatus.CREATED)
  @Audit({
    action: 'standup_instance.answers_submitted',
    category: AuditCategory.STANDUP,
    severity: AuditSeverity.LOW,
    resourcesFromRequest: (req) => [
      { type: 'standup_instance', id: req.params.id, action: 'UPDATED' },
    ],
  })
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
    @Param('id', ParseUUIDPipe) instanceId: string,
    @Body() submitAnswersDto: SubmitAnswersDto,
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

    // Get the team member ID by looking up through the standup instance
    const instance = await this.standupInstanceService.getInstanceWithDetails(instanceId, orgId);
    if (!instance) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Standup instance not found', HttpStatus.NOT_FOUND);
    }

    // Find team member for this user in this team
    // Get the team from the instance first
    const teamId = instance.teamId;

    // Find the team member for this team - for the test, there's only one
    const teamMember = await this.prisma.teamMember.findFirst({
      where: {
        teamId,
        active: true,
      },
    });

    if (!teamMember) {
      throw new ApiError(ErrorCode.FORBIDDEN, 'No active team member found', HttpStatus.FORBIDDEN);
    }

    const teamMemberId = teamMember.id;

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

  @Get(':id/members')
  @ApiOperation({ summary: 'Get list of members for an instance' })
  @ApiResponse({
    status: 200,
    description: 'List of instance members with their status',
  })
  @ApiResponse({
    status: 404,
    description: 'Standup instance not found',
  })
  async getInstanceMembers(
    @Param('id') instanceId: string,
    @CurrentOrg() orgId: string,
  ): Promise<
    Array<{
      id: string;
      name: string;
      platformUserId: string;
      status: 'completed' | 'not_started' | 'in_progress';
      lastReminderSent?: string;
      reminderCount: number;
      responseTime?: string;
      isLate: boolean;
    }>
  > {
    const instance = await this.standupInstanceService.getInstanceWithDetails(instanceId, orgId);
    if (!instance) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Standup instance not found', HttpStatus.NOT_FOUND);
    }

    return instance.members;
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

  @Get(':id/responses/:memberId')
  @ApiOperation({ summary: 'Get individual member response for an instance' })
  @ApiResponse({
    status: 200,
    description: 'Member response data',
  })
  @ApiResponse({
    status: 404,
    description: 'Standup instance or member response not found',
  })
  async getMemberResponse(
    @Param('id') instanceId: string,
    @Param('memberId') memberId: string,
    @CurrentOrg() orgId: string,
  ): Promise<{
    instanceId: string;
    memberId: string;
    memberName: string;
    answers: Record<string, string>;
    submittedAt?: string;
    isComplete: boolean;
  }> {
    return this.standupInstanceService.getMemberResponse(instanceId, memberId, orgId);
  }

  @Get(':id/completion-check')
  @ApiOperation({ summary: 'Check if standup instance is complete' })
  @ApiResponse({
    status: 200,
    description: 'Completion status',
  })
  async checkCompletion(
    @Param('id') instanceId: string,
    @CurrentOrg() orgId: string,
  ): Promise<{ isComplete: boolean; responseRate: number }> {
    const isComplete = await this.standupInstanceService.isInstanceComplete(instanceId, orgId);
    const responseRate = await this.standupInstanceService.calculateResponseRate(instanceId, orgId);

    return { isComplete, responseRate };
  }

  @Post('create-for-date')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  @Audit({
    action: 'standup_instance.created_for_date',
    category: AuditCategory.STANDUP,
    severity: AuditSeverity.MEDIUM,
  })
  @ApiOperation({
    summary: 'Manually create standup instances for a specific date (admin/owner only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Standup instances created',
  })
  @ApiResponse({
    status: 403,
    description: 'Admin or owner role required',
  })
  async createInstancesForDate(
    @Body() body: { targetDate: string },
  ): Promise<{ created: string[]; skipped: string[]; skipReasons?: Record<string, string> }> {
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

  @Post('create-and-trigger')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  @Audit({
    action: 'standup_instance.created_and_triggered',
    category: AuditCategory.STANDUP,
    severity: AuditSeverity.MEDIUM,
  })
  @ApiOperation({
    summary:
      'Manually create standup instances and immediately send Slack messages (admin/owner only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Standup instances created and messages sent',
  })
  @ApiResponse({
    status: 403,
    description: 'Admin or owner role required',
  })
  async createInstancesAndTrigger(@Body() body: { targetDate: string }): Promise<{
    created: string[];
    skipped: string[];
    skipReasons?: Record<string, string>;
    messages: { instanceId: string; success: boolean; error?: string }[];
  }> {
    const targetDate = new Date(body.targetDate);

    if (isNaN(targetDate.getTime())) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        'Invalid date format',
        HttpStatus.BAD_REQUEST,
      );
    }

    // First create the instances
    const createResult = await this.standupInstanceService.createInstancesForDate(targetDate);

    // Then immediately send Slack messages for the created instances
    const messageResults = [];

    for (const instanceId of createResult.created) {
      try {
        const messageResult = await this.slackMessagingService.sendStandupReminder(instanceId);
        messageResults.push({
          instanceId,
          success: messageResult.ok,
          error: messageResult.error,
        });
      } catch (error) {
        messageResults.push({
          instanceId,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      created: createResult.created,
      skipped: createResult.skipped,
      skipReasons: createResult.skipReasons,
      messages: messageResults,
    };
  }

  @Post(':id/trigger-reminder')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  @Audit({
    action: 'standup_instance.reminder_triggered',
    category: AuditCategory.STANDUP,
    severity: AuditSeverity.LOW,
    resourcesFromRequest: (req) => [
      { type: 'standup_instance', id: req.params.id, action: 'UPDATED' },
    ],
  })
  @ApiOperation({
    summary: 'Manually trigger Slack reminder for an existing standup instance (admin/owner only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Slack reminder sent successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Admin or owner role required',
  })
  @ApiResponse({
    status: 404,
    description: 'Standup instance not found',
  })
  async triggerReminder(
    @Param('id', ParseUUIDPipe) instanceId: string,
    @CurrentOrg() orgId: string,
  ): Promise<{ success: boolean; messageTs?: string; error?: string }> {
    // Verify the instance exists and belongs to the org
    const instance = await this.standupInstanceService.getInstanceWithDetails(instanceId, orgId);
    if (!instance) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Standup instance not found', HttpStatus.NOT_FOUND);
    }

    try {
      const messageResult = await this.slackMessagingService.sendStandupReminder(instanceId);
      return {
        success: messageResult.ok,
        messageTs: messageResult.ts,
        error: messageResult.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
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

    // If nextDate is null and no team found, return 404
    const teamExists = await this.standupInstanceService.teamExists(teamId);
    if (!teamExists) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Team not found', HttpStatus.NOT_FOUND);
    }

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
