import { SetMetadata } from '@nestjs/common';

export const QUERY_TIMEOUT_KEY = 'query_timeout';

/**
 * Decorator to set query timeout for an endpoint
 */
export const QueryTimeout = (timeoutMs: number) => SetMetadata(QUERY_TIMEOUT_KEY, timeoutMs);
