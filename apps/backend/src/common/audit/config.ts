export interface AuditCaptureConfig {
  requests: boolean;
  responses: boolean;
  headers: string[];
  maxBodySize: number;
}

export interface AuditSanitizationConfig {
  globalFields: string[];
  patterns: RegExp[];
}

export interface AuditRetentionConfig {
  days: number;
  archiveAfterDays?: number;
}

export interface AuditStorageConfig {
  database: boolean;
  elasticsearch?: boolean;
  s3Archive?: boolean;
}

export interface AuditComplianceConfig {
  encryption: boolean;
  tamperDetection: boolean;
  immutable: boolean;
}

export interface AuditConfig {
  enabled: boolean;
  retention: AuditRetentionConfig;
  capture: AuditCaptureConfig;
  sanitization: AuditSanitizationConfig;
  storage: AuditStorageConfig;
  compliance: AuditComplianceConfig;
}

export const DEFAULT_AUDIT_CONFIG: AuditConfig = {
  enabled: true,
  retention: {
    days: 365,
    archiveAfterDays: 90,
  },
  capture: {
    requests: true,
    responses: true,
    headers: ['user-agent', 'x-forwarded-for', 'authorization'],
    maxBodySize: 1024 * 1024, // 1MB
  },
  sanitization: {
    globalFields: [
      'password',
      'passwordHash',
      'token',
      'refreshToken',
      'accessToken',
      'secret',
      'key',
      'authorization',
      'cookie',
      'session',
    ],
    patterns: [
      /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, // Credit card numbers
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email addresses (optional)
      /\b\d{3}-\d{2}-\d{4}\b/g, // SSN format
    ],
  },
  storage: {
    database: true,
    elasticsearch: false,
    s3Archive: false,
  },
  compliance: {
    encryption: false,
    tamperDetection: false,
    immutable: false,
  },
};

export function createAuditConfig(overrides: Partial<AuditConfig> = {}): AuditConfig {
  return {
    ...DEFAULT_AUDIT_CONFIG,
    ...overrides,
    retention: {
      ...DEFAULT_AUDIT_CONFIG.retention,
      ...overrides.retention,
    },
    capture: {
      ...DEFAULT_AUDIT_CONFIG.capture,
      ...overrides.capture,
    },
    sanitization: {
      ...DEFAULT_AUDIT_CONFIG.sanitization,
      ...overrides.sanitization,
      globalFields: [
        ...DEFAULT_AUDIT_CONFIG.sanitization.globalFields,
        ...(overrides.sanitization?.globalFields || []),
      ],
      patterns: [
        ...DEFAULT_AUDIT_CONFIG.sanitization.patterns,
        ...(overrides.sanitization?.patterns || []),
      ],
    },
    storage: {
      ...DEFAULT_AUDIT_CONFIG.storage,
      ...overrides.storage,
    },
    compliance: {
      ...DEFAULT_AUDIT_CONFIG.compliance,
      ...overrides.compliance,
    },
  };
}
