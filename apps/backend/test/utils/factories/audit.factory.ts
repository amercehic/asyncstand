import { faker } from '@faker-js/faker';
import { AuditCategory, AuditSeverity, AuditActorType } from '@/common/audit/types';

export interface CreateAuditLogOptions {
  id?: string;
  orgId?: string;
  userId?: string;
  action?: string;
  category?: AuditCategory;
  severity?: AuditSeverity;
  actorType?: AuditActorType;
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt?: Date;
}

export class AuditFactory {
  /**
   * Build a single audit log entry
   */
  static build(overrides: CreateAuditLogOptions = {}) {
    return {
      id: overrides.id ?? faker.string.uuid(),
      orgId: overrides.orgId ?? faker.string.uuid(),
      userId: overrides.userId ?? faker.string.uuid(),
      action: overrides.action ?? faker.hacker.verb(),
      category: overrides.category ?? AuditCategory.USER_MANAGEMENT,
      severity: overrides.severity ?? AuditSeverity.LOW,
      actorType: overrides.actorType ?? AuditActorType.USER,
      actorId: overrides.actorId ?? faker.string.uuid(),
      resourceType: overrides.resourceType ?? 'user',
      resourceId: overrides.resourceId ?? faker.string.uuid(),
      details: overrides.details ?? { action: 'test_action' },
      ipAddress: overrides.ipAddress ?? faker.internet.ip(),
      userAgent: overrides.userAgent ?? faker.internet.userAgent(),
      createdAt: overrides.createdAt ?? new Date(),
    };
  }

  /**
   * Build multiple audit log entries
   */
  static buildMany(count: number, overrides: CreateAuditLogOptions = {}) {
    return Array.from({ length: count }, (_, index) =>
      this.build({
        ...overrides,
        action: overrides.action ?? `test_action_${index + 1}`,
      }),
    );
  }

  /**
   * Build audit log for user login
   */
  static buildUserLogin(overrides: Partial<CreateAuditLogOptions> = {}) {
    return this.build({
      ...overrides,
      action: 'user_login',
      category: AuditCategory.AUTH,
      severity: AuditSeverity.LOW,
      resourceType: 'auth_session',
      details: {
        loginMethod: 'email_password',
        success: true,
        ...overrides.details,
      },
    });
  }

  /**
   * Build audit log for user logout
   */
  static buildUserLogout(overrides: Partial<CreateAuditLogOptions> = {}) {
    return this.build({
      ...overrides,
      action: 'user_logout',
      category: AuditCategory.AUTH,
      severity: AuditSeverity.LOW,
      resourceType: 'auth_session',
      details: {
        logoutType: 'manual',
        ...overrides.details,
      },
    });
  }

  /**
   * Build audit log for failed login attempt
   */
  static buildFailedLogin(overrides: Partial<CreateAuditLogOptions> = {}) {
    return this.build({
      ...overrides,
      action: 'login_failed',
      category: AuditCategory.AUTH,
      severity: AuditSeverity.MEDIUM,
      resourceType: 'auth_session',
      details: {
        reason: 'invalid_credentials',
        attempt_count: 1,
        ...overrides.details,
      },
    });
  }

  /**
   * Build audit log for user registration
   */
  static buildUserRegistration(overrides: Partial<CreateAuditLogOptions> = {}) {
    return this.build({
      ...overrides,
      action: 'user_registered',
      category: AuditCategory.USER_MANAGEMENT,
      severity: AuditSeverity.LOW,
      resourceType: 'user',
      details: {
        registrationMethod: 'email_signup',
        emailVerified: false,
        ...overrides.details,
      },
    });
  }

  /**
   * Build audit log for organization creation
   */
  static buildOrganizationCreated(overrides: Partial<CreateAuditLogOptions> = {}) {
    return this.build({
      ...overrides,
      action: 'organization_created',
      category: AuditCategory.USER_MANAGEMENT,
      severity: AuditSeverity.LOW,
      resourceType: 'organization',
      details: {
        organizationName: faker.company.name(),
        initialMemberCount: 1,
        ...overrides.details,
      },
    });
  }

  /**
   * Build audit log for member invitation
   */
  static buildMemberInvited(overrides: Partial<CreateAuditLogOptions> = {}) {
    return this.build({
      ...overrides,
      action: 'member_invited',
      category: AuditCategory.USER_MANAGEMENT,
      severity: AuditSeverity.LOW,
      resourceType: 'org_member',
      details: {
        invitedEmail: faker.internet.email(),
        role: 'member',
        inviteMethod: 'email',
        ...overrides.details,
      },
    });
  }

  /**
   * Build audit log for password reset
   */
  static buildPasswordReset(overrides: Partial<CreateAuditLogOptions> = {}) {
    return this.build({
      ...overrides,
      action: 'password_reset',
      category: AuditCategory.AUTH,
      severity: AuditSeverity.LOW,
      resourceType: 'user',
      details: {
        resetMethod: 'email_link',
        tokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        ...overrides.details,
      },
    });
  }

  /**
   * Build audit log for security events
   */
  static buildSecurityEvent(overrides: Partial<CreateAuditLogOptions> = {}) {
    return this.build({
      ...overrides,
      action: 'security_event',
      category: AuditCategory.SYSTEM,
      severity: AuditSeverity.MEDIUM,
      resourceType: 'security',
      details: {
        eventType: 'suspicious_activity',
        riskLevel: 'medium',
        ...overrides.details,
      },
    });
  }

  /**
   * Build test scenarios for audit logs
   */
  static buildTestScenarios(orgId: string, userId: string) {
    return {
      userLogin: this.buildUserLogin({ orgId, userId }),
      userLogout: this.buildUserLogout({ orgId, userId }),
      failedLogin: this.buildFailedLogin({ orgId, userId }),
      userRegistration: this.buildUserRegistration({ orgId, userId }),
      orgCreated: this.buildOrganizationCreated({ orgId, userId }),
      memberInvited: this.buildMemberInvited({ orgId, userId }),
      passwordReset: this.buildPasswordReset({ orgId, userId }),
      securityEvent: this.buildSecurityEvent({ orgId, userId }),
    };
  }
}
