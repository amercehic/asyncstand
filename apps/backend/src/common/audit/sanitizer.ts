import { Injectable } from '@nestjs/common';
import { AuditSanitizationConfig } from '@/common/audit/config';

@Injectable()
export class AuditSanitizer {
  private readonly MASK_VALUE = '[REDACTED]';
  private readonly PARTIAL_MASK_VALUE = '***';

  constructor(private readonly config: AuditSanitizationConfig) {}

  /**
   * Sanitize an object by removing or masking sensitive fields
   */
  sanitizeObject(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }

    if (typeof obj === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (this.shouldSanitizeField(key)) {
          sanitized[key] = this.maskValue(value);
        } else {
          sanitized[key] = this.sanitizeObject(value);
        }
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Sanitize a string using configured patterns
   */
  private sanitizeString(str: string): string {
    let sanitized = str;
    for (const pattern of this.config.patterns) {
      sanitized = sanitized.replace(pattern, this.PARTIAL_MASK_VALUE);
    }
    return sanitized;
  }

  /**
   * Check if a field should be sanitized based on global field list
   */
  private shouldSanitizeField(fieldName: string): boolean {
    const lowerFieldName = fieldName.toLowerCase();
    return this.config.globalFields.some((field) => lowerFieldName.includes(field.toLowerCase()));
  }

  /**
   * Mask sensitive values while preserving type information
   */
  private maskValue(value: unknown): unknown {
    if (typeof value === 'string') {
      return value.length > 0 ? this.MASK_VALUE : '';
    }
    if (typeof value === 'number') {
      return 0;
    }
    if (typeof value === 'boolean') {
      return false;
    }
    if (Array.isArray(value)) {
      return value.length > 0 ? [this.MASK_VALUE] : [];
    }
    if (typeof value === 'object' && value !== null) {
      return { [this.MASK_VALUE]: this.MASK_VALUE };
    }
    return this.MASK_VALUE;
  }

  /**
   * Sanitize request headers
   */
  sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (this.shouldSanitizeField(key)) {
        sanitized[key] = this.MASK_VALUE;
      } else {
        sanitized[key] = this.sanitizeString(value);
      }
    }
    return sanitized;
  }

  /**
   * Truncate large payloads to prevent storage issues
   */
  truncatePayload(payload: unknown, maxSize: number): unknown {
    if (payload === undefined || payload === null) {
      return payload;
    }

    const serialized = JSON.stringify(payload);
    if (!serialized || serialized.length <= maxSize) {
      return payload;
    }

    const truncated = serialized.substring(0, maxSize - 50); // Leave room for truncation message
    return {
      ...JSON.parse(truncated + '"}'), // Try to close the JSON properly
      _truncated: true,
      _originalSize: serialized.length,
      _maxSize: maxSize,
    };
  }
}
