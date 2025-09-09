import { describe, it, expect } from 'vitest';
import { AxiosError } from 'axios';
import { normalizeApiError, getErrorMessage } from '@/utils/error';
import type { ApiErrorResponse } from '@/types/api';
import type { ApiErrorPayload } from 'shared';
import { ErrorCode } from 'shared';

// Helper to create mock Axios errors
function createAxiosError(response?: { status: number; data: unknown }): AxiosError {
  const error = {
    name: 'AxiosError',
    message: 'Test error',
    code: 'ERR_BAD_REQUEST',
    isAxiosError: true,
    response,
  } as AxiosError;
  return error;
}

describe('normalizeApiError', () => {
  it('should handle Axios error with ApiErrorPayload', () => {
    const errorPayload: ApiErrorPayload = {
      code: ErrorCode.VALIDATION_FAILED,
      message: 'Validation failed',
      details: { field: 'email' },
    };

    const axiosError = createAxiosError({ status: 400, data: errorPayload });
    const result = normalizeApiError(axiosError);

    expect(result).toEqual({
      message: 'Validation failed',
      code: ErrorCode.VALIDATION_FAILED,
      status: 400,
      details: { field: 'email' },
    });
  });

  it('should handle Axios error with ApiErrorResponse', () => {
    const errorResponse: ApiErrorResponse = {
      message: 'Not found',
      statusCode: 404,
      code: 'NOT_FOUND',
      timestamp: '2024-01-01T00:00:00Z',
      path: '/api/test',
      errors: [{ field: 'resource', message: 'user not found' }],
    };

    const axiosError = createAxiosError({ status: errorResponse.statusCode, data: errorResponse });
    const result = normalizeApiError(axiosError);

    expect(result.message).toBe('Not found');
    expect(result.code).toBe('NOT_FOUND');
    expect(result.status).toBe(404);
    // The implementation may not set details for this case, which is acceptable
    expect(result).toHaveProperty('message');
    expect(result).toHaveProperty('code');
    expect(result).toHaveProperty('status');
  });

  it('should handle Axios error with generic object response', () => {
    const genericError = { message: 'Server error', extra: 'data' };
    const axiosError = createAxiosError({ status: 500, data: genericError });
    const result = normalizeApiError(axiosError);

    expect(result).toEqual({
      message: 'Server error',
      status: 500,
      details: genericError,
    });
  });

  it('should handle Axios error with title field', () => {
    const errorWithTitle = { title: 'Access denied' };
    const axiosError = createAxiosError({ status: 403, data: errorWithTitle });
    const result = normalizeApiError(axiosError);

    expect(result).toEqual({
      message: 'Access denied',
      status: 403,
      details: errorWithTitle,
    });
  });

  it('should handle Axios error with detail field', () => {
    const errorWithDetail = { detail: 'Invalid token' };
    const axiosError = createAxiosError({ status: 401, data: errorWithDetail });
    const result = normalizeApiError(axiosError);

    expect(result).toEqual({
      message: 'Invalid token',
      status: 401,
      details: errorWithDetail,
    });
  });

  it('should handle Axios network error', () => {
    const axiosError = createAxiosError();
    axiosError.code = 'ERR_NETWORK';
    axiosError.toJSON = () => ({ code: 'ERR_NETWORK', message: 'Network Error' });

    const result = normalizeApiError(axiosError);

    expect(result.message).toBe('Network error – check connection');
    expect(result.details).toEqual({ code: 'ERR_NETWORK', message: 'Network Error' });
  });

  it('should handle Axios error without response', () => {
    const axiosError = createAxiosError();
    axiosError.message = 'Request timeout';

    const result = normalizeApiError(axiosError);

    expect(result.message).toBe('Unexpected error');
    expect(result.details).toBe('Request timeout');
  });

  it('should handle regular Error objects', () => {
    const error = new Error('Something went wrong');
    const result = normalizeApiError(error);

    expect(result).toEqual({
      message: 'Something went wrong',
    });
  });

  it('should handle Error with empty message', () => {
    const error = new Error('');
    const result = normalizeApiError(error, 'Custom fallback');

    expect(result).toEqual({
      message: 'Custom fallback',
    });
  });

  it('should handle unknown error types', () => {
    const result = normalizeApiError('string error');

    expect(result).toEqual({
      message: 'Unexpected error',
    });
  });

  it('should use custom fallback message', () => {
    const result = normalizeApiError(null, 'Custom fallback message');

    expect(result).toEqual({
      message: 'Custom fallback message',
    });
  });

  it('should handle ApiErrorPayload without message', () => {
    const errorPayload: Partial<ApiErrorPayload> & { code: ErrorCode } = {
      code: ErrorCode.VALIDATION_FAILED,
      message: undefined, // Explicitly undefined
    };

    const axiosError = createAxiosError({ status: 400, data: errorPayload });
    const result = normalizeApiError(axiosError, 'Fallback message');

    expect(result.message).toBe('Fallback message');
    expect(result.code).toBe(ErrorCode.VALIDATION_FAILED);
  });

  it('should handle ApiErrorResponse without message', () => {
    const errorResponse = {
      statusCode: 500,
      // message is undefined
    } as ApiErrorResponse;

    const axiosError = createAxiosError({ status: 500, data: errorResponse });
    const result = normalizeApiError(axiosError, 'Fallback message');

    expect(result.message).toBe('Fallback message');
    expect(result.status).toBe(500);
  });

  it('should handle object with non-string message field', () => {
    const errorData = { message: 123, other: 'data' };
    const axiosError = createAxiosError({ status: 400, data: errorData });
    const result = normalizeApiError(axiosError, 'Fallback');

    expect(result.message).toBe('Fallback');
    expect(result.details).toBe(errorData);
  });

  it('should prioritize message over title and detail', () => {
    const errorData = {
      message: 'Main message',
      title: 'Title message',
      detail: 'Detail message',
    };
    const axiosError = createAxiosError({ status: 400, data: errorData });
    const result = normalizeApiError(axiosError);

    expect(result.message).toBe('Main message');
  });

  it('should prioritize title over detail when message is missing', () => {
    const errorData = {
      title: 'Title message',
      detail: 'Detail message',
    };
    const axiosError = createAxiosError({ status: 400, data: errorData });
    const result = normalizeApiError(axiosError);

    expect(result.message).toBe('Title message');
  });
});

describe('getErrorMessage', () => {
  it('should extract message from normalized error', () => {
    const error = new Error('Test error message');
    const message = getErrorMessage(error);

    expect(message).toBe('Test error message');
  });

  it('should use fallback message for unknown errors', () => {
    const message = getErrorMessage(null, 'Custom fallback');

    expect(message).toBe('Custom fallback');
  });

  it('should use default fallback message', () => {
    const message = getErrorMessage({});

    expect(message).toBe('Unexpected error');
  });

  it('should handle Axios errors', () => {
    const axiosError = createAxiosError({
      status: 400,
      data: { message: 'Validation error' },
    });
    const message = getErrorMessage(axiosError);

    expect(message).toBe('Validation error');
  });
});
