import { Controller, Sse, UseGuards, Logger, Req } from '@nestjs/common';
import { Request } from 'express';
import { Observable, interval, merge } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { CurrentOrg } from '@/auth/decorators/current-org.decorator';
import { ZeroFlickerFlagsService } from '@/features/zero-flicker.service';
import { FlagsStreamService } from '@/features/flags-stream.service';

interface SseEvent {
  data: string;
  id?: string;
  type?: string;
  retry?: number;
}

@ApiTags('Feature Flags SSE')
@Controller('api/feature-flags')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FlagsSSEController {
  private readonly logger = new Logger(FlagsSSEController.name);

  constructor(
    private readonly flagsService: ZeroFlickerFlagsService,
    private readonly streamService: FlagsStreamService,
  ) {}

  /**
   * Server-Sent Events stream for real-time flag updates
   */
  @Sse('stream')
  streamFlags(
    @CurrentUser('userId') userId: string,
    @CurrentOrg() orgId: string,
    @Req() req: Request,
  ): Observable<SseEvent> {
    this.logger.log(`SSE connection opened for user ${userId} org ${orgId}`);

    // Get initial flags and send immediately
    const initialFlags$ = this.flagsService.getFlagsForUser(userId, orgId).then(({ flags }) => ({
      data: JSON.stringify(flags),
      id: `initial-${Date.now()}`,
      type: 'flags-update',
    }));

    // Stream of real-time updates
    const updates$ = this.streamService.getUpdatesForUser(userId, orgId).pipe(
      map((flags) => ({
        data: JSON.stringify(flags),
        id: `update-${Date.now()}`,
        type: 'flags-update',
      })),
    );

    // Heartbeat every 30 seconds to keep connection alive
    const heartbeat$ = interval(30000).pipe(
      map(() => ({
        data: JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() }),
        id: `heartbeat-${Date.now()}`,
        type: 'heartbeat',
      })),
    );

    // Handle connection close
    req.on('close', () => {
      this.logger.log(`SSE connection closed for user ${userId} org ${orgId}`);
    });

    // Combine initial flags, updates, and heartbeat
    return merge(
      // Send initial flags immediately
      new Observable<SseEvent>((subscriber) => {
        initialFlags$
          .then((event) => {
            subscriber.next(event);
          })
          .catch((error) => {
            this.logger.error('Failed to get initial flags for SSE:', error);
            subscriber.next({
              data: JSON.stringify({}),
              id: `error-${Date.now()}`,
              type: 'error',
            });
          });
      }),

      // Real-time updates
      updates$,

      // Heartbeat
      heartbeat$,
    ).pipe(
      catchError((error) => {
        this.logger.error('SSE stream error:', error);
        return new Observable<SseEvent>((subscriber) => {
          subscriber.next({
            data: JSON.stringify({ error: 'Stream error occurred' }),
            id: `error-${Date.now()}`,
            type: 'error',
            retry: 5000, // Retry after 5 seconds
          });
        });
      }),
    );
  }

  /**
   * Admin endpoint to trigger flag updates via SSE
   */
  @Sse('admin/test-push')
  testPush(
    @CurrentUser('userId') userId: string,
    @CurrentOrg() orgId: string,
  ): Observable<SseEvent> {
    this.logger.log(`Test push SSE for user ${userId} org ${orgId}`);

    // Send test messages every 5 seconds
    return interval(5000).pipe(
      map((index) => ({
        data: JSON.stringify({
          test: true,
          message: `Test message ${index + 1}`,
          timestamp: new Date().toISOString(),
          flags: {
            test_flag: index % 2 === 0,
            counter: index,
          },
        }),
        id: `test-${Date.now()}`,
        type: 'test-update',
      })),
    );
  }
}
