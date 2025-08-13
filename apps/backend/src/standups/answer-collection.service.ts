import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { LoggerService } from '@/common/logger.service';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { AuditActorType, AuditCategory, AuditSeverity, ResourceAction } from '@/common/audit/types';
import { Prisma } from '@prisma/client';
import { StandupInstanceState as PrismaStandupInstanceState } from '@prisma/client';
import { SubmitAnswerDto } from '@/standups/dto/submit-answer.dto';
import { SubmitAnswersDto } from '@/standups/dto/submit-answers.dto';
import { MagicSubmitAnswersDto } from '@/standups/dto/magic-submit-answers.dto';
import { MagicTokenService } from '@/standups/services/magic-token.service';

interface ConfigSnapshot {
  questions: string[];
  responseTimeoutHours: number;
  reminderMinutesBefore: number;
  participatingMembers: Array<{
    id: string;
    name: string;
    platformUserId: string;
  }>;
  timezone: string;
  timeLocal: string;
}

interface AnswerResponse {
  questionIndex: number;
  text: string;
  submittedAt: Date;
}

interface MemberAnswersResponse {
  teamMemberId: string;
  memberName: string;
  answers: AnswerResponse[];
  isComplete: boolean;
  questionsAnswered: number;
  totalQuestions: number;
}

interface CompletionStats {
  totalMembers: number;
  respondedMembers: number;
  completeMembers: number;
  averageResponseTime?: number;
  responseRate: number;
  completionRate: number;
}

