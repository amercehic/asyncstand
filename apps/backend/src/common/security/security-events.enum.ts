export enum SecurityEventType {
  // Authentication Events
  FAILED_LOGIN = 'failed_login',
  SUCCESSFUL_LOGIN = 'successful_login',
  ACCOUNT_LOCKED = 'account_locked',
  ACCOUNT_UNLOCKED = 'account_unlocked',
  PASSWORD_CHANGED = 'password_changed',
  PASSWORD_RESET_REQUESTED = 'password_reset_requested',
  PASSWORD_RESET_COMPLETED = 'password_reset_completed',

  // Authorization Events
  UNAUTHORIZED_ACCESS_ATTEMPT = 'unauthorized_access_attempt',
  PRIVILEGE_ESCALATION_ATTEMPT = 'privilege_escalation_attempt',
  ROLE_CHANGED = 'role_changed',
  PERMISSION_DENIED = 'permission_denied',

  // Rate Limiting Events
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  RATE_LIMIT_WARNING = 'rate_limit_warning',
  IP_BANNED = 'ip_banned',
  IP_UNBANNED = 'ip_unbanned',

  // CSRF Protection Events
  INVALID_CSRF_TOKEN = 'invalid_csrf_token',
  MISSING_CSRF_TOKEN = 'missing_csrf_token',
  CSRF_TOKEN_REUSE = 'csrf_token_reuse',

  // Input Validation Events
  MALICIOUS_INPUT_DETECTED = 'malicious_input_detected',
  XSS_ATTEMPT = 'xss_attempt',
  SQL_INJECTION_ATTEMPT = 'sql_injection_attempt',
  SCRIPT_INJECTION_ATTEMPT = 'script_injection_attempt',

  // Session Management Events
  SESSION_HIJACK_ATTEMPT = 'session_hijack_attempt',
  CONCURRENT_SESSIONS_DETECTED = 'concurrent_sessions_detected',
  SESSION_EXPIRED = 'session_expired',
  SESSION_CREATED = 'session_created',
  SESSION_DESTROYED = 'session_destroyed',

  // Suspicious Activity
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  UNUSUAL_LOCATION_LOGIN = 'unusual_location_login',
  UNUSUAL_TIME_LOGIN = 'unusual_time_login',
  UNUSUAL_USER_AGENT = 'unusual_user_agent',
  RAPID_REQUEST_PATTERN = 'rapid_request_pattern',

  // Data Protection Events
  SENSITIVE_DATA_ACCESS = 'sensitive_data_access',
  DATA_EXPORT_ATTEMPT = 'data_export_attempt',
  BULK_DATA_ACCESS = 'bulk_data_access',

  // Integration Security Events
  API_KEY_MISUSE = 'api_key_misuse',
  WEBHOOK_SECURITY_VIOLATION = 'webhook_security_violation',
  INTEGRATION_ABUSE = 'integration_abuse',

  // System Security Events
  SECURITY_CONFIG_CHANGED = 'security_config_changed',
  SECURITY_ALERT_TRIGGERED = 'security_alert_triggered',
  SECURITY_SCAN_DETECTED = 'security_scan_detected',

  // Administrative Events
  ADMIN_ACTION_PERFORMED = 'admin_action_performed',
  SECURITY_POLICY_VIOLATION = 'security_policy_violation',
  COMPLIANCE_VIOLATION = 'compliance_violation',
}

export enum SecurityEventSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum SecurityEventStatus {
  ACTIVE = 'active',
  RESOLVED = 'resolved',
  INVESTIGATING = 'investigating',
  FALSE_POSITIVE = 'false_positive',
}

export interface SecurityEventMetadata {
  // Request Information
  method?: string;
  endpoint?: string;
  userAgent?: string;
  ipAddress: string;
  referrer?: string;

  // User Information
  userId?: string;
  organizationId?: string;
  sessionId?: string;
  email?: string;

  // Technical Details
  correlationId?: string;
  fingerprint?: string;
  geolocation?: {
    country?: string;
    region?: string;
    city?: string;
    coordinates?: [number, number];
  };

  // Event-Specific Data
  payload?: Record<string, unknown>;
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;

  // Risk Assessment
  riskScore?: number; // 0-100
  confidence?: number; // 0-100

  // Response Information
  responseTime?: number;
  statusCode?: number;

  // Additional Context
  tags?: string[];
  source?: string; // Which component detected the event
  detectionRules?: string[];
}

export interface SecurityAlert {
  id: string;
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  status: SecurityEventStatus;
  title: string;
  description: string;
  metadata: SecurityEventMetadata;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;

