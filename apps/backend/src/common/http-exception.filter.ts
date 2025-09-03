import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';

/**
 * Response body from HttpException
 */
interface ExceptionResponseBody {
  message?: string | string[];
  code?: ErrorCode;
  [key: string]: unknown;
}

/**
 * Error with cause property
 */
interface ErrorWithCause extends Error {
  cause?: unknown;
}

/**
 * RFC 7807 compliant Problem Details object augmented with domain-specific fields.
 */
export interface ProblemJson {
  /** URI that identifies the error type (stable, documentation-friendly). */
  type?: string;
  /** Short, human-readable summary. */
  title: string;
  /** HTTP status code. */
  status: number;
  /** Long description / debugging info (omit in prod). */
  detail?: string;
  /** The specific request path that generated the error. */
  instance?: string;
  /** Your domain error code (machine-friendly). */
  code: ErrorCode;
  /** Correlates logs and traces. */
  requestId?: string;
  /** Server timestamp. */
  timestamp: string;
  /** Arbitrary structured data (validation errors, etc.). */
  extras?: unknown;
}

/** Map HTTP -> domain codes. Extend as needed. */
const STATUS_TO_CODE: Record<number, ErrorCode> = {
  400: ErrorCode.VALIDATION_FAILED,
  401: ErrorCode.UNAUTHENTICATED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  409: ErrorCode.CONFLICT,
  // Everything else falls back to INTERNAL
};

