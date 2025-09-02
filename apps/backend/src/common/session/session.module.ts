import { Module, forwardRef } from '@nestjs/common';
import { SessionIdentifierService } from '@/common/session/session-identifier.service';
import { SessionCleanupService } from '@/common/session/session-cleanup.service';
import { LoggerService } from '@/common/logger.service';
import { SecurityModule } from '@/common/security/security.module';

@Module({
  imports: [forwardRef(() => SecurityModule)],
  providers: [SessionIdentifierService, SessionCleanupService, LoggerService],
  exports: [SessionIdentifierService, SessionCleanupService],
})
export class SessionModule {}
