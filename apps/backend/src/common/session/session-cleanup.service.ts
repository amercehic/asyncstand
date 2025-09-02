import { Injectable } from '@nestjs/common';
import { LoggerService } from '@/common/logger.service';
import { CsrfService } from '@/common/security/csrf.service';
import {
  ISessionCleaner,
  SessionCleanupResult,
} from '@/common/session/interfaces/session.interface';

@Injectable()
export class SessionCleanupService implements ISessionCleaner {
  constructor(
    private readonly logger: LoggerService,
    private readonly csrfService: CsrfService,
  ) {
    this.logger.setContext(SessionCleanupService.name);
  }

  /**
   * Clean up all session-related data for a single session
   */
  async cleanupSession(sessionId: string): Promise<void> {
    const results = await this.cleanupSessions([sessionId]);
    const result = results[0];

    if (!result.success && result.error) {
      throw new Error(`Session cleanup failed for ${sessionId}: ${result.error}`);
    }
  }

  /**
   * Clean up multiple sessions with detailed results
   */
  async cleanupSessions(sessionIds: string[]): Promise<void> {
    const cleanupPromises = sessionIds.map((sessionId) => this.performSessionCleanup(sessionId));

    const results = await Promise.allSettled(cleanupPromises);

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const failureCount = results.length - successCount;

    this.logger.info('Session cleanup completed', {
      totalSessions: sessionIds.length,
      successful: successCount,
      failed: failureCount,
      sessionIds: sessionIds.map((id) => id.substring(0, 20) + '...'),
    });

    // Log failures for debugging
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.warn('Session cleanup failed', {
          sessionId: sessionIds[index].substring(0, 20) + '...',
          error: result.reason?.message || 'Unknown error',
        });
      }
    });
  }

  /**
   * Perform cleanup for a single session with comprehensive error handling
   */
  private async performSessionCleanup(sessionId: string): Promise<SessionCleanupResult> {
    try {
      // Clean up CSRF tokens and distributed locks
      await this.csrfService.invalidateSession(sessionId);

      // Future: Add other session-related cleanup here
      // - Cache entries
      // - Rate limiting data
      // - Temporary tokens

      this.logger.debug('Session cleanup successful', {
        sessionId: sessionId.substring(0, 20) + '...',
      });

      return {
        sessionId,
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error('Session cleanup failed', {
        sessionId: sessionId.substring(0, 20) + '...',
        error: errorMessage,
      });

      return {
        sessionId,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Clean up expired sessions (can be called by a scheduled job)
   */
  async cleanupExpiredSessions(): Promise<{ cleaned: number; errors: number }> {
    // This would be implemented based on your session storage strategy
    // For now, we delegate to the CSRF service
    const csrfCleanupResult = await this.csrfService.cleanupExpiredTokens();

    this.logger.info('Expired sessions cleanup completed', {
      cleaned: csrfCleanupResult.cleaned,
      errors: csrfCleanupResult.errors,
    });

    return csrfCleanupResult;
  }
}
