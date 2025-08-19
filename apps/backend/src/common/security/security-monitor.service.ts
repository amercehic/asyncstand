import { Injectable, OnModuleInit } from '@nestjs/common';
import { LoggerService } from '@/common/logger.service';
import { CacheService } from '@/common/cache/cache.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { AuditActorType, AuditCategory, AuditSeverity } from '@/common/audit/types';
import {
  SecurityEventType,
  SecurityEventSeverity,
  SecurityEventStatus,
  SecurityEventMetadata,
  SecurityAlert,
  SECURITY_EVENT_RISK_MATRIX,
} from '@/common/security/security-events.enum';

interface SecurityMetrics {
  totalEvents: number;
  eventsByType: Record<SecurityEventType, number>;
  eventsBySeverity: Record<SecurityEventSeverity, number>;
  alertsGenerated: number;
  activeAlerts: number;
  averageRiskScore: number;
  topRiskyIps: Array<{ ip: string; riskScore: number; events: number }>;
  topRiskyUsers: Array<{ userId: string; riskScore: number; events: number }>;
}
import { randomUUID } from 'crypto';

interface AlertingRule {
  id: string;
  name: string;
  eventType: SecurityEventType;
  threshold: number;
  timeWindow: number; // in seconds
  severity: SecurityEventSeverity;
  enabled: boolean;
  action: 'log' | 'alert' | 'block' | 'escalate';
}

@Injectable()
export class SecurityMonitorService implements OnModuleInit {
  private alertingRules: AlertingRule[] = [];
  private activeAlerts = new Map<string, SecurityAlert>();

  constructor(
    private readonly logger: LoggerService,
    private readonly cacheService: CacheService,
    private readonly auditLogService: AuditLogService,
  ) {
    this.logger.setContext(SecurityMonitorService.name);
  }

  async onModuleInit() {
    await this.initializeAlertingRules();
    this.logger.info('Security monitoring service initialized');
  }

  /**
   * Log a security event and potentially trigger alerts
   */
  async logSecurityEvent(
    type: SecurityEventType,
    metadata: SecurityEventMetadata,
    customSeverity?: SecurityEventSeverity,
  ): Promise<void> {
    const eventId = randomUUID();

    // Calculate risk score and severity
    const riskInfo = this.calculateRiskScore(type, metadata, customSeverity);

    // Enhanced metadata with risk information
    const enhancedMetadata: SecurityEventMetadata = {
      ...metadata,
      riskScore: riskInfo.riskScore,
      confidence: riskInfo.confidence,
      correlationId: metadata.correlationId || randomUUID(),
    };

    // Log the security event
    this.logger.warn('Security event detected', {
      eventId,
      type,
      severity: riskInfo.severity,
      riskScore: riskInfo.riskScore,
      ...enhancedMetadata,
    });

    // Store in audit log
    await this.auditLogService.log({
      orgId: metadata.organizationId || 'system',
      actorUserId: metadata.userId,
      actorType: AuditActorType.SYSTEM,
      action: 'security_event_logged',
      category: AuditCategory.SYSTEM,
      severity: this.mapSeverityToAuditSeverity(riskInfo.severity),
      requestData: {
        method: 'SECURITY_EVENT',
        path: '/security/event',
        ipAddress: metadata.ipAddress || 'unknown',
      },
      payload: enhancedMetadata as unknown as Record<string, unknown>,
    });

    // Update event counters and risk scores
    await Promise.all([
      this.updateEventCounters(type, riskInfo.severity, metadata),
      this.updateRiskScores(metadata),
      this.checkAlertingRules(type, enhancedMetadata),
    ]);

    // Handle critical events immediately
    if (riskInfo.severity === SecurityEventSeverity.CRITICAL) {
      await this.handleCriticalEvent(type, enhancedMetadata);
    }
  }

  /**
   * Create a security alert
   */
  async createAlert(
    type: SecurityEventType,
    metadata: SecurityEventMetadata,
    severity: SecurityEventSeverity,
    title?: string,
    description?: string,
  ): Promise<SecurityAlert> {
    const alertId = randomUUID();
    const now = new Date();

    const alert: SecurityAlert = {
      id: alertId,
      type,
      severity,
      status: SecurityEventStatus.ACTIVE,
      title: title || this.generateAlertTitle(type, metadata),
      description: description || this.generateAlertDescription(type, metadata),
      metadata,
      createdAt: now,
      updatedAt: now,
      occurrences: 1,
      firstSeenAt: now,
      lastSeenAt: now,
      autoResolved: false,
      actionsTaken: [],
      recommendations: this.generateRecommendations(type),
    };

    // Store alert
    this.activeAlerts.set(alertId, alert);
    await this.cacheService.set(
      this.cacheService.buildKey('security-alert', alertId),
      alert,
      86400, // 24 hours
    );

    // Log alert creation
    this.logger.error('Security alert created', {
      alertId,
      type,
      severity,
      title: alert.title,
      riskScore: metadata.riskScore,
      userId: metadata.userId,
      ipAddress: metadata.ipAddress,
    });

    return alert;
  }