const SAFE_HEADER_KEYS = ['user-agent', 'accept', 'content-type'];
const SENSITIVE_HEADER_KEYS = ['authorization', 'cookie', 'x-api-key'];

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  private readonly isProd = process.env.NODE_ENV === 'production';
  private readonly errorTypeBase = process.env.ERROR_TYPE_BASE || 'about:blank';

  constructor() {}

  catch(exception: unknown, host: ArgumentsHost) {
    // Only handle HTTP context here. If you also support RPC/WS, branch accordingly.
    if (host.getType() !== 'http') return;

    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    if (res.headersSent) return; // avoid double-send

    const requestId = (req.headers['x-request-id'] as string) ?? undefined;
    const timestamp = new Date().toISOString();
    const path = (req as Request & { originalUrl?: string }).originalUrl ?? req.url;

    // 1) Normalize to ApiError
    const apiErr = this.toApiError(exception);
    const status = apiErr.getStatus?.() ?? HttpStatus.INTERNAL_SERVER_ERROR;

    // 2) Extract / normalize pieces from ApiError / HttpException
    const rawResponse = apiErr.getResponse?.() as unknown;
    const code = this.extractCode(rawResponse, status);
    const extras = this.normalizeExtras(rawResponse);

    const baseBody: ProblemJson = {
      type: this.errorTypeBase === 'about:blank' ? undefined : `${this.errorTypeBase}/${code}`,
      title: apiErr.message,
      status,
      detail: this.isProd ? undefined : this.stringifyForDev(exception),
      instance: path,
      code,
      requestId,
      timestamp,
      extras,
    };

    const body = omitUndefined(baseBody);

    // 3) Log with full details (always)
    const serialized = this.serializeError(exception);
    // Pass stack as second arg so Nest prints it in pretty mode, and include structured context as third arg
    this.logger.error(
      'Unhandled exception',
      typeof (exception as Error)?.stack === 'string' ? (exception as Error).stack : undefined,
      {
        requestId,
        method: req.method,
        url: path,
        headers: sanitizeHeaders(req.headers),
        ip: (req as Request & { ip?: string }).ip ?? req.socket?.remoteAddress,
        exception: serialized,
      },
    );

    // 4) Send RFC7807 response
    res.status(status).type('application/problem+json').json(body);
  }

  /** Convert any thrown value to an ApiError instance. */
  private toApiError(exception: unknown): ApiError {
    if (exception instanceof ApiError) return exception;

    if (exception instanceof HttpException) {
      const status = exception.getStatus?.() ?? HttpStatus.INTERNAL_SERVER_ERROR;
      const code = STATUS_TO_CODE[status] ?? ErrorCode.INTERNAL;

      // Prefer the response body message/title when available
      const responseBody = exception.getResponse?.();
      let message = exception.message;
      if (typeof responseBody === 'object' && responseBody && 'message' in responseBody) {
        const msg = (responseBody as ExceptionResponseBody).message;
        message = Array.isArray(msg) ? msg.join(', ') : String(msg);
      }

      return new ApiError(code, message, status, responseBody);
    }

    // Fallback
    return new ApiError(
      ErrorCode.INTERNAL,
      this.isProd ? 'Unexpected server error' : this.stringifyForDev(exception),
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  /** Extract domain code from an HttpException/ApiError payload or fallback mapping. */
  private extractCode(payload: unknown, status: number): ErrorCode {
    if (payload && typeof payload === 'object' && 'code' in payload) {
      return (payload as ExceptionResponseBody).code as ErrorCode;
    }

    // Check if it's a validation error from NestJS ValidationPipe
    if (status === 400 && payload && typeof payload === 'object' && 'message' in payload) {
      const message = (payload as ExceptionResponseBody).message;
      if (
        Array.isArray(message) ||
        (typeof message === 'string' && message.includes('validation'))
      ) {
        return ErrorCode.VALIDATION_FAILED;
      }
    }

    return STATUS_TO_CODE[status] ?? ErrorCode.INTERNAL;
  }

  /**
   * Normalize extras (validation errors etc.). Avoid echoing already-included payloads.
   */
  private normalizeExtras(response: unknown): unknown {
    if (response == null) return undefined;
    if (typeof response === 'string') return undefined; // Already surfaced in title/detail

    // ApiError payload already has code/message/etc. Don't duplicate
    if (typeof response === 'object' && 'code' in response && 'message' in response) {
      return undefined;
    }

    // Flatten class-validator errors if detected
    if (Array.isArray(response) && response.every(isClassValidatorError)) {
      return response.map((e) => ({
        property: e.property,
        constraints: e.constraints,
        value: e.value,
        children: e.children?.length ? e.children : undefined,
      }));
    }

    return response;
  }

  /** Serialize any error-like object safely. */
  private serializeError(err: unknown) {
    if (err instanceof Error) {
      return {
        name: err.name,
        message: err.message,
        stack: err.stack,
        constructor: err.constructor?.name,
        cause: this.serializeCause((err as ErrorWithCause).cause),
      };
    }
    return { message: String(err), type: typeof err };
  }

  private serializeCause(cause: unknown): unknown {
    if (!cause) return undefined;
    if (cause instanceof Error) {
      return {
        name: cause.name,
        message: cause.message,
        stack: cause.stack,
      };
    }
    return cause;
  }

  private stringifyForDev(exception: unknown): string {
    try {
      return this.safeStringify(exception);
    } catch {
      return String(exception);
    }
  }

  private safeStringify(obj: unknown): string {
    const cache = new Set();
    return JSON.stringify(
      obj,
      (_k, v) => {
        if (typeof v === 'object' && v !== null) {
          if (cache.has(v)) return '[Circular]';
          cache.add(v);
        }
        return v;
      },
      2,
    );
  }
}

/**
 * Helpers
 */
function omitUndefined<T>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k of Object.keys(obj as object) as Array<keyof T>) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

function sanitizeHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const k of SAFE_HEADER_KEYS) {
    if (headers[k]) out[k] = headers[k] as string | string[];
  }
  for (const k of SENSITIVE_HEADER_KEYS) {
    if (headers[k]) out[k] = '[REDACTED]';
  }
  return out;
}

interface ClassValidatorErrorLike {
  property: string;
  constraints?: Record<string, string>;
  children?: ClassValidatorErrorLike[];
  value?: unknown;
}

function isClassValidatorError(v: unknown): v is ClassValidatorErrorLike {
  return (
    v !== null &&
    typeof v === 'object' &&
    'property' in v &&
    ('constraints' in v || 'children' in v)
  );
}

// Optional: re-export for testing
export const __test__ = {
  omitUndefined,
  sanitizeHeaders,
  isClassValidatorError,
};
