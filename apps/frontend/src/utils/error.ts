import { isAxiosError } from 'axios';
import type { AxiosError } from 'axios';
import type { ApiErrorResponse } from '@/types/api';
import type { ApiErrorPayload, ErrorCode } from 'shared';

export interface NormalizedApiError {
  message: string;
  code?: ErrorCode | string;
  status?: number;
  details?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasStringProp<T extends string>(obj: unknown, key: T): obj is Record<T, string> {
  return isRecord(obj) && typeof (obj as Record<string, unknown>)[key] === 'string';
}

function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  return isRecord(value) && 'code' in value && 'message' in value;
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return (
    isRecord(value) &&
    'message' in value &&
    'statusCode' in value &&
    typeof (value as { message: unknown }).message === 'string' &&
    typeof (value as { statusCode: unknown }).statusCode === 'number'
  );
}

export function normalizeApiError(
  error: unknown,
  fallbackMessage = 'Unexpected error'
): NormalizedApiError {
  // Axios errors with server response
  if (isAxiosError(error)) {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    const data = axiosError.response?.data as unknown;

    if (isApiErrorPayload(data)) {
      return {
        message: data.message ?? fallbackMessage,
        code: data.code,
        status,
        details: data.details,
      };
    }

    if (isApiErrorResponse(data)) {
      return {
        message: data.message ?? fallbackMessage,
        code: data.code,
        status: data.statusCode,
        details: data.errors ?? data,
      };
    }

    if (isRecord(data)) {
      const message =
        (hasStringProp(data, 'message') && data.message) ||
        (hasStringProp(data, 'title') && data.title) ||
        (hasStringProp(data, 'detail') && data.detail) ||
        fallbackMessage;

      return { message, status, details: data };
    }

    const message =
      axiosError.code === 'ERR_NETWORK' ? 'Network error – check connection' : fallbackMessage;
    return { message, status, details: axiosError.toJSON?.() ?? axiosError.message };
  }

  // Non-Axios errors
  if (error instanceof Error) {
    return { message: error.message || fallbackMessage };
  }

  return { message: fallbackMessage };
}

export function getErrorMessage(error: unknown, fallbackMessage = 'Unexpected error'): string {
  return normalizeApiError(error, fallbackMessage).message;
}