  /**
   * Get current security metrics
   */
  async getSecurityMetrics(
    timeRange: '1h' | '24h' | '7d' | '30d' = '24h',
  ): Promise<SecurityMetrics> {
    // This would typically query a time-series database
    // For now, return cached aggregated metrics
    const cacheKey = this.cacheService.buildKey('security-metrics', timeRange);
    const cached = await this.cacheService.get<SecurityMetrics>(cacheKey);

    if (cached) {
      return cached;
    }

    // Calculate metrics (placeholder implementation)
    const metrics: SecurityMetrics = {
      totalEvents: 0,
      eventsByType: {} as Record<SecurityEventType, number>,
      eventsBySeverity: {} as Record<SecurityEventSeverity, number>,
      alertsGenerated: this.activeAlerts.size,
      activeAlerts: Array.from(this.activeAlerts.values()).filter(
        (alert) => alert.status === SecurityEventStatus.ACTIVE,
      ).length,
      averageRiskScore: 0,
      topRiskyIps: [],
      topRiskyUsers: [],
    };

    // Cache metrics for 5 minutes
    await this.cacheService.set(cacheKey, metrics, 300);
    return metrics;
  }

  /**
   * Get active security alerts
   */
  async getActiveAlerts(
    severity?: SecurityEventSeverity,
    limit = 50,
    offset = 0,
  ): Promise<{ alerts: SecurityAlert[]; total: number }> {
    const alerts = Array.from(this.activeAlerts.values())
      .filter(
        (alert) =>
          alert.status === SecurityEventStatus.ACTIVE && (!severity || alert.severity === severity),
      )
      .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
      .slice(offset, offset + limit);

    return {
      alerts,
      total: this.activeAlerts.size,
    };
  }

  /**
   * Resolve a security alert
   */
  async resolveAlert(alertId: string, resolvedBy: string, resolution: string): Promise<boolean> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.status = SecurityEventStatus.RESOLVED;
    alert.resolvedAt = new Date();
    alert.resolvedBy = resolvedBy;
    alert.updatedAt = new Date();
    alert.actionsTaken.push(`Resolved: ${resolution}`);

    // Update stored alert
    await this.cacheService.set(
      this.cacheService.buildKey('security-alert', alertId),
      alert,
      86400,
    );

    this.logger.info('Security alert resolved', {
      alertId,
      resolvedBy,
      resolution,
      type: alert.type,
    });

