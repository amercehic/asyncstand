import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const requestId = req.headers['x-request-id'] as string | undefined;

    let apiErr: ApiError;

    if (exception instanceof ApiError) {
      apiErr = exception;
    } else if (exception instanceof HttpException) {
      apiErr = new ApiError(
        ErrorCode.INTERNAL,
        exception.message,
        exception.getStatus(),
        exception.getResponse(),
      );
    } else {
      apiErr = new ApiError(
        ErrorCode.INTERNAL,
        'Unexpected server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const payload = { ...(apiErr.getResponse() as object), requestId };
    res.status(apiErr.getStatus()).json(payload);
  }
}
