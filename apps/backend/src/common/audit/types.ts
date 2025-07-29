export enum AuditActorType {
  USER = 'user',
  SYSTEM = 'system',
  API_KEY = 'api_key',
  SERVICE = 'service',
}

export enum AuditCategory {
  AUTH = 'auth',
  USER_MANAGEMENT = 'user_management',
  DATA_MODIFICATION = 'data_modification',
  SYSTEM = 'system',
  INTEGRATION = 'integration',
  BILLING = 'billing',
}

export enum AuditSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ResourceAction {
  CREATED = 'created',
  UPDATED = 'updated',
  DELETED = 'deleted',
  ACCESSED = 'accessed',
}

export interface AuditRequestData {
  method: string;
  path: string;
  body?: unknown;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  userAgent?: string;
  ipAddress: string;
}

export interface AuditResponseData {
  statusCode: number;
  body?: Record<string, unknown>;
  executionTime: number;
}

export interface AuditResourceData {
  type: string;
  id: string;
  action: ResourceAction;
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}

export interface AuditLogEntry {
  // Core identification
  orgId?: string;
  actorUserId?: string;
  actorType: AuditActorType;

  // Event classification
  action: string;
  category: AuditCategory;
  severity: AuditSeverity;

  // Request context
  requestData: AuditRequestData;

  // Response context
  responseData?: AuditResponseData;

  // Resource tracking
  resources?: AuditResourceData[];

  // Metadata
  sessionId?: string;
  correlationId?: string;
  tags?: string[];
  executionTime?: number;

  // Legacy compatibility
  payload?: Record<string, unknown>;
}

export interface AuditLogFilter {
  orgId: string;
  actorUserId?: string;
  category?: AuditCategory;
  severity?: AuditSeverity;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  fromDate?: Date;
  toDate?: Date;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface ActivitySummary {
  totalEvents: number;
  eventsByCategory: Record<AuditCategory, number>;
  eventsBySeverity: Record<AuditSeverity, number>;
  topUsers: Array<{
    userId: string;
    userName?: string;
    eventCount: number;
  }>;
  timeRange: {
    from: Date;
    to: Date;
  };
}

export interface SecurityEvent {
  id: string;
  type: 'failed_login' | 'password_reset' | 'suspicious_activity' | 'privilege_escalation';
  severity: AuditSeverity;
  description: string;
  actorUserId?: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
}
