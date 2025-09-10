import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { type Flags } from '@/features/zero-flicker.service';

export interface FlagsUpdateEvent {
  userId?: string;
  orgId?: string;
  flags: Flags;
  timestamp: Date;
  source: 'admin' | 'webhook' | 'scheduled' | 'manual';
}

@Injectable()
export class FlagsStreamService {
  private readonly logger = new Logger(FlagsStreamService.name);
  private readonly updatesSubject = new Subject<FlagsUpdateEvent>();

  /**
   * Push a flags update to all relevant subscribers
   */
  pushUpdate(event: FlagsUpdateEvent): void {
    this.logger.debug(`Broadcasting flags update for org ${event.orgId}`, {
      source: event.source,
      flagCount: Object.keys(event.flags).length,
    });

    this.updatesSubject.next({
      ...event,
      timestamp: new Date(),
    });
  }

  /**
   * Get updates stream for a specific user/org
   */
  getUpdatesForUser(userId: string, orgId: string): Observable<Flags> {
    return this.updatesSubject.pipe(
      filter((event) => {
        // Send to specific user if userId matches, or to all users in org if no userId specified
        return (event.userId === userId || !event.userId) && event.orgId === orgId;
      }),
      map((event) => event.flags),
    );
  }

  /**
   * Get updates stream for an entire organization
   */
  getUpdatesForOrg(orgId: string): Observable<FlagsUpdateEvent> {
    return this.updatesSubject.pipe(filter((event) => event.orgId === orgId));
  }

  /**
   * Push update for specific user
   */
  pushUserUpdate(
    userId: string,
    orgId: string,
    flags: Flags,
    source: FlagsUpdateEvent['source'] = 'manual',
  ): void {
    this.pushUpdate({
      userId,
      orgId,
      flags,
      source,
      timestamp: new Date(),
    });
  }

  /**
   * Push update for entire organization
   */
  pushOrgUpdate(orgId: string, flags: Flags, source: FlagsUpdateEvent['source'] = 'admin'): void {
    this.pushUpdate({
      orgId,
      flags,
      source,
      timestamp: new Date(),
    });
  }

  /**
   * Get stream statistics
   */
  getStats(): { activeStreams: number; totalUpdates: number } {
    // This is a simplified version - in production you'd track active subscriptions
    return {
      activeStreams: this.updatesSubject.observers.length,
      totalUpdates: 0, // Would track this with a counter
    };
  }

  /**
   * Close all streams (for shutdown)
   */
  close(): void {
    this.updatesSubject.complete();
    this.logger.log('Flags stream service closed');
  }
}
