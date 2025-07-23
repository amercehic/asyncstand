// packages/shared/src/errors.ts
export enum ErrorCode {
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  INTERNAL = 'INTERNAL',
  // Auth-specific error codes
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  INVALID_PASSWORD_FORMAT = 'INVALID_PASSWORD_FORMAT',
  ORG_ID_REQUIRED = 'ORG_ID_REQUIRED',
  NO_ACTIVE_ORGANIZATION = 'NO_ACTIVE_ORGANIZATION',
  // extend with app-specific codes…
}

export interface ApiErrorPayload {
  code: ErrorCode;
  message: string;
  details?: unknown;
  requestId?: string;
}
