import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { AuditInterceptor } from '@/common/audit/audit.interceptor';
import { AuditSanitizer } from '@/common/audit/sanitizer';
import { createAuditConfig, DEFAULT_AUDIT_CONFIG } from '@/common/audit/config';
import { LoggerService } from '@/common/logger.service';
import { createLoggerModule } from '@/config/logger.config';

@Global()
@Module({
  imports: [createLoggerModule()],
  providers: [
    LoggerService,
    AuditLogService,
    {
      provide: 'AUDIT_CONFIG',
      useValue: createAuditConfig({
        // Override default config based on environment
        enabled: process.env.AUDIT_ENABLED !== 'false',
        compliance: {
          encryption: ['production', 'staging'].includes(process.env.NODE_ENV || ''),
          tamperDetection: ['production', 'staging'].includes(process.env.NODE_ENV || ''),
          immutable: ['production', 'staging'].includes(process.env.NODE_ENV || ''),
        },
        capture: {
          ...DEFAULT_AUDIT_CONFIG.capture,
          maxBodySize: parseInt(process.env.AUDIT_MAX_BODY_SIZE || '1048576'), // 1MB
        },
      }),
    },
    {
      provide: AuditSanitizer,
      useFactory: (config) => new AuditSanitizer(config.sanitization),
      inject: ['AUDIT_CONFIG'],
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
  exports: [AuditLogService, AuditSanitizer, 'AUDIT_CONFIG'],
})
export class AuditModule {}
