// packages/shared/src/errors.ts
export enum ErrorCode {
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  INTERNAL = 'INTERNAL',
  // extend with app-specific codes…
}

export interface ApiErrorPayload {
  code: ErrorCode;
  message: string;
  details?: unknown;
  requestId?: string;
}
