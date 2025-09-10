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
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  SwaggerGetActiveInstances,
  SwaggerGetInstanceDetails,
  SwaggerUpdateInstanceState,
  SwaggerSubmitAnswers,
  SwaggerGetParticipationStatus,
  SwaggerGetInstanceMembers,
  SwaggerGetParticipatingMembers,
  SwaggerGetMemberResponse,
  SwaggerCheckCompletion,
  SwaggerCreateInstancesForDate,
  SwaggerCreateInstancesAndTrigger,
  SwaggerCreateInstanceAndTriggerForConfig,
  SwaggerTriggerReminder,
  SwaggerGetNextStandupDate,
  SwaggerShouldCreateToday,
} from '@/swagger/standup-instance.swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/guards/roles.guard';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { CurrentOrg } from '@/auth/decorators/current-org.decorator';
import { StandupInstanceService } from '@/standups/standup-instance.service';
import { SlackMessagingService } from '@/integrations/slack/slack-messaging.service';
import { StandupInstanceDto } from '@/standups/dto/standup-instance.dto';
import { ParticipationStatusDto } from '@/standups/dto/participation-status.dto';
import { UpdateInstanceStateDto } from '@/standups/dto/update-instance-state.dto';
import { SubmitAnswersDto } from '@/standups/dto/submit-answers.dto';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { Audit } from '@/common/audit/audit.decorator';
import { AuditCategory, AuditSeverity } from '@/common/audit/types';

@ApiTags('Standup Instances')
@Controller('standups/instances')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StandupInstanceController {
  constructor(
    private readonly standupInstanceService: StandupInstanceService,
    private readonly slackMessagingService: SlackMessagingService,
  ) {}

  @Get()
  @SwaggerGetActiveInstances()
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
  @SwaggerGetInstanceDetails()
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
  @SwaggerUpdateInstanceState()
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
  @SwaggerSubmitAnswers()
  async submitAnswers(
    @Param('id', ParseUUIDPipe) instanceId: string,
    @Body() submitAnswersDto: SubmitAnswersDto,
    @CurrentOrg() orgId: string,
  ): Promise<{ success: boolean; answersSubmitted: number }> {
    return this.standupInstanceService.submitAnswersForInstance(
      instanceId,
      submitAnswersDto,
      orgId,
    );
  }

  @Get(':id/status')
  @SwaggerGetParticipationStatus()
  async getParticipationStatus(
    @Param('id') instanceId: string,
    @CurrentOrg() orgId: string,
  ): Promise<ParticipationStatusDto> {
    return this.standupInstanceService.getInstanceParticipation(instanceId, orgId);
  }

  @Get(':id/members')
  @SwaggerGetInstanceMembers()
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
    return this.standupInstanceService.getInstanceMembers(instanceId, orgId);
  }

  @Get(':id/participating-members')
  @SwaggerGetParticipatingMembers()
  async getParticipatingMembers(
    @Param('id') instanceId: string,
  ): Promise<Array<{ id: string; name: string; platformUserId: string }>> {
    return this.standupInstanceService.getParticipatingMembers(instanceId);
  }

  @Get(':id/responses/:memberId')
  @SwaggerGetMemberResponse()
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
  @SwaggerCheckCompletion()
  async checkCompletion(
    @Param('id') instanceId: string,
    @CurrentOrg() orgId: string,
  ): Promise<{ isComplete: boolean; responseRate: number }> {
    return this.standupInstanceService.getInstanceCompletionStatus(instanceId, orgId);
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
  @SwaggerCreateInstancesForDate()
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
  @SwaggerCreateInstancesAndTrigger()
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

    // Then immediately send Slack messages for all created instances in parallel
    const messagePromises = createResult.created.map(async (instanceId) => {
      try {
        const messageResult = await this.slackMessagingService.sendStandupReminder(instanceId);
        return {
          instanceId,
          success: messageResult.ok,
          error: messageResult.error,
        };
      } catch (error) {
        return {
          instanceId,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    // Wait for all message sending operations to complete
    const messageSettledResults = await Promise.allSettled(messagePromises);
    const messageResults = messageSettledResults.map((result) =>
      result.status === 'fulfilled'
        ? result.value
        : {
            instanceId: 'unknown',
            success: false,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          },
    );

    return {
      created: createResult.created,
      skipped: createResult.skipped,
      skipReasons: createResult.skipReasons,
      messages: messageResults,
    };
  }

  @Post('config/:configId/create-and-trigger')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  @Audit({
    action: 'standup_instance.created_and_triggered_for_config',
    category: AuditCategory.STANDUP,
    severity: AuditSeverity.MEDIUM,
    resourcesFromRequest: (req) => [
      { type: 'standup_config', id: req.params.configId, action: 'TRIGGERED' },
    ],
  })
  @SwaggerCreateInstanceAndTriggerForConfig()
  async createInstanceAndTriggerForConfig(
    @Param('configId') configId: string,
    @Body() body: { targetDate: string },
  ): Promise<{
    instanceId?: string;
    success: boolean;
    message: string;
  }> {
    const targetDate = new Date(body.targetDate);
    if (isNaN(targetDate.getTime())) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        'Invalid date format',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Create the instance using the service
    const result = await this.standupInstanceService.createInstanceForConfig(configId, targetDate);

    if (!result.success || !result.instanceId) {
      return result;
    }

    // Send Slack message asynchronously with timeout to avoid blocking the response
    const sendMessageAsync = async () => {
      try {
        // Set a 30-second timeout for Slack operations
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Slack API timeout after 30 seconds')), 30000);
        });

        await Promise.race([
          this.slackMessagingService.sendStandupReminder(result.instanceId!),
          timeoutPromise,
        ]);

        // Log success - using a simple approach since we don't have logger in the async function
        // The SlackMessagingService already logs successes and failures internally
      } catch {
        // Log error - using a simple approach since we don't have logger in the async function
        // The SlackMessagingService already logs failures internally
      }
    };

    // Fire and forget - don't wait for Slack message completion
    sendMessageAsync();

    return {
      instanceId: result.instanceId,
      success: true,
      message: 'Standup instance created, notification being sent asynchronously',
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
  @SwaggerTriggerReminder()
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
  @SwaggerGetNextStandupDate()
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
  @SwaggerShouldCreateToday()
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