    return true;
  }

  /**
   * Calculate risk score for an event
   */
  private calculateRiskScore(
    type: SecurityEventType,
    metadata: SecurityEventMetadata,
    customSeverity?: SecurityEventSeverity,
  ): { riskScore: number; severity: SecurityEventSeverity; confidence: number } {
    const baseConfig = SECURITY_EVENT_RISK_MATRIX[type];
    let riskScore = baseConfig.baseRiskScore;
    let severity = customSeverity || baseConfig.baseSeverity;
    let confidence = 85; // Base confidence

    // Adjust risk score based on various factors
    if (metadata.userId) {
      // Known user - slightly lower risk
      riskScore *= 0.9;
      confidence += 5;
    }

    // Frequency-based adjustment
    if (
      metadata.payload?.frequency &&
      typeof metadata.payload.frequency === 'number' &&
      metadata.payload.frequency > 1
    ) {
      const frequencyMultiplier = Math.min(2.0, 1 + (metadata.payload.frequency - 1) * 0.2);
      riskScore *= frequencyMultiplier;
      confidence += 10;
    }

    // Geographic risk (if available)
    if (metadata.geolocation?.country) {
      // This would check against a list of high-risk countries
      // For now, just a placeholder
      const isHighRiskCountry = ['XX'].includes(metadata.geolocation.country);
      if (isHighRiskCountry) {
        riskScore *= 1.3;
        confidence -= 5;
      }
    }

    // Time-based risk (unusual hours)
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      // Outside normal business hours
      riskScore *= 1.1;
    }

    // User agent analysis
    if (metadata.userAgent) {
      const isSuspiciousUserAgent = this.analyzeSuspiciousUserAgent(metadata.userAgent);
      if (isSuspiciousUserAgent) {
        riskScore *= 1.4;
        confidence += 15;
      }
    }

    // Ensure score stays within bounds
    riskScore = Math.max(0, Math.min(100, riskScore));
    confidence = Math.max(0, Math.min(100, confidence));

    // Adjust severity based on final risk score
    if (riskScore >= 80) {
      severity = SecurityEventSeverity.CRITICAL;
    } else if (riskScore >= 60) {
      severity = SecurityEventSeverity.HIGH;
    } else if (riskScore >= 30) {
      severity = SecurityEventSeverity.MEDIUM;
    } else {
      severity = SecurityEventSeverity.LOW;
    }

    return { riskScore, severity, confidence };
  }

  /**
   * Check alerting rules for a security event
   */
  private async checkAlertingRules(
    type: SecurityEventType,
    metadata: SecurityEventMetadata,
  ): Promise<void> {
    const applicableRules = this.alertingRules.filter(
      (rule) => rule.enabled && rule.eventType === type,
    );

    for (const rule of applicableRules) {
      const key = this.buildRuleKey(rule, metadata);
      const count = await this.cacheService.increment(key, rule.timeWindow);

      if (count >= rule.threshold) {
        await this.executeRuleAction(rule, metadata, count);

        // Reset counter after triggering
        await this.cacheService.del(key);
      }
    }
  }

  /**
   * Execute action for a triggered alerting rule
   */
  private async executeRuleAction(
    rule: AlertingRule,
    metadata: SecurityEventMetadata,
    eventCount: number,
  ): Promise<void> {
    switch (rule.action) {
      case 'alert':
        await this.createAlert(
          rule.eventType,
          metadata,
          rule.severity,
          `Security Rule Triggered: ${rule.name}`,
          `${eventCount} events of type ${rule.eventType} detected within ${rule.timeWindow} seconds`,
        );
        break;

      case 'block':
        await this.blockSuspiciousActor(metadata);
        break;

      case 'escalate':
        await this.escalateToSecurityTeam(rule, metadata, eventCount);
        break;

      case 'log':
      default:
        this.logger.warn('Security rule triggered', {
          rule: rule.name,
          eventType: rule.eventType,
          count: eventCount,
          metadata,
        });
        break;
    }
  }

  /**
   * Initialize default alerting rules
   */
  private async initializeAlertingRules(): Promise<void> {
    this.alertingRules = [
      {
        id: 'failed-login-burst',
        name: 'Failed Login Burst',
        eventType: SecurityEventType.FAILED_LOGIN,
        threshold: 5,
        timeWindow: 300, // 5 minutes
        severity: SecurityEventSeverity.MEDIUM,
        enabled: true,
        action: 'alert',
      },
      {
        id: 'rate-limit-exceeded',
        name: 'Rate Limit Exceeded',
        eventType: SecurityEventType.RATE_LIMIT_EXCEEDED,
        threshold: 3,
        timeWindow: 60, // 1 minute
        severity: SecurityEventSeverity.HIGH,
        enabled: true,
        action: 'block',
      },
      {
        id: 'malicious-input-detected',
        name: 'Malicious Input Detection',
        eventType: SecurityEventType.MALICIOUS_INPUT_DETECTED,
        threshold: 1,
        timeWindow: 60,
        severity: SecurityEventSeverity.CRITICAL,
        enabled: true,
        action: 'escalate',
      },
      {
        id: 'unauthorized-access',
        name: 'Unauthorized Access Attempts',
        eventType: SecurityEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
        threshold: 2,
        timeWindow: 300,
        severity: SecurityEventSeverity.HIGH,
        enabled: true,
        action: 'alert',
      },
    ];
  }

  /**
   * Helper methods
   */
  private buildRuleKey(rule: AlertingRule, metadata: SecurityEventMetadata): string {
    const identifier = metadata.userId || metadata.ipAddress;
    return this.cacheService.buildKey('security-rule', rule.id, identifier);
  }

  private mapSeverityToAuditSeverity(severity: SecurityEventSeverity): AuditSeverity {
    const mapping = {
      [SecurityEventSeverity.LOW]: AuditSeverity.LOW,
      [SecurityEventSeverity.MEDIUM]: AuditSeverity.MEDIUM,
      [SecurityEventSeverity.HIGH]: AuditSeverity.HIGH,
      [SecurityEventSeverity.CRITICAL]: AuditSeverity.CRITICAL,
    };
    return mapping[severity];
  }

  private analyzeSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [/curl/i, /wget/i, /python/i, /bot/i, /scanner/i, /crawler/i, /^$/];

    return suspiciousPatterns.some((pattern) => pattern.test(userAgent));
  }

  private generateAlertTitle(type: SecurityEventType, metadata: SecurityEventMetadata): string {
    const baseTitle = type
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase());

    if (metadata.userId) {
      return `${baseTitle} - User ${metadata.userId}`;
    } else if (metadata.ipAddress) {
      return `${baseTitle} - IP ${metadata.ipAddress}`;
    }

    return baseTitle;
  }

  private generateAlertDescription(
    type: SecurityEventType,
    metadata: SecurityEventMetadata,
  ): string {
    return `Security event of type ${type} detected with risk score ${metadata.riskScore || 'unknown'}`;
  }

  private generateRecommendations(type: SecurityEventType): string[] {
    const recommendations: string[] = [];

    switch (type) {
      case SecurityEventType.FAILED_LOGIN:
        recommendations.push('Consider implementing account lockout policy');
        recommendations.push('Review and strengthen password policies');
        break;
      case SecurityEventType.RATE_LIMIT_EXCEEDED:
        recommendations.push('Implement IP-based blocking for repeated violations');
        recommendations.push('Review and adjust rate limiting thresholds');
        break;
      case SecurityEventType.MALICIOUS_INPUT_DETECTED:
        recommendations.push('Block the source IP immediately');
        recommendations.push('Review input validation and sanitization');
        break;
    }

    return recommendations;
  }

  private async updateEventCounters(
    type: SecurityEventType,
    severity: SecurityEventSeverity,
    metadata: SecurityEventMetadata,
  ): Promise<void> {
    const promises = [
      this.cacheService.increment(`security-events:total`, 3600),
      this.cacheService.increment(`security-events:type:${type}`, 3600),
      this.cacheService.increment(`security-events:severity:${severity}`, 3600),
    ];

    if (metadata.userId) {
      promises.push(this.cacheService.increment(`security-events:user:${metadata.userId}`, 3600));
    }

    if (metadata.ipAddress) {
      promises.push(this.cacheService.increment(`security-events:ip:${metadata.ipAddress}`, 3600));
    }

    await Promise.all(promises);
  }

  private async updateRiskScores(metadata: SecurityEventMetadata): Promise<void> {
    if (!metadata.riskScore) return;

    const promises = [];

    if (metadata.userId) {
      const userRiskKey = this.cacheService.buildKey('risk-score', 'user', metadata.userId);
      promises.push(this.updateRiskScore(userRiskKey, metadata.riskScore));
    }

    if (metadata.ipAddress) {
      const ipRiskKey = this.cacheService.buildKey('risk-score', 'ip', metadata.ipAddress);
      promises.push(this.updateRiskScore(ipRiskKey, metadata.riskScore));
    }

    await Promise.all(promises);
  }

  private async updateRiskScore(key: string, newScore: number): Promise<void> {
    const current = (await this.cacheService.get<{ score: number; count: number }>(key)) || {
      score: 0,
      count: 0,
    };

    // Calculate weighted average
    const totalScore = current.score * current.count + newScore;
    const newCount = current.count + 1;
    const averageScore = totalScore / newCount;

    await this.cacheService.set(key, { score: averageScore, count: newCount }, 3600);
  }

  private async handleCriticalEvent(
    type: SecurityEventType,
    metadata: SecurityEventMetadata,
  ): Promise<void> {
    // Create immediate alert
    await this.createAlert(
      type,
      metadata,
      SecurityEventSeverity.CRITICAL,
      `CRITICAL SECURITY EVENT: ${type}`,
      'Immediate attention required for critical security event',
    );

    // Additional critical event handling would go here
    // e.g., automated blocking, notifications to security team, etc.
  }

  private async blockSuspiciousActor(metadata: SecurityEventMetadata): Promise<void> {
    if (metadata.ipAddress) {
      const blockKey = this.cacheService.buildKey('blocked-ip', metadata.ipAddress);
      await this.cacheService.set(blockKey, true, 3600); // Block for 1 hour

      this.logger.warn('IP address blocked due to security event', {
        ipAddress: metadata.ipAddress,
        userId: metadata.userId,
      });
    }
  }

  private async escalateToSecurityTeam(
    rule: AlertingRule,
    metadata: SecurityEventMetadata,
    eventCount: number,
  ): Promise<void> {
    // This would integrate with external alerting systems
    // For now, just log the escalation
    this.logger.error('Security event escalated to security team', {
      rule: rule.name,
      eventCount,
      metadata,
      severity: SecurityEventSeverity.CRITICAL,
    });
  }
}
