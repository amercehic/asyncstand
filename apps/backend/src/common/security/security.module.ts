import { Module } from '@nestjs/common';
import { CsrfService } from '@/common/security/csrf.service';
import { SecurityMonitorService } from '@/common/security/security-monitor.service';
import { CacheModule } from '@/common/cache/cache.module';
import { LoggerService } from '@/common/logger.service';

@Module({
  imports: [CacheModule],
  providers: [CsrfService, SecurityMonitorService, LoggerService],
  exports: [CsrfService, SecurityMonitorService],
})
export class SecurityModule {}
