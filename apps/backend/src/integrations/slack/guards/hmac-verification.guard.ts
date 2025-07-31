import { Injectable, CanActivate, ExecutionContext, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { LoggerService } from '@/common/logger.service';

@Injectable()
export class HmacVerificationGuard implements CanActivate {
  private readonly maxTimestamp = 5 * 60; // 5 minutes

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(HmacVerificationGuard.name);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    try {
      this.verifyHmacSignature(request);
      return true;
    } catch (error) {
      this.logger.warn('HMAC verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: request.path,
        headers: this.sanitizeHeaders(request.headers),
      });

      throw error;
    }
  }

  private verifyHmacSignature(request: Request): void {
    const asyncSecret = this.configService.get<string>('asyncSecret');
    if (!asyncSecret) {
      throw new ApiError(
        ErrorCode.CONFIGURATION_ERROR,
        'AsyncSecret not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const signature = request.headers['x-asyncsecret'] as string;
    const timestamp = request.headers['x-timestamp'] as string;

    if (!signature || !timestamp) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        'Missing HMAC signature headers',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Parse signature header: "t=timestamp,v1=signature"
    const signatureParts = this.parseSignatureHeader(signature);
    if (!signatureParts.timestamp || !signatureParts.signature) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        'Invalid signature format',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Verify timestamp to prevent replay attacks
    const currentTime = Math.floor(Date.now() / 1000);
    const requestTime = parseInt(signatureParts.timestamp, 10);

    if (Math.abs(currentTime - requestTime) > this.maxTimestamp) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        'Request timestamp too old',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Verify signature
    const body = request.body ? JSON.stringify(request.body) : '';
    const baseString = `${signatureParts.timestamp}:${body}`;
    const computedSignature = createHmac('sha256', asyncSecret).update(baseString).digest('hex');

    if (!this.isValidSignature(signatureParts.signature, computedSignature)) {
      throw new ApiError(
        ErrorCode.UNAUTHENTICATED,
        'Invalid HMAC signature',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  private parseSignatureHeader(signature: string): {
    timestamp: string | null;
    signature: string | null;
  } {
    try {
      const parts = signature.split(',');
      let timestamp: string | null = null;
      let sig: string | null = null;

      for (const part of parts) {
        const [key, value] = part.split('=');
        if (key === 't') {
          timestamp = value;
        } else if (key === 'v1') {
          sig = value;
        }
      }

      return { timestamp, signature: sig };
    } catch {
      return { timestamp: null, signature: null };
    }
  }

  private isValidSignature(received: string, computed: string): boolean {
    try {
      return timingSafeEqual(Buffer.from(received), Buffer.from(computed));
    } catch {
      return false;
    }
  }

  private sanitizeHeaders(headers: Record<string, unknown>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const sensitiveHeaders = ['x-asyncsecret', 'authorization'];

    Object.entries(headers).forEach(([key, value]) => {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = String(value);
      }
    });

    return sanitized;
  }
}
