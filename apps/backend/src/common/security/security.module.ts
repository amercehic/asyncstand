import { Module } from '@nestjs/common';
import { CsrfService } from '@/common/security/csrf.service';
import { SecurityMonitorService } from '@/common/security/security-monitor.service';
import { DistributedLockService } from '@/common/services/distributed-lock.service';
import { CacheModule } from '@/common/cache/cache.module';
import { LoggerService } from '@/common/logger.service';

@Module({
  imports: [CacheModule],
  providers: [CsrfService, SecurityMonitorService, DistributedLockService, LoggerService],
  exports: [CsrfService, SecurityMonitorService, DistributedLockService],
})
export class SecurityModule {}
