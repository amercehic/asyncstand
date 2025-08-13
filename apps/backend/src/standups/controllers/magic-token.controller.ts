import { Controller, Get, Post, Body, UseGuards, HttpStatus, HttpException } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { MagicTokenGuard } from '@/standups/guards/magic-token.guard';
import { MagicToken } from '@/standups/decorators/magic-token.decorator';
import { MagicTokenService, MagicTokenPayload } from '@/standups/services/magic-token.service';
import { AnswerCollectionService } from '@/standups/answer-collection.service';
import { LoggerService } from '@/common/logger.service';

interface StandupInfoResponse {
  instance: {
    id: string;
    targetDate: Date;
    createdAt: Date;
    state: string;
    timeoutAt: Date;
  };
  team: {
    id: string;
    name: string;
  };
  member: {
    id: string;
    name: string;
    platformUserId: string;
  };
  questions: string[];
  hasExistingResponses: boolean;
}

@ApiTags('Magic Token')
@Controller('magic-token')
export class MagicTokenController {
  constructor(
    private readonly magicTokenService: MagicTokenService,
    private readonly answerCollectionService: AnswerCollectionService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(MagicTokenController.name);
  }

  @Get('standup-info')
  @UseGuards(MagicTokenGuard)
  @ApiBearerAuth()
  @ApiSecurity('magic-token')
  @ApiOperation({
    summary: 'Get standup information for a magic token',
    description:
      'Returns standup instance details, team info, member info, and questions for a valid magic token',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Standup information retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        instance: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'standup-instance-123' },
            targetDate: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            state: { type: 'string', example: 'collecting' },
            timeoutAt: { type: 'string', format: 'date-time' },
          },
        },
        team: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'team-123' },
            name: { type: 'string', example: 'Engineering Team' },
          },
        },
        member: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'member-123' },
            name: { type: 'string', example: 'John Doe' },
            platformUserId: { type: 'string', example: 'slack-user-123' },
          },
        },
        questions: {
          type: 'array',
          items: { type: 'string' },
          example: ['What did you work on yesterday?', 'What are you working on today?'],
        },
        hasExistingResponses: { type: 'boolean', example: false },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired magic token',
  })
  async getStandupInfo(
    @MagicToken() tokenPayload: MagicTokenPayload,
  ): Promise<StandupInfoResponse> {
    this.logger.info('Getting standup info for magic token', {
      instanceId: tokenPayload.standupInstanceId,
      teamMemberId: tokenPayload.teamMemberId,
      orgId: tokenPayload.orgId,
    });

    // Get detailed standup information
    const standupInfo = await this.magicTokenService.getStandupInfoForToken(tokenPayload);

    if (!standupInfo) {
      this.logger.error('Failed to retrieve standup info for valid token', {
        instanceId: tokenPayload.standupInstanceId,
        teamMemberId: tokenPayload.teamMemberId,
      });
      throw new Error('Standup information not available');
    }

    // Check if member has existing responses
    const hasExistingResponses = await this.magicTokenService.hasExistingResponses(
      tokenPayload.standupInstanceId,
      tokenPayload.teamMemberId,
    );

    const response: StandupInfoResponse = {
      instance: standupInfo.instance,
      team: standupInfo.team,
      member: standupInfo.member,
      questions: standupInfo.questions,
      hasExistingResponses,
    };

    this.logger.info('Standup info retrieved successfully', {
      instanceId: tokenPayload.standupInstanceId,
      teamMemberId: tokenPayload.teamMemberId,
      questionsCount: standupInfo.questions.length,
      hasExistingResponses,
    });

    return response;
  }

  @Get('validate')
  @UseGuards(MagicTokenGuard)
  @ApiBearerAuth()
  @ApiSecurity('magic-token')
  @ApiOperation({
    summary: 'Validate a magic token',
    description: 'Simple endpoint to validate if a magic token is valid and not expired',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token is valid',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean', example: true },
        tokenInfo: {
          type: 'object',
          properties: {
            standupInstanceId: { type: 'string', example: 'standup-instance-123' },
            teamMemberId: { type: 'string', example: 'member-123' },
            platformUserId: { type: 'string', example: 'slack-user-123' },
            orgId: { type: 'string', example: 'org-123' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired magic token',
  })
  async validateToken(@MagicToken() tokenPayload: MagicTokenPayload) {
    this.logger.info('Magic token validation requested', {
      instanceId: tokenPayload.standupInstanceId,
      teamMemberId: tokenPayload.teamMemberId,
      orgId: tokenPayload.orgId,
    });

    return {
      valid: true,
      tokenInfo: {
        standupInstanceId: tokenPayload.standupInstanceId,
        teamMemberId: tokenPayload.teamMemberId,
        platformUserId: tokenPayload.platformUserId,
        orgId: tokenPayload.orgId,
      },
    };
  }

  @Post('submit')
  @UseGuards(MagicTokenGuard)
  @ApiBearerAuth()
  @ApiSecurity('magic-token')
  @ApiOperation({
    summary: 'Submit standup responses via magic token',
    description:
      'Allows team members to submit their standup responses using a magic token for authentication',
  })
  @ApiBody({
    description: 'Standup answers to submit',
    schema: {
      type: 'object',
      properties: {
        answers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              questionIndex: { type: 'number', example: 0 },
              answer: { type: 'string', example: 'Yesterday I worked on the API endpoints' },
            },
            required: ['questionIndex', 'answer'],
          },
        },
      },
      required: ['answers'],
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Responses submitted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        answersSubmitted: { type: 'number', example: 3 },
        message: {
          type: 'string',
          example: 'Your standup responses have been submitted successfully!',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request data or answers',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired magic token',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      'Responses have already been submitted or standup is no longer accepting responses',
  })
  async submitResponses(
    @MagicToken() tokenPayload: MagicTokenPayload,
    @Body() submitData: { answers: Array<{ questionIndex: number; answer: string }> },
  ) {
    this.logger.info('Web submission request received', {
      instanceId: tokenPayload.standupInstanceId,
      teamMemberId: tokenPayload.teamMemberId,
      answerCount: submitData.answers.length,
    });

    try {
      // Use the existing answer collection service directly with validated payload
      const result = await this.answerCollectionService.submitFullResponse(
        {
          standupInstanceId: tokenPayload.standupInstanceId,
          answers: submitData.answers.map((answer) => ({
            questionIndex: answer.questionIndex,
            text: answer.answer,
          })),
        },
        tokenPayload.teamMemberId,
        tokenPayload.orgId,
      );

      this.logger.info('Web submission completed successfully', {
        instanceId: tokenPayload.standupInstanceId,
        teamMemberId: tokenPayload.teamMemberId,
        answersSubmitted: result.answersSubmitted,
      });

      return {
        success: result.success,
        answersSubmitted: result.answersSubmitted,
        message: 'Your standup responses have been submitted successfully!',
      };
    } catch (error) {
      this.logger.error('Web submission failed', {
        instanceId: tokenPayload.standupInstanceId,
        teamMemberId: tokenPayload.teamMemberId,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof Error) {
        if (error.message.includes('already submitted')) {
          throw new HttpException(
            'You have already submitted your responses for this standup',
            HttpStatus.CONFLICT,
          );
        }
        if (error.message.includes('not collecting')) {
          throw new HttpException(
            'This standup is no longer accepting responses',
            HttpStatus.CONFLICT,
          );
        }
        if (error.message.includes('invalid question index')) {
          throw new HttpException('Invalid question index provided', HttpStatus.BAD_REQUEST);
        }
      }

      throw new HttpException('Failed to submit responses', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