  // Aggregation
  occurrences: number;
  firstSeenAt: Date;
  lastSeenAt: Date;

  // Response
  autoResolved: boolean;
  actionsTaken: string[];
  recommendations: string[];
}

export const SECURITY_EVENT_SEVERITY_SCORES: Record<SecurityEventSeverity, number> = {
  [SecurityEventSeverity.LOW]: 25,
  [SecurityEventSeverity.MEDIUM]: 50,
  [SecurityEventSeverity.HIGH]: 75,
  [SecurityEventSeverity.CRITICAL]: 100,
};

export const SECURITY_EVENT_RISK_MATRIX: Record<
  SecurityEventType,
  {
    baseSeverity: SecurityEventSeverity;
    baseRiskScore: number;
    autoEscalate?: boolean;
    requiresImmedateAction?: boolean;
  }
> = {
  [SecurityEventType.FAILED_LOGIN]: {
    baseSeverity: SecurityEventSeverity.LOW,
    baseRiskScore: 10,
  },
  [SecurityEventType.SUCCESSFUL_LOGIN]: {
    baseSeverity: SecurityEventSeverity.LOW,
    baseRiskScore: 5,
  },
  [SecurityEventType.ACCOUNT_LOCKED]: {
    baseSeverity: SecurityEventSeverity.MEDIUM,
    baseRiskScore: 40,
  },
  [SecurityEventType.UNAUTHORIZED_ACCESS_ATTEMPT]: {
    baseSeverity: SecurityEventSeverity.HIGH,
    baseRiskScore: 70,
    autoEscalate: true,
  },
  [SecurityEventType.PRIVILEGE_ESCALATION_ATTEMPT]: {
    baseSeverity: SecurityEventSeverity.CRITICAL,
    baseRiskScore: 90,
    autoEscalate: true,
    requiresImmedateAction: true,
  },
  [SecurityEventType.RATE_LIMIT_EXCEEDED]: {
    baseSeverity: SecurityEventSeverity.MEDIUM,
    baseRiskScore: 30,
  },
  [SecurityEventType.INVALID_CSRF_TOKEN]: {
    baseSeverity: SecurityEventSeverity.HIGH,
    baseRiskScore: 60,
  },
  [SecurityEventType.MALICIOUS_INPUT_DETECTED]: {
    baseSeverity: SecurityEventSeverity.HIGH,
    baseRiskScore: 75,
    autoEscalate: true,
  },
  [SecurityEventType.XSS_ATTEMPT]: {
    baseSeverity: SecurityEventSeverity.HIGH,
    baseRiskScore: 80,
    autoEscalate: true,
  },
  [SecurityEventType.SQL_INJECTION_ATTEMPT]: {
    baseSeverity: SecurityEventSeverity.CRITICAL,
    baseRiskScore: 95,
    autoEscalate: true,
    requiresImmedateAction: true,
  },
  [SecurityEventType.SESSION_HIJACK_ATTEMPT]: {
    baseSeverity: SecurityEventSeverity.CRITICAL,
    baseRiskScore: 85,
    autoEscalate: true,
    requiresImmedateAction: true,
  },
  [SecurityEventType.SUSPICIOUS_ACTIVITY]: {
    baseSeverity: SecurityEventSeverity.MEDIUM,
    baseRiskScore: 45,
  },
  [SecurityEventType.UNUSUAL_LOCATION_LOGIN]: {
    baseSeverity: SecurityEventSeverity.MEDIUM,
    baseRiskScore: 35,
  },
  [SecurityEventType.SENSITIVE_DATA_ACCESS]: {
    baseSeverity: SecurityEventSeverity.MEDIUM,
    baseRiskScore: 50,
  },
  [SecurityEventType.BULK_DATA_ACCESS]: {
    baseSeverity: SecurityEventSeverity.HIGH,
    baseRiskScore: 70,
  },
  [SecurityEventType.API_KEY_MISUSE]: {
    baseSeverity: SecurityEventSeverity.HIGH,
    baseRiskScore: 65,
  },
  [SecurityEventType.SECURITY_SCAN_DETECTED]: {
    baseSeverity: SecurityEventSeverity.MEDIUM,
    baseRiskScore: 55,
  },
  [SecurityEventType.ADMIN_ACTION_PERFORMED]: {
    baseSeverity: SecurityEventSeverity.LOW,
    baseRiskScore: 20,
  },
  [SecurityEventType.SECURITY_POLICY_VIOLATION]: {
    baseSeverity: SecurityEventSeverity.HIGH,
    baseRiskScore: 75,
    autoEscalate: true,
  },

  // Add default entries for all other event types
  [SecurityEventType.PASSWORD_CHANGED]: {
    baseSeverity: SecurityEventSeverity.LOW,
    baseRiskScore: 15,
  },
  [SecurityEventType.PASSWORD_RESET_REQUESTED]: {
    baseSeverity: SecurityEventSeverity.LOW,
    baseRiskScore: 20,
  },
  [SecurityEventType.PASSWORD_RESET_COMPLETED]: {
    baseSeverity: SecurityEventSeverity.LOW,
    baseRiskScore: 25,
  },
  [SecurityEventType.ACCOUNT_UNLOCKED]: {
    baseSeverity: SecurityEventSeverity.LOW,
    baseRiskScore: 15,
  },
  [SecurityEventType.ROLE_CHANGED]: {
    baseSeverity: SecurityEventSeverity.MEDIUM,
    baseRiskScore: 40,
  },
  [SecurityEventType.PERMISSION_DENIED]: {
    baseSeverity: SecurityEventSeverity.LOW,
    baseRiskScore: 15,
  },
  [SecurityEventType.RATE_LIMIT_WARNING]: {
    baseSeverity: SecurityEventSeverity.LOW,
    baseRiskScore: 20,
  },
  [SecurityEventType.IP_BANNED]: { baseSeverity: SecurityEventSeverity.MEDIUM, baseRiskScore: 45 },
  [SecurityEventType.IP_UNBANNED]: { baseSeverity: SecurityEventSeverity.LOW, baseRiskScore: 15 },
  [SecurityEventType.MISSING_CSRF_TOKEN]: {
    baseSeverity: SecurityEventSeverity.MEDIUM,
    baseRiskScore: 40,
  },
  [SecurityEventType.CSRF_TOKEN_REUSE]: {
    baseSeverity: SecurityEventSeverity.HIGH,
    baseRiskScore: 70,
  },
  [SecurityEventType.SCRIPT_INJECTION_ATTEMPT]: {
    baseSeverity: SecurityEventSeverity.HIGH,
    baseRiskScore: 80,
  },
  [SecurityEventType.CONCURRENT_SESSIONS_DETECTED]: {
    baseSeverity: SecurityEventSeverity.MEDIUM,
    baseRiskScore: 35,
  },
  [SecurityEventType.SESSION_EXPIRED]: {
    baseSeverity: SecurityEventSeverity.LOW,
    baseRiskScore: 5,
  },
  [SecurityEventType.SESSION_CREATED]: {
    baseSeverity: SecurityEventSeverity.LOW,
    baseRiskScore: 5,
  },
  [SecurityEventType.SESSION_DESTROYED]: {
    baseSeverity: SecurityEventSeverity.LOW,
    baseRiskScore: 5,
  },
  [SecurityEventType.UNUSUAL_TIME_LOGIN]: {
    baseSeverity: SecurityEventSeverity.LOW,
    baseRiskScore: 25,
  },
  [SecurityEventType.UNUSUAL_USER_AGENT]: {
    baseSeverity: SecurityEventSeverity.LOW,
    baseRiskScore: 30,
  },
  [SecurityEventType.RAPID_REQUEST_PATTERN]: {
    baseSeverity: SecurityEventSeverity.MEDIUM,
    baseRiskScore: 40,
  },
  [SecurityEventType.DATA_EXPORT_ATTEMPT]: {
    baseSeverity: SecurityEventSeverity.MEDIUM,
    baseRiskScore: 55,
  },
  [SecurityEventType.WEBHOOK_SECURITY_VIOLATION]: {
    baseSeverity: SecurityEventSeverity.HIGH,
    baseRiskScore: 60,
  },
  [SecurityEventType.INTEGRATION_ABUSE]: {
    baseSeverity: SecurityEventSeverity.MEDIUM,
    baseRiskScore: 50,
  },
  [SecurityEventType.SECURITY_CONFIG_CHANGED]: {
    baseSeverity: SecurityEventSeverity.MEDIUM,
    baseRiskScore: 45,
  },
  [SecurityEventType.SECURITY_ALERT_TRIGGERED]: {
    baseSeverity: SecurityEventSeverity.MEDIUM,
    baseRiskScore: 50,
  },
  [SecurityEventType.COMPLIANCE_VIOLATION]: {
    baseSeverity: SecurityEventSeverity.HIGH,
    baseRiskScore: 70,
  },
};
