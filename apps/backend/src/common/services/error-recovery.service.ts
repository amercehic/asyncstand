import { Injectable } from '@nestjs/common';
import { LoggerService } from '@/common/logger.service';

interface RetryOptions {
  maxAttempts: number;
  delayMs: number;
  exponentialBackoff?: boolean;
  retryOn?: (error: Error) => boolean;
}

interface CircuitBreakerOptions {
  failureThreshold: number;
  timeout: number;
  monitoringPeriod: number;
}

interface CircuitState {
  failures: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

@Injectable()
export class ErrorRecoveryService {
  private readonly circuitBreakers = new Map<string, CircuitState>();
  private readonly defaultRetryOptions: RetryOptions = {
    maxAttempts: 3,
    delayMs: 1000,
    exponentialBackoff: true,
    retryOn: (error: Error) => {
      // Retry on network errors, timeouts, and 5xx status codes
      return (
        error.message.includes('timeout') ||
        error.message.includes('ECONNRESET') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('5') // Simple 5xx detection
      );
    },
  };

  constructor(private readonly logger: LoggerService) {
    this.logger.setContext(ErrorRecoveryService.name);
  }

  /**
   * Execute operation with retry logic
   */
  async withRetry<T>(operation: () => Promise<T>, options: Partial<RetryOptions> = {}): Promise<T> {
    const finalOptions = { ...this.defaultRetryOptions, ...options };
    let lastError: Error;

    for (let attempt = 1; attempt <= finalOptions.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Check if we should retry this error
        if (!finalOptions.retryOn || !finalOptions.retryOn(lastError)) {
          this.logger.warn('Error not retryable', {
            error: lastError.message,
            attempt,
          });
          throw lastError;
        }

        // Don't delay on the last attempt
        if (attempt < finalOptions.maxAttempts) {
          const delay = finalOptions.exponentialBackoff
            ? finalOptions.delayMs * Math.pow(2, attempt - 1)
            : finalOptions.delayMs;

          this.logger.warn('Operation failed, retrying', {
            error: lastError.message,
            attempt,
            maxAttempts: finalOptions.maxAttempts,
            nextRetryIn: delay,
          });

          await this.sleep(delay);
        }
      }
    }

    this.logger.error('Operation failed after all retry attempts', {
      error: lastError!.message,
      attempts: finalOptions.maxAttempts,
    });

    throw lastError!;
  }

  /**
   * Execute operation with circuit breaker pattern
   */
  async withCircuitBreaker<T>(
    key: string,
    operation: () => Promise<T>,
    options: Partial<CircuitBreakerOptions> = {},
  ): Promise<T> {
    const finalOptions: CircuitBreakerOptions = {
      failureThreshold: 5,
      timeout: 60000, // 1 minute
      monitoringPeriod: 30000, // 30 seconds
      ...options,
    };

    const circuit = this.getOrCreateCircuit(key, finalOptions);
    const now = Date.now();

    // Check circuit state
    if (circuit.state === 'OPEN') {
      if (now - circuit.lastFailureTime < finalOptions.timeout) {
        throw new Error(`Circuit breaker ${key} is OPEN`);
      } else {
        // Try half-open
        circuit.state = 'HALF_OPEN';
        this.logger.info('Circuit breaker transitioning to HALF_OPEN', { key });
      }
    }

    try {
      const result = await operation();

      // Success - reset circuit if it was half-open
      if (circuit.state === 'HALF_OPEN') {
        circuit.state = 'CLOSED';
        circuit.failures = 0;
        this.logger.info('Circuit breaker reset to CLOSED', { key });
      }

      return result;
    } catch (error) {
      circuit.failures += 1;
      circuit.lastFailureTime = now;

      if (circuit.failures >= finalOptions.failureThreshold) {
        circuit.state = 'OPEN';
        this.logger.error('Circuit breaker opened', {
          key,
          failures: circuit.failures,
          threshold: finalOptions.failureThreshold,
        });
      }

      throw error;
    }
  }

  /**
   * Execute multiple operations with proper error handling
   */
  async executeAllSettled<T>(
    operations: Array<() => Promise<T>>,
    options: { logErrors?: boolean } = {},
  ): Promise<Array<{ status: 'fulfilled' | 'rejected'; value?: T; reason?: Error }>> {
    const results = await Promise.allSettled(operations.map((op) => op()));

    const formattedResults = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return { status: 'fulfilled' as const, value: result.value };
      } else {
        const error = result.reason as Error;
        if (options?.logErrors !== false) {
          this.logger.error('Operation failed in batch execution', {
            operationIndex: index,
            error: error.message,
            stack: error.stack,
          });
        }
        return { status: 'rejected' as const, reason: error };
      }
    });

    const failures = formattedResults.filter((r) => r.status === 'rejected').length;
    if (failures > 0) {
      this.logger.warn('Batch operation completed with failures', {
        total: operations.length,
        failures,
        successRate: ((operations.length - failures) / operations.length) * 100,
      });
    }

    return formattedResults;
  }

  /**
   * Safe cache invalidation with error recovery
   */
  async safeCacheInvalidation(
    cacheOperations: Array<() => Promise<void>>,
    options: {
      continueOnError?: boolean;
      maxParallel?: number;
    } = {},
  ): Promise<void> {
    const finalOptions = {
      continueOnError: true,
      maxParallel: 5,
      ...options,
    };

    const executeInBatches = async (operations: Array<() => Promise<void>>, batchSize: number) => {
      for (let i = 0; i < operations.length; i += batchSize) {
        const batch = operations.slice(i, i + batchSize);

        if (finalOptions.continueOnError) {
          await this.executeAllSettled(batch, { logErrors: true });
        } else {
          await Promise.all(batch.map((op) => op()));
        }
      }
    };

    try {
      await executeInBatches(cacheOperations, finalOptions.maxParallel);
    } catch (error) {
      this.logger.error('Critical error in cache invalidation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        operationCount: cacheOperations.length,
      });

      if (!finalOptions.continueOnError) {
        throw error;
      }
    }
  }

  /**
   * Get circuit breaker status for monitoring
   */
  getCircuitBreakerStatus(key: string): CircuitState | null {
    return this.circuitBreakers.get(key) || null;
  }

  /**
   * Get all circuit breaker statuses
   */
  getAllCircuitBreakers(): Record<string, CircuitState> {
    const result: Record<string, CircuitState> = {};
    this.circuitBreakers.forEach((state, key) => {
      result[key] = state;
    });
    return result;
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(key: string): boolean {
    const circuit = this.circuitBreakers.get(key);
    if (circuit) {
      circuit.state = 'CLOSED';
      circuit.failures = 0;
      circuit.lastFailureTime = 0;
      this.logger.info('Circuit breaker manually reset', { key });
      return true;
    }
    return false;
  }

  private getOrCreateCircuit(key: string, _options: CircuitBreakerOptions): CircuitState {
    if (!this.circuitBreakers.has(key)) {
      this.circuitBreakers.set(key, {
        failures: 0,
        lastFailureTime: 0,
        state: 'CLOSED',
      });
    }
    return this.circuitBreakers.get(key)!;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
