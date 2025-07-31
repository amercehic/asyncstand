import { Injectable, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { createHmac } from 'crypto';
import { LoggerService } from '@/common/logger.service';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  jitterFactor: number;
}

@Injectable()
export class HttpClientService {
  private readonly client: AxiosInstance;
  private readonly defaultRetryConfig: RetryConfig = {
    maxRetries: 5,
    baseDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    jitterFactor: 0.1,
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(HttpClientService.name);

    this.client = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AsyncStand-SlackBot/1.0',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config) => {
        this.logger.debug('HTTP Request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          headers: this.sanitizeHeaders(config.headers),
        });
        return config;
      },
      (error) => {
        this.logger.error('HTTP Request Error', { error: error.message });
        return Promise.reject(error);
      },
    );

    this.client.interceptors.response.use(
      (response) => {
        this.logger.debug('HTTP Response', {
          status: response.status,
          url: response.config.url,
          responseTime: response.headers['x-response-time'],
        });
        return response;
      },
      (error) => {
        this.logger.error('HTTP Response Error', {
          status: error.response?.status,
          url: error.config?.url,
          error: error.message,
        });
        return Promise.reject(error);
      },
    );
  }

  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'x-asyncsecret', 'x-slack-signature'];

    sensitiveHeaders.forEach((header) => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  async postWithRetry<T = unknown>(
    url: string,
    data: unknown,
    options: AxiosRequestConfig = {},
    retryConfig: Partial<RetryConfig> = {},
  ): Promise<T> {
    const config = { ...this.defaultRetryConfig, ...retryConfig };
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.calculateDelay(attempt, config);
          this.logger.debug(`Retrying request in ${delay}ms`, {
            attempt,
            maxRetries: config.maxRetries,
            url,
          });
          await this.sleep(delay);
        }

        const response: AxiosResponse<T> = await this.client.post(url, data, options);

        if (attempt > 0) {
          this.logger.info('Request succeeded after retries', {
            attempt,
            url,
            status: response.status,
          });
        }

        return response.data;
      } catch (error: unknown) {
        lastError = error as Error;

        // Don't retry on client errors (4xx), only server errors (5xx)
        if (
          (error as { response?: { status?: number } }).response?.status &&
          (error as { response: { status: number } }).response.status < 500
        ) {
          this.logger.warn('Non-retryable error, not retrying', {
            status: (error as { response: { status: number } }).response.status,
            url,
            attempt,
          });
          break;
        }

        this.logger.warn('Request failed, will retry if attempts remain', {
          attempt,
          maxRetries: config.maxRetries,
          status: (error as { response?: { status?: number } }).response?.status,
          error: (error as Error).message,
          url,
        });
      }
    }

    // All retries exhausted
    this.logger.error('All retry attempts exhausted', {
      maxRetries: config.maxRetries,
      url,
      error: lastError.message,
    });

    throw new ApiError(
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      `Request failed after ${config.maxRetries} retries: ${lastError.message}`,
      HttpStatus.BAD_GATEWAY,
    );
  }

  async postWithHmacSignature<T = unknown>(
    url: string,
    data: unknown,
    options: AxiosRequestConfig = {},
    retryConfig: Partial<RetryConfig> = {},
  ): Promise<T> {
    const asyncSecret = this.configService.get<string>('asyncSecret');
    if (!asyncSecret) {
      throw new ApiError(
        ErrorCode.CONFIGURATION_ERROR,
        'AsyncSecret not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Create HMAC signature
    const payload = JSON.stringify(data);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const baseString = `${timestamp}:${payload}`;
    const signature = createHmac('sha256', asyncSecret).update(baseString).digest('hex');

    const signedOptions: AxiosRequestConfig = {
      ...options,
      headers: {
        ...options.headers,
        'X-AsyncSecret': `t=${timestamp},v1=${signature}`,
        'X-Timestamp': timestamp,
      },
    };

    return this.postWithRetry<T>(url, data, signedOptions, retryConfig);
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    // Exponential backoff with jitter
    const exponentialDelay = Math.min(config.baseDelay * Math.pow(2, attempt - 1), config.maxDelay);

    // Add jitter to prevent thundering herd
    const jitter = exponentialDelay * config.jitterFactor * Math.random();

    return Math.floor(exponentialDelay + jitter);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
