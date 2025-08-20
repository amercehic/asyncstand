import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { LoggerService } from '@/common/logger.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { AuditSanitizer } from '@/common/audit/sanitizer';
import {
  AUDIT_LOG_KEY,
  AUDIT_RESOURCE_KEY,
  AUDITABLE_CONTROLLER_KEY,
  AuditLogMetadata,
  AuditResourceMetadata,
  AuditableControllerMetadata,
  extractValueFromPath,
} from '@/common/audit/decorators';
import { AUDIT_META_KEY, AuditMeta } from '@/common/audit/audit.decorator';
import {
  AuditLogEntry,
  AuditActorType,
  AuditSeverity,
  ResourceAction,
  AuditRequestData,
  AuditCategory,
} from '@/common/audit/types';
import { getClientIp } from '@/common/http/ip.util';
import { AuditConfig } from '@/common/audit/config';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    orgId: string;
    role: string;
  };
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: AuditLogService,
    private readonly sanitizer: AuditSanitizer,
    private readonly logger: LoggerService,
    @Inject('AUDIT_CONFIG') private readonly config: AuditConfig,
  ) {
    this.logger.setContext(AuditInterceptor.name);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.config.enabled) {
      return next.handle();
    }

    const startTime = Date.now();
    const correlationId = uuidv4();
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();

    // Get metadata from method and controller
    const auditMetadata = this.getAuditMetadata(context);
    if (!auditMetadata) {
      return next.handle();
    }

    // Extract user and org information
    const actorUserId = request.user?.userId;
    const orgId = request.user?.orgId || this.extractOrgIdFromRequest(request);

    if (!orgId) {
      this.logger.warn('No orgId found for audit logging', {
        path: request.path,
        method: request.method,
        correlationId,
      });
      return next.handle();
    }

    // Determine if this is the new simplified metadata
    const isSimplifiedMeta =
      'resourcesFromResult' in auditMetadata || 'resourcesFromRequest' in auditMetadata;

    // Create base audit entry
    const auditEntry: Partial<AuditLogEntry> = {
      orgId,
      actorUserId,
      actorType: actorUserId ? AuditActorType.USER : AuditActorType.SYSTEM,
      action: auditMetadata.action,
      category: auditMetadata.category || AuditCategory.DATA_MODIFICATION,
      severity: auditMetadata.severity || AuditSeverity.MEDIUM,
      correlationId,
      tags: (auditMetadata as AuditLogMetadata).tags,
      requestData: this.captureRequestData(request, auditMetadata),
    };

    return next.handle().pipe(
      tap((result) => {
        const executionTime = Date.now() - startTime;

        // Capture response data
        if (auditMetadata.captureResponse !== false && this.config.capture.responses) {
          auditEntry.responseData = {
            statusCode: response.statusCode,
            body: this.sanitizer.sanitizeObject(result) as Record<string, unknown>,
            executionTime,
          };
        }

        // Extract and track resources
        if (isSimplifiedMeta) {
          const simplifiedMeta = auditMetadata as AuditMeta;
          let resources: Array<{ type: string; id?: string; action?: string }> | undefined;

          if (simplifiedMeta.resourcesFromResult) {
            resources = simplifiedMeta.resourcesFromResult(result);
          } else if (simplifiedMeta.resourcesFromRequest) {
            resources = simplifiedMeta.resourcesFromRequest(request);
          } else if (simplifiedMeta.resources) {
            resources = simplifiedMeta.resources;
          }

          // Convert simplified resources to full AuditResourceData format
          if (resources) {
            auditEntry.resources = resources.map((r) => ({
              type: r.type,
              id: r.id || '',
              action: (r.action as ResourceAction) || ResourceAction.ACCESSED,
            }));
          }
        } else {
          auditEntry.resources = this.extractResources(
            context,
            auditMetadata as AuditLogMetadata,
            request,
            result,
          );
        }

        auditEntry.executionTime = executionTime;

        // Log the audit entry asynchronously
        this.logAuditEntry(auditEntry as AuditLogEntry).catch((error) => {
          this.logger.logError(error as Error, {
            context: 'audit logging',
            correlationId,
            action: auditMetadata.action,
          });
        });
      }),
      catchError((error) => {
        const executionTime = Date.now() - startTime;

        // Log failed operations
        auditEntry.responseData = {
          statusCode: response.statusCode || 500,
          body: { error: error.message },
          executionTime,
        };
        auditEntry.executionTime = executionTime;
        auditEntry.severity = AuditSeverity.HIGH; // Upgrade severity for errors

        this.logAuditEntry(auditEntry as AuditLogEntry).catch((logError) => {
          this.logger.logError(logError as Error, {
            context: 'audit logging on error',
            correlationId,
            originalError: error.message,
          });
        });

        return throwError(() => error);
      }),
    );
  }

  private getAuditMetadata(context: ExecutionContext): AuditLogMetadata | AuditMeta | null {
    // Check for new simplified decorator first
    const simplifiedMeta = this.reflector.get<AuditMeta>(AUDIT_META_KEY, context.getHandler());

    if (simplifiedMeta) {
      return simplifiedMeta;
    }

    // Check for method-level metadata (old decorator)
    const methodMetadata = this.reflector.get<AuditLogMetadata>(
      AUDIT_LOG_KEY,
      context.getHandler(),
    );

    if (methodMetadata) {
      return methodMetadata;
    }

    // Check for controller-level auto-logging
    const controllerMetadata = this.reflector.get<AuditableControllerMetadata>(
      AUDITABLE_CONTROLLER_KEY,
      context.getClass(),
    );

    if (controllerMetadata?.autoLog) {
      const methodName = context.getHandler().name;

      // Skip excluded methods
      if (controllerMetadata.excludeMethods?.includes(methodName)) {
        return null;
      }

      // Generate metadata for auto-logged methods
      return {
        action: `${context.getClass().name.toLowerCase().replace('controller', '')}.${methodName}`,
        category: controllerMetadata.defaultCategory,
        severity: controllerMetadata.defaultSeverity || AuditSeverity.LOW,
        captureRequest: true,
        captureResponse: true,
      };
    }

    return null;
  }

  private captureRequestData(
    request: AuthenticatedRequest,
    metadata: AuditLogMetadata | AuditMeta,
  ) {
    const requestData = {
      method: request.method,
      path: request.originalUrl || request.path,
      ipAddress: getClientIp(request),
    };

    const shouldCaptureRequest = metadata.captureRequest !== false && this.config.capture.requests;

    if (shouldCaptureRequest) {
      let body = request.body;

      // Handle redaction for simplified decorator
      if ('redactRequestBodyPaths' in metadata && metadata.redactRequestBodyPaths) {
        body = this.redactPaths(body, metadata.redactRequestBodyPaths);
      }

      const sanitizedBody = this.sanitizer.sanitizeObject(body);
      const sanitizedQuery = this.sanitizer.sanitizeObject(request.query);

      return {
        ...requestData,
        body: this.sanitizer.truncatePayload(sanitizedBody, this.config.capture.maxBodySize),
        query: sanitizedQuery as Record<string, string>,
        headers: this.sanitizer.sanitizeHeaders(this.getSelectedHeaders(request)),
        userAgent: request.get('user-agent'),
      } as AuditRequestData;
    }

    return requestData;
  }

  private redactPaths(body: unknown, paths: string[]): unknown {
    if (!body || !paths?.length) return body;

    const clone = JSON.parse(JSON.stringify(body));
    for (const path of paths) {
      try {
        const segments = path.split('.');
        let current = clone;
        for (let i = 0; i < segments.length - 1; i++) {
          current = current?.[segments[i]];
        }
        const leaf = segments[segments.length - 1];
        if (current && leaf in current) {
          current[leaf] = '[REDACTED]';
        }
      } catch {
        // Ignore errors in path resolution
      }
    }
    return clone;
  }

  private extractResources(
    context: ExecutionContext,
    metadata: AuditLogMetadata,
    request: AuthenticatedRequest,
    result: unknown,
  ) {
    const resources = [];

    // Extract resources from metadata configuration
    if (metadata.resources) {
      for (const resourceConfig of metadata.resources) {
        const resourceId = extractValueFromPath(
          { request: request.body || request.params, result },
          resourceConfig.idFrom,
        );

        if (resourceId && typeof resourceId === 'string') {
          resources.push({
            type: resourceConfig.type,
            id: resourceId,
            action: this.determineResourceAction(request.method),
          });
        }
      }
    }

    // Extract resources from parameter decorators
    const resourceMetadata: AuditResourceMetadata[] =
      this.reflector.get(AUDIT_RESOURCE_KEY, context.getHandler()) || [];

    for (const resource of resourceMetadata) {
      const args = context.getArgs();
      const resourceId = args[resource.parameterIndex];

      if (resourceId && typeof resourceId === 'string') {
        resources.push({
          type: resource.type,
          id: resourceId,
          action: this.determineResourceAction(request.method),
        });
      }
    }

    return resources.length > 0 ? resources : undefined;
  }

  private determineResourceAction(method: string): ResourceAction {
    switch (method.toUpperCase()) {
      case 'POST':
        return ResourceAction.CREATED;
      case 'PUT':
      case 'PATCH':
        return ResourceAction.UPDATED;
      case 'DELETE':
        return ResourceAction.DELETED;
      case 'GET':
      default:
        return ResourceAction.ACCESSED;
    }
  }

  private getSelectedHeaders(request: Request): Record<string, string> {
    const headers: Record<string, string> = {};

    for (const headerName of this.config.capture.headers) {
      const value = request.get(headerName);
      if (value) {
        headers[headerName] = value;
      }
    }

    return headers;
  }

  private extractOrgIdFromRequest(request: AuthenticatedRequest): string | undefined {
    // Try to extract orgId from various sources
    return (request.params?.orgId ||
      request.body?.orgId ||
      request.query?.orgId ||
      request.headers['x-org-id']) as string | undefined;
  }

  private async logAuditEntry(entry: AuditLogEntry): Promise<void> {
    try {
      await this.auditLogService.log(entry);
    } catch (error) {
      // Fallback: log to application logs if audit logging fails
      this.logger.logError(error as Error, {
        context: 'audit log fallback',
        auditEntry: entry,
      });
    }
  }
}
