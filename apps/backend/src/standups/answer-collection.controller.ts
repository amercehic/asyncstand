import {
  Controller,
  Get,
  Post,
  Delete,
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
import { AnswerCollectionService } from '@/standups/answer-collection.service';
import { SubmitAnswerDto } from '@/standups/dto/submit-answer.dto';
import { SubmitAnswersDto } from '@/standups/dto/submit-answers.dto';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';

@ApiTags('Standup Answers')
@Controller('standups/answers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnswerCollectionController {
  constructor(private readonly answerCollectionService: AnswerCollectionService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a single answer' })
  @ApiResponse({
    status: 201,
    description: 'Answer submitted successfully',
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
  async submitAnswer(
    @Body() submitAnswerDto: SubmitAnswerDto,
    @CurrentUser('userId') userId: string,
    @CurrentOrg() orgId: string,
  ): Promise<{ success: boolean }> {
    // TODO: Map userId to teamMemberId - for now assume they're the same
    // In a real implementation, you'd need to look up the teamMember record
    const teamMemberId = userId; // This is a simplification

    return this.answerCollectionService.submitAnswer(submitAnswerDto, teamMemberId, orgId);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Submit multiple answers at once' })
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
  async submitBulkAnswers(
    @Body() submitAnswersDto: SubmitAnswersDto,
    @CurrentUser('userId') userId: string,
    @CurrentOrg() orgId: string,
  ): Promise<{ success: boolean; answersSubmitted: number }> {
    // TODO: Map userId to teamMemberId - for now assume they're the same
    const teamMemberId = userId; // This is a simplification

    return this.answerCollectionService.submitFullResponse(submitAnswersDto, teamMemberId, orgId);
  }

  @Get(':instanceId')
  @ApiOperation({ summary: 'Get answers for an instance' })
  @ApiResponse({
    status: 200,
    description: 'Instance answers',
  })
  @ApiResponse({
    status: 404,
    description: 'Standup instance not found',
  })
  async getInstanceAnswers(
    @Param('instanceId') instanceId: string,
    @CurrentOrg() orgId: string,
    @Query('memberId') memberId?: string,
  ): Promise<
    Array<{
      teamMemberId: string;
      memberName: string;
      answers: Array<{
        questionIndex: number;
        text: string;
        submittedAt: Date;
      }>;
      isComplete: boolean;
      questionsAnswered: number;
      totalQuestions: number;
    }>
  > {
    return this.answerCollectionService.getAnswers(instanceId, orgId, memberId);
  }

  @Get(':instanceId/missing/:memberId')
  @ApiOperation({ summary: 'Get missing answers for a specific member' })
  @ApiResponse({
    status: 200,
    description: 'Missing questions for the member',
  })
  @ApiResponse({
    status: 404,
    description: 'Standup instance not found',
  })
  async getMissingAnswers(
    @Param('instanceId') instanceId: string,
    @Param('memberId') memberId: string,
    @CurrentOrg() orgId: string,
  ): Promise<Array<{ questionIndex: number; question: string }>> {
    return this.answerCollectionService.getMissingAnswers(instanceId, memberId, orgId);
  }

  @Get(':instanceId/completion/:memberId')
  @ApiOperation({ summary: 'Check if a member has completed their response' })
  @ApiResponse({
    status: 200,
    description: 'Member completion status',
  })
  async checkMemberCompletion(
    @Param('instanceId') instanceId: string,
    @Param('memberId') memberId: string,
  ): Promise<{ isComplete: boolean }> {
    const isComplete = await this.answerCollectionService.isResponseComplete(instanceId, memberId);
    return { isComplete };
  }

  @Get(':instanceId/stats')
  @ApiOperation({ summary: 'Get completion statistics for an instance' })
  @ApiResponse({
    status: 200,
    description: 'Completion statistics',
  })
  @ApiResponse({
    status: 404,
    description: 'Standup instance not found',
  })
  async getCompletionStats(@Param('instanceId') instanceId: string): Promise<{
    totalMembers: number;
    respondedMembers: number;
    completeMembers: number;
    averageResponseTime?: number;
    responseRate: number;
    completionRate: number;
  }> {
    return this.answerCollectionService.calculateCompletionStats(instanceId);
  }

  @Delete(':instanceId/:memberId')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Delete member responses from an instance (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Member responses deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Admin role required',
  })
  @ApiResponse({
    status: 404,
    description: 'Standup instance not found',
  })
  async deleteMemberResponses(
    @Param('instanceId') instanceId: string,
    @Param('memberId') memberId: string,
    @CurrentUser('userId') userId: string,
    @CurrentOrg() orgId: string,
  ): Promise<{ success: boolean; deleted: number }> {
    const result = await this.answerCollectionService.deleteMemberResponses(
      instanceId,
      memberId,
      orgId,
      userId,
    );

    return {
      success: true,
      deleted: result.deleted,
    };
  }

  @Post(':instanceId/snapshot')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Generate participation snapshot for metrics (admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Participation snapshot created',
  })
  @ApiResponse({
    status: 403,
    description: 'Admin role required',
  })
  @ApiResponse({
    status: 404,
    description: 'Standup instance not found',
  })
  async generateParticipationSnapshot(
    @Param('instanceId') instanceId: string,
  ): Promise<{ success: boolean; snapshotId: string }> {
    const result = await this.answerCollectionService.generateParticipationSnapshot(instanceId);

    return {
      success: true,
      snapshotId: result.id,
    };
  }

  @Get('team/:teamId/history')
  @ApiOperation({ summary: 'Get response history for a team' })
  @ApiResponse({
    status: 200,
    description: 'Team response history',
  })
  async getTeamResponseHistory(
    @Param('teamId') teamId: string,
    @CurrentOrg() orgId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: number,
  ): Promise<
    Array<{
      date: string;
      instanceId: string;
      totalMembers: number;
      respondedMembers: number;
      responseRate: number;
      state: string;
    }>
  > {
    // Default to last 30 days if no dates provided
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        'Invalid date format',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (start > end) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        'Start date must be before end date',
        HttpStatus.BAD_REQUEST,
      );
    }

    const history = await this.answerCollectionService.getResponseHistory(
      teamId,
      orgId,
      start,
      end,
    );

    // Apply limit if provided
    if (limit && limit > 0) {
      return history.slice(0, Math.min(limit, 100)); // Max 100 records
    }

    return history;
  }

  @Get('my/:instanceId')
  @ApiOperation({ summary: "Get current user's answers for an instance" })
  @ApiResponse({
    status: 200,
    description: "User's answers for the instance",
  })
  @ApiResponse({
    status: 404,
    description: 'Standup instance not found',
  })
  async getMyAnswers(
    @Param('instanceId') instanceId: string,
    @CurrentUser('userId') userId: string,
    @CurrentOrg() orgId: string,
  ): Promise<{
    answers: Array<{
      questionIndex: number;
      text: string;
      submittedAt: Date;
    }>;
    isComplete: boolean;
    questionsAnswered: number;
    totalQuestions: number;
    canStillSubmit: boolean;
  }> {
    // TODO: Map userId to teamMemberId
    const teamMemberId = userId;

    const answers = await this.answerCollectionService.getAnswers(instanceId, orgId, teamMemberId);
    const memberAnswers = answers.find((a) => a.teamMemberId === teamMemberId);

    if (!memberAnswers) {
      return {
        answers: [],
        isComplete: false,
        questionsAnswered: 0,
        totalQuestions: 0,
        canStillSubmit: false,
      };
    }

    // Check if can still submit by getting instance details
    // This is a simplified check - in production you'd want to optimize this
    const isComplete = await this.answerCollectionService.isResponseComplete(
      instanceId,
      teamMemberId,
    );

    return {
      answers: memberAnswers.answers,
      isComplete: memberAnswers.isComplete,
      questionsAnswered: memberAnswers.questionsAnswered,
      totalQuestions: memberAnswers.totalQuestions,
      canStillSubmit: !isComplete, // Simplified - should check collection window
    };
  }

  @Get('my/:instanceId/missing')
  @ApiOperation({ summary: "Get current user's missing answers for an instance" })
  @ApiResponse({
    status: 200,
    description: "User's missing questions",
  })
  @ApiResponse({
    status: 404,
    description: 'Standup instance not found',
  })
  async getMyMissingAnswers(
    @Param('instanceId') instanceId: string,
    @CurrentUser('userId') userId: string,
    @CurrentOrg() orgId: string,
  ): Promise<Array<{ questionIndex: number; question: string }>> {
    // TODO: Map userId to teamMemberId
    const teamMemberId = userId;

    return this.answerCollectionService.getMissingAnswers(instanceId, teamMemberId, orgId);
  }
}