@Injectable()
export class AnswerCollectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly logger: LoggerService,
    private readonly magicTokenService: MagicTokenService,
  ) {
    this.logger.setContext(AnswerCollectionService.name);
  }

  /**
   * Submit a single answer for a standup instance
   */
  async submitAnswer(
    data: SubmitAnswerDto,
    memberId: string,
    orgId: string,
  ): Promise<{ success: boolean }> {
    this.logger.info('Submitting single answer', {
      instanceId: data.standupInstanceId,
      memberId,
      questionIndex: data.questionIndex,
    });

    // Validate submission
    await this.validateAnswerSubmission(
      data.standupInstanceId,
      memberId,
      data.questionIndex,
      orgId,
    );

    // Get instance and team member info
    const instance = await this.prisma.standupInstance.findFirst({
      where: {
        id: data.standupInstanceId,
        team: { orgId },
      },
      include: {
        team: true,
      },
    });

    if (!instance) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Standup instance not found', HttpStatus.NOT_FOUND);
    }

    const teamMember = await this.prisma.teamMember.findFirst({
      where: {
        id: memberId,
        teamId: instance.teamId,
        active: true,
      },
    });

    if (!teamMember) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Team member not found', HttpStatus.NOT_FOUND);
    }

    // Upsert the answer
    await this.prisma.answer.upsert({
      where: {
        standupInstanceId_teamMemberId_questionIndex: {
          standupInstanceId: data.standupInstanceId,
          teamMemberId: memberId,
          questionIndex: data.questionIndex,
        },
      },
      update: {
        text: data.text,
        submittedAt: new Date(),
      },
      create: {
        standupInstanceId: data.standupInstanceId,
        teamMemberId: memberId,
        questionIndex: data.questionIndex,
        text: data.text,
      },
    });

    // Audit log
    await this.auditLogService.log({
      actorType: AuditActorType.USER,
      actorUserId: memberId,
      orgId,
      category: AuditCategory.STANDUP,
      severity: AuditSeverity.INFO,
      action: 'standup_answer_submitted',
      requestData: {
        method: 'POST',
        path: '/standups/answers',
        ipAddress: '127.0.0.1',
        body: {
          instanceId: data.standupInstanceId,
          questionIndex: data.questionIndex,
          answerLength: data.text.length,
        },
      },
      resources: [
        {
          type: 'standup_instance',
          id: data.standupInstanceId,
          action: ResourceAction.UPDATED,
        },
      ],
    });

    this.logger.info('Answer submitted successfully', {
      instanceId: data.standupInstanceId,
      memberId,
      questionIndex: data.questionIndex,
    });

    return { success: true };
  }

  /**
   * Submit multiple answers at once for a standup instance
   */
  async submitFullResponse(
    data: SubmitAnswersDto,
    memberId: string,
    orgId: string,
  ): Promise<{ success: boolean; answersSubmitted: number }> {
    this.logger.info('Submitting full response', {
      instanceId: data.standupInstanceId,
      memberId,
      answersCount: data.answers.length,
    });

    // Get instance and validate
    const instance = await this.prisma.standupInstance.findFirst({
      where: {
        id: data.standupInstanceId,
        team: { orgId },
      },
      include: {
        team: true,
      },
    });

    if (!instance) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Standup instance not found', HttpStatus.NOT_FOUND);
    }

    const configSnapshot = instance.configSnapshot as unknown as ConfigSnapshot;

    // Validate team member
    const teamMember = await this.prisma.teamMember.findFirst({
      where: {
        id: memberId,
        teamId: instance.teamId,
        active: true,
      },
    });

    if (!teamMember) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Team member not found', HttpStatus.NOT_FOUND);
    }

    // Validate submission window
    if (!this.canStillSubmit(instance)) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        'Response collection window has closed',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate member is participating
    const isParticipating = configSnapshot.participatingMembers.some((m) => m.id === memberId);
    if (!isParticipating) {
      throw new ApiError(
        ErrorCode.FORBIDDEN,
        'Member is not participating in this standup',
        HttpStatus.FORBIDDEN,
      );
    }

    // Validate question indices
    const maxQuestionIndex = configSnapshot.questions.length - 1;
    for (const answer of data.answers) {
      if (answer.questionIndex < 0 || answer.questionIndex > maxQuestionIndex) {
        throw new ApiError(
          ErrorCode.VALIDATION_FAILED,
          `Invalid question index: ${answer.questionIndex}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // Use transaction to ensure atomicity
    const result = await this.prisma.$transaction(async (tx) => {
      const upsertPromises = data.answers.map((answer) =>
        tx.answer.upsert({
          where: {
            standupInstanceId_teamMemberId_questionIndex: {
              standupInstanceId: data.standupInstanceId,
              teamMemberId: memberId,
              questionIndex: answer.questionIndex,
            },
          },
          update: {
            text: answer.text,
            submittedAt: new Date(),
          },
          create: {
            standupInstanceId: data.standupInstanceId,
            teamMemberId: memberId,
            questionIndex: answer.questionIndex,
            text: answer.text,
          },
        }),
      );

      await Promise.all(upsertPromises);
      return data.answers.length;
    });

    // Audit log
    await this.auditLogService.log({
      actorType: AuditActorType.USER,
      actorUserId: memberId,
      orgId,
      category: AuditCategory.STANDUP,
      severity: AuditSeverity.INFO,
      action: 'standup_full_response_submitted',
      requestData: {
        method: 'POST',
        path: '/standups/answers/bulk',
        ipAddress: '127.0.0.1',
        body: {
          instanceId: data.standupInstanceId,
          answersSubmitted: result,
          totalAnswerLength: data.answers.reduce((sum, a) => sum + a.text.length, 0),
        },
      },
      resources: [
        {
          type: 'standup_instance',
          id: data.standupInstanceId,
          action: ResourceAction.UPDATED,
        },
      ],
    });

    this.logger.info('Full response submitted successfully', {
      instanceId: data.standupInstanceId,
      memberId,
      answersSubmitted: result,
    });

    return { success: true, answersSubmitted: result };
  }

  /**
   * Get answers for an instance, optionally filtered by member
   */
  async getAnswers(
    instanceId: string,
    orgId: string,
    memberId?: string,
  ): Promise<MemberAnswersResponse[]> {
    const whereClause: Prisma.AnswerWhereInput = {
      standupInstanceId: instanceId,
      standupInstance: {
        team: { orgId },
      },
    };

    if (memberId) {
      whereClause.teamMemberId = memberId;
    }

    const answers = await this.prisma.answer.findMany({
      where: whereClause,
      include: {
        teamMember: {
          include: {
            integrationUser: true,
          },
        },
        standupInstance: true,
      },
      orderBy: [{ teamMemberId: 'asc' }, { questionIndex: 'asc' }],
    });

    if (answers.length === 0) {
      return [];
    }

    const configSnapshot = answers[0].standupInstance.configSnapshot as unknown as ConfigSnapshot;
    const totalQuestions = configSnapshot.questions.length;

    // Group answers by team member
    const memberAnswersMap = new Map<string, AnswerResponse[]>();
    const memberInfoMap = new Map<string, { id: string; name: string }>();

    answers.forEach((answer) => {
      const memberId = answer.teamMemberId;

      if (!memberAnswersMap.has(memberId)) {
        memberAnswersMap.set(memberId, []);
        memberInfoMap.set(memberId, {
          id: memberId,
          name: answer.teamMember.name || answer.teamMember.integrationUser?.name || 'Unknown',
        });
      }

      memberAnswersMap.get(memberId)!.push({
        questionIndex: answer.questionIndex,
        text: answer.text,
        submittedAt: answer.submittedAt,
      });
    });

    // Convert to response format
    const result: MemberAnswersResponse[] = Array.from(memberAnswersMap.entries()).map(
      ([memberId, memberAnswers]) => {
        const memberInfo = memberInfoMap.get(memberId)!;
        const questionsAnswered = memberAnswers.length;

        return {
          teamMemberId: memberId,
          memberName: memberInfo.name,
          answers: memberAnswers.sort((a, b) => a.questionIndex - b.questionIndex),
          isComplete: questionsAnswered >= totalQuestions,
          questionsAnswered,
          totalQuestions,
        };
      },
    );

    return result.sort((a, b) => a.memberName.localeCompare(b.memberName));
  }

  /**
   * Get missing answers for a member
   */
  async getMissingAnswers(
    instanceId: string,
    memberId: string,
    orgId: string,
  ): Promise<{ questionIndex: number; question: string }[]> {
    const instance = await this.prisma.standupInstance.findFirst({
      where: {
        id: instanceId,
        team: { orgId },
      },
    });

    if (!instance) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Standup instance not found', HttpStatus.NOT_FOUND);
    }

    const configSnapshot = instance.configSnapshot as unknown as ConfigSnapshot;

    // Get existing answers for this member
    const existingAnswers = await this.prisma.answer.findMany({
      where: {
        standupInstanceId: instanceId,
        teamMemberId: memberId,
      },
      select: { questionIndex: true },
    });

    const answeredIndices = new Set(existingAnswers.map((a) => a.questionIndex));

    // Find missing questions
    const missingAnswers = configSnapshot.questions
      .map((question, index) => ({ questionIndex: index, question }))
      .filter(({ questionIndex }) => !answeredIndices.has(questionIndex));

    return missingAnswers;
  }

  /**
   * Validate answer submission
   */
  async validateAnswerSubmission(
    instanceId: string,
    memberId: string,
    questionIndex: number,
    orgId: string,
  ): Promise<void> {
    const instance = await this.prisma.standupInstance.findFirst({
      where: {
        id: instanceId,
        team: { orgId },
      },
    });

    if (!instance) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Standup instance not found', HttpStatus.NOT_FOUND);
    }

    const configSnapshot = instance.configSnapshot as unknown as ConfigSnapshot;

    // Validate question index
    if (questionIndex < 0 || questionIndex >= configSnapshot.questions.length) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        'Invalid question index',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate member is participating
    const isParticipating = configSnapshot.participatingMembers.some((m) => m.id === memberId);
    if (!isParticipating) {
      throw new ApiError(
        ErrorCode.FORBIDDEN,
        'Member is not participating in this standup',
        HttpStatus.FORBIDDEN,
      );
    }

    // Validate submission window
    if (!this.canStillSubmit(instance)) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        'Response collection window has closed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Check if a member's response is complete
   */
  async isResponseComplete(instanceId: string, memberId: string): Promise<boolean> {
    const instance = await this.prisma.standupInstance.findUnique({
      where: { id: instanceId },
    });

    if (!instance) {
      return false;
    }

    const configSnapshot = instance.configSnapshot as unknown as ConfigSnapshot;
    const totalQuestions = configSnapshot.questions.length;

    const answerCount = await this.prisma.answer.count({
      where: {
        standupInstanceId: instanceId,
        teamMemberId: memberId,
      },
    });

    return answerCount >= totalQuestions;
  }

  /**
   * Check if submissions are still allowed for an instance
   */
  canStillSubmit(instance: {
    state: PrismaStandupInstanceState;
    createdAt: Date;
    configSnapshot: unknown;
  }): boolean {
    if (instance.state !== PrismaStandupInstanceState.collecting) {
      return false;
    }

    const configSnapshot = instance.configSnapshot as unknown as ConfigSnapshot;
    const timeoutHours = configSnapshot.responseTimeoutHours;

    // Calculate timeout based on instance creation time
    const timeoutAt = new Date(instance.createdAt.getTime() + timeoutHours * 60 * 60 * 1000);

    return new Date() < timeoutAt;
  }

  /**
   * Generate participation snapshot for metrics
   */
  async generateParticipationSnapshot(instanceId: string): Promise<{ id: string }> {
    const instance = await this.prisma.standupInstance.findUnique({
      where: { id: instanceId },
      include: {
        answers: { select: { teamMemberId: true } },
      },
    });

    if (!instance) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Standup instance not found', HttpStatus.NOT_FOUND);
    }

    const configSnapshot = instance.configSnapshot as unknown as ConfigSnapshot;
    const totalMembers = configSnapshot.participatingMembers.length;

    // Count unique respondents
    const respondedMembers = new Set(instance.answers.map((a) => a.teamMemberId)).size;
    const membersMissing = totalMembers - respondedMembers;

    const snapshot = await this.prisma.participationSnapshot.create({
      data: {
        standupInstanceId: instanceId,
        answersCount: instance.answers.length,
        membersMissing,
      },
    });

    this.logger.info('Participation snapshot created', {
      instanceId,
      snapshotId: snapshot.id,
      totalMembers,
      respondedMembers,
      membersMissing,
    });

    return { id: snapshot.id };
  }

  /**
   * Calculate completion statistics for an instance
   */
  async calculateCompletionStats(instanceId: string): Promise<CompletionStats> {
    const instance = await this.prisma.standupInstance.findUnique({
      where: { id: instanceId },
      include: {
        answers: {
          select: {
            teamMemberId: true,
            submittedAt: true,
          },
        },
      },
    });

    if (!instance) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Standup instance not found', HttpStatus.NOT_FOUND);
    }

    const configSnapshot = instance.configSnapshot as unknown as ConfigSnapshot;
    const totalMembers = configSnapshot.participatingMembers.length;
    const totalQuestions = configSnapshot.questions.length;

    // Group answers by member
    const memberAnswers = new Map<string, Date[]>();
    instance.answers.forEach((answer) => {
      if (!memberAnswers.has(answer.teamMemberId)) {
        memberAnswers.set(answer.teamMemberId, []);
      }
      memberAnswers.get(answer.teamMemberId)!.push(answer.submittedAt);
    });

    const respondedMembers = memberAnswers.size;
    const completeMembers = Array.from(memberAnswers.values()).filter(
      (answers) => answers.length >= totalQuestions,
    ).length;

    // Calculate average response time (from instance creation to first answer)
    let averageResponseTime: number | undefined;
    if (respondedMembers > 0) {
      const responseTimes = Array.from(memberAnswers.values()).map((answers) => {
        const firstAnswer = answers.sort((a, b) => a.getTime() - b.getTime())[0];
        return firstAnswer.getTime() - instance.createdAt.getTime();
      });

      averageResponseTime =
        responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    }

    return {
      totalMembers,
      respondedMembers,
      completeMembers,
      averageResponseTime,
      responseRate: totalMembers > 0 ? Math.round((respondedMembers / totalMembers) * 100) : 0,
      completionRate: totalMembers > 0 ? Math.round((completeMembers / totalMembers) * 100) : 0,
    };
  }

  /**
   * Get response history for a team over a date range
   */
  async getResponseHistory(
    teamId: string,
    orgId: string,
    startDate: Date,
    endDate: Date,
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
    const instances = await this.prisma.standupInstance.findMany({
      where: {
        teamId,
        team: { orgId },
        targetDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        answers: {
          select: { teamMemberId: true },
        },
      },
      orderBy: { targetDate: 'desc' },
    });

    return instances.map((instance) => {
      const configSnapshot = instance.configSnapshot as unknown as ConfigSnapshot;
      const totalMembers = configSnapshot.participatingMembers.length;
      const respondedMembers = new Set(instance.answers.map((a) => a.teamMemberId)).size;
      const responseRate =
        totalMembers > 0 ? Math.round((respondedMembers / totalMembers) * 100) : 0;

      return {
        date: instance.targetDate.toISOString().split('T')[0],
        instanceId: instance.id,
        totalMembers,
        respondedMembers,
        responseRate,
        state: instance.state,
      };
    });
  }

  /**
   * Delete member responses from an instance
   */
  async deleteMemberResponses(
    instanceId: string,
    memberId: string,
    orgId: string,
    actorUserId: string,
  ): Promise<{ deleted: number }> {
    this.logger.info('Deleting member responses', { instanceId, memberId });

    // Validate instance exists and belongs to org
    const instance = await this.prisma.standupInstance.findFirst({
      where: {
        id: instanceId,
        team: { orgId },
      },
      include: { team: true },
    });

    if (!instance) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Standup instance not found', HttpStatus.NOT_FOUND);
    }

    // Delete answers
    const result = await this.prisma.answer.deleteMany({
      where: {
        standupInstanceId: instanceId,
        teamMemberId: memberId,
      },
    });

    // Audit log
    await this.auditLogService.log({
      actorType: AuditActorType.USER,
      actorUserId: actorUserId,
      orgId,
      category: AuditCategory.STANDUP,
      severity: AuditSeverity.MEDIUM,
      action: 'standup_member_responses_deleted',
      requestData: {
        method: 'DELETE',
        path: `/standups/answers/${instanceId}/${memberId}`,
        ipAddress: '127.0.0.1',
        body: {
          deletedMemberId: memberId,
          deletedAnswers: result.count,
        },
      },
      resources: [
        {
          type: 'standup_instance',
          id: instanceId,
          action: ResourceAction.UPDATED,
        },
      ],
    });

    this.logger.info('Member responses deleted successfully', {
      instanceId,
      memberId,
      deletedCount: result.count,
    });

    return { deleted: result.count };
  }

  /**
   * Submit standup responses using a magic token
   */
  async submitResponseWithMagicToken(
    data: MagicSubmitAnswersDto,
  ): Promise<{ success: boolean; answersSubmitted: number }> {
    this.logger.info('Submitting response with magic token', {
      answersCount: data.answers.length,
      tokenProvided: !!data.magicToken,
    });

    // Validate the magic token
    const tokenPayload = await this.magicTokenService.validateMagicToken(data.magicToken);
    if (!tokenPayload) {
      throw new ApiError(
        ErrorCode.UNAUTHENTICATED,
        'Invalid or expired magic token',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Get instance and validate
    const instance = await this.prisma.standupInstance.findFirst({
      where: {
        id: tokenPayload.standupInstanceId,
        team: { orgId: tokenPayload.orgId },
      },
      include: {
        team: true,
      },
    });

    if (!instance) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Standup instance not found', HttpStatus.NOT_FOUND);
    }

    const configSnapshot = instance.configSnapshot as unknown as ConfigSnapshot;

    // Validate team member exists and is active
    const teamMember = await this.prisma.teamMember.findFirst({
      where: {
        id: tokenPayload.teamMemberId,
        teamId: instance.teamId,
        active: true,
      },
    });

    if (!teamMember) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Team member not found', HttpStatus.NOT_FOUND);
    }

    // Validate submission window (double-check)
    if (!this.canStillSubmit(instance)) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        'Response collection window has closed',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate question indices
    const maxQuestionIndex = configSnapshot.questions.length - 1;
    for (const answer of data.answers) {
      if (answer.questionIndex < 0 || answer.questionIndex > maxQuestionIndex) {
        throw new ApiError(
          ErrorCode.VALIDATION_FAILED,
          `Invalid question index: ${answer.questionIndex}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // Use transaction to ensure atomicity
    const result = await this.prisma.$transaction(async (tx) => {
      const upsertPromises = data.answers.map((answer) =>
        tx.answer.upsert({
          where: {
            standupInstanceId_teamMemberId_questionIndex: {
              standupInstanceId: tokenPayload.standupInstanceId,
              teamMemberId: tokenPayload.teamMemberId,
              questionIndex: answer.questionIndex,
            },
          },
          update: {
            text: answer.text,
            submittedAt: new Date(),
          },
          create: {
            standupInstanceId: tokenPayload.standupInstanceId,
            teamMemberId: tokenPayload.teamMemberId,
            questionIndex: answer.questionIndex,
            text: answer.text,
          },
        }),
      );

      await Promise.all(upsertPromises);
      return data.answers.length;
    });

    // Audit log
    await this.auditLogService.log({
      actorType: AuditActorType.USER,
      actorUserId: tokenPayload.teamMemberId,
      orgId: tokenPayload.orgId,
      category: AuditCategory.STANDUP,
      severity: AuditSeverity.INFO,
      action: 'standup_magic_token_response_submitted',
      requestData: {
        method: 'POST',
        path: '/standups/submit-magic',
        ipAddress: '127.0.0.1',
        body: {
          instanceId: tokenPayload.standupInstanceId,
          answersSubmitted: result,
          totalAnswerLength: data.answers.reduce((sum, a) => sum + a.text.length, 0),
          authMethod: 'magic_token',
        },
      },
      resources: [
        {
          type: 'standup_instance',
          id: tokenPayload.standupInstanceId,
          action: ResourceAction.UPDATED,
        },
      ],
    });

    this.logger.info('Magic token response submitted successfully', {
      instanceId: tokenPayload.standupInstanceId,
      teamMemberId: tokenPayload.teamMemberId,
      answersSubmitted: result,
    });

    return { success: true, answersSubmitted: result };
  }

  /**
   * Generate magic tokens for all participating members of a standup instance
   */
  async generateMagicTokensForInstance(
    instanceId: string,
    orgId: string,
  ): Promise<
    Array<{ teamMemberId: string; memberName: string; magicToken: string; submissionUrl: string }>
  > {
    this.logger.info('Generating magic tokens for standup instance', { instanceId, orgId });

    // Get instance with participating members
    const instance = await this.prisma.standupInstance.findFirst({
      where: {
        id: instanceId,
        team: { orgId },
      },
      include: {
        team: {
          include: {
            members: {
              where: { active: true },
              include: {
                integrationUser: true,
              },
            },
          },
        },
      },
    });

    if (!instance) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Standup instance not found', HttpStatus.NOT_FOUND);
    }

    const configSnapshot = instance.configSnapshot as unknown as ConfigSnapshot;
    const participatingMemberIds = new Set(configSnapshot.participatingMembers.map((m) => m.id));

    // Filter active team members who are participating
    const participatingMembers = instance.team.members.filter((member) =>
      participatingMemberIds.has(member.id),
    );

    // Generate magic tokens for each participating member
    const tokens = [];
    for (const member of participatingMembers) {
      try {
        const tokenInfo = await this.magicTokenService.generateMagicToken(
          instanceId,
          member.id,
          member.platformUserId,
          orgId,
          configSnapshot.responseTimeoutHours,
        );

        tokens.push({
          teamMemberId: member.id,
          memberName: member.name || member.integrationUser?.name || 'Unknown',
          magicToken: tokenInfo.token,
          submissionUrl: tokenInfo.submissionUrl,
        });
      } catch (error) {
        this.logger.error('Failed to generate magic token for member', {
          memberId: member.id,
          memberName: member.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.logger.info('Magic tokens generated successfully', {
      instanceId,
      totalMembers: participatingMembers.length,
      tokensGenerated: tokens.length,
    });

    return tokens;
  }
}
