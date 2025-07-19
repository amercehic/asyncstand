import { HttpException, HttpStatus } from '@nestjs/common';
import { ApiErrorPayload, ErrorCode } from 'shared';

export class ApiError extends HttpException {
  constructor(
    code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: unknown,
  ) {
    super(<ApiErrorPayload>{ code, message, details }, status);
  }
}
