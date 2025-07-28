import { SetMetadata } from '@nestjs/common';
import { AuditCategory, AuditSeverity } from '@/common/audit/types';

export const AUDIT_LOG_KEY = 'audit_log';
export const AUDIT_RESOURCE_KEY = 'audit_resource';
export const AUDITABLE_CONTROLLER_KEY = 'auditable_controller';

export interface AuditLogMetadata {
  action: string;
  category: AuditCategory;
  severity: AuditSeverity;
  captureRequest?: boolean;
  captureResponse?: boolean;
  sanitizeFields?: string[];
  resources?: AuditResourceConfig[];
  tags?: string[];
  description?: string;
}

export interface AuditResourceConfig {
  type: string;
  idFrom: string; // JSONPath-like string to extract ID from request/response
  captureChanges?: boolean;
}

export interface AuditableControllerMetadata {
  defaultCategory: AuditCategory;
  autoLog?: boolean;
  excludeMethods?: string[];
  defaultSeverity?: AuditSeverity;
}

export interface AuditResourceMetadata {
  type: string;
  parameterIndex: number;
}

/**
 * Decorator to mark methods for automatic audit logging
 *
 * @example
 * @AuditLog({
 *   action: 'user.login',
 *   category: AuditCategory.AUTH,
 *   severity: AuditSeverity.MEDIUM,
 *   captureRequest: true,
 *   captureResponse: true,
 *   sanitizeFields: ['password'],
 *   resources: [{ type: 'user', idFrom: 'result.user.id' }]
 * })
 */
export const AuditLog = (metadata: AuditLogMetadata) => SetMetadata(AUDIT_LOG_KEY, metadata);

/**
 * Decorator to mark controllers for automatic audit logging
 *
 * @example
 * @AuditableController({
 *   defaultCategory: AuditCategory.USER_MANAGEMENT,
 *   autoLog: true,
 *   excludeMethods: ['health', 'metrics']
 * })
 */
export const AuditableController = (metadata: AuditableControllerMetadata) =>
  SetMetadata(AUDITABLE_CONTROLLER_KEY, metadata);

/**
 * Parameter decorator to mark resource parameters for tracking
 *
 * @example
 * async updateUser(
 *   @AuditResource('user') userId: string,
 *   @Body() updateData: UpdateUserDto
 * ) {}
 */
export const AuditResource = (type: string) => {
  return (target: unknown, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    const existingMetadata: AuditResourceMetadata[] =
      Reflect.getMetadata(AUDIT_RESOURCE_KEY, target, propertyKey!) || [];

    existingMetadata.push({ type, parameterIndex });

    Reflect.defineMetadata(AUDIT_RESOURCE_KEY, existingMetadata, target, propertyKey!);
  };
};

/**
 * Utility function to extract a value from an object using a JSONPath-like string
 * Supports simple dot notation like 'user.id', 'result.data.userId', etc.
 */
export function extractValueFromPath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') {
    return undefined;
  }

  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}
