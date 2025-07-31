import { Injectable, NestMiddleware, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { LoggerService } from '@/common/logger.service';

@Injectable()
export class SlackSignatureMiddleware implements NestMiddleware {
  private readonly version = 'v0';
  private readonly maxTimestamp = 5 * 60; // 5 minutes

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(SlackSignatureMiddleware.name);
  }

  use(req: Request, res: Response, next: NextFunction): void {
    try {
      this.verifySlackSignature(req);
      next();
    } catch (error) {
      this.logger.warn('Slack signature verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: req.path,
        timestamp: req.headers['x-slack-request-timestamp'],
      });

      if (error instanceof ApiError) {
        res.status(error.getStatus()).json({
          code: (error.getResponse() as any)?.code,
          message: error.message,
        });
      } else {
        res.status(HttpStatus.UNAUTHORIZED).json({
          code: ErrorCode.UNAUTHENTICATED,
          message: 'Invalid Slack signature',
        });
      }
    }
  }

  private verifySlackSignature(req: Request): void {
    const signingSecret = this.configService.get<string>('slackSigningSecret');
    if (!signingSecret) {
      throw new ApiError(
        ErrorCode.CONFIGURATION_ERROR,
        'Slack signing secret not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const slackSignature = req.headers['x-slack-signature'] as string;
    const slackTimestamp = req.headers['x-slack-request-timestamp'] as string;

    if (!slackSignature || !slackTimestamp) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        'Missing Slack signature headers',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Verify timestamp to prevent replay attacks
    const currentTime = Math.floor(Date.now() / 1000);
    const requestTime = parseInt(slackTimestamp, 10);

    if (isNaN(requestTime) || Math.abs(currentTime - requestTime) > this.maxTimestamp) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        'Request timestamp too old',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Verify signature
    const body = req.body ? JSON.stringify(req.body) : '';
    const baseString = `${this.version}:${slackTimestamp}:${body}`;
    const computedSignature = `${this.version}=${createHmac('sha256', signingSecret)
      .update(baseString)
      .digest('hex')}`;

    if (!this.isValidSignature(slackSignature, computedSignature)) {
      throw new ApiError(
        ErrorCode.UNAUTHENTICATED,
        'Invalid Slack signature',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  private isValidSignature(received: string, computed: string): boolean {
    try {
      return timingSafeEqual(Buffer.from(received), Buffer.from(computed));
    } catch {
      return false;
    }
  }
}
