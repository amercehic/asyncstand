import { Module } from '@nestjs/common';

// Zero-flicker feature flag components
import { ZeroFlickerFlagsService } from './zero-flicker.service';
import { ZeroFlickerFlagsController } from './zero-flicker.controller';
import { FlagsStreamService } from './flags-stream.service';
import { FlagsSSEController } from './flags-sse.controller';

// Enhanced app controller
import { AppWithFlagsController } from '@/app/app-with-flags.controller';

@Module({
  controllers: [
    // Zero-flicker controllers
    ZeroFlickerFlagsController,
    FlagsSSEController,
    AppWithFlagsController,
  ],
  providers: [
    // Zero-flicker services
    ZeroFlickerFlagsService,
    FlagsStreamService,
  ],
  exports: [
    // Export for use in other modules
    ZeroFlickerFlagsService,
    FlagsStreamService,
  ],
})
export class FeaturesEnhancedModule {}

/**
 * Feature flag webhook handler for external updates
 */
export class FeatureFlagsWebhookService {
  constructor(
    private readonly flagsService: ZeroFlickerFlagsService,
    private readonly streamService: FlagsStreamService,
  ) {}

  /**
   * Handle webhook from external feature flag service
   */
  async handleFlagUpdate(orgId: string, flags: Record<string, boolean>): Promise<void> {
    // Invalidate cache for the organization
    this.flagsService.invalidateOrgCache(orgId);

    // Broadcast update via SSE
    this.streamService.pushOrgUpdate(orgId, flags, 'webhook');
  }

  /**
   * Handle admin-triggered flag update
   */
  async handleAdminUpdate(orgId: string, flags: Record<string, boolean>): Promise<void> {
    // Invalidate cache for the organization
    this.flagsService.invalidateOrgCache(orgId);

    // Broadcast update via SSE
    this.streamService.pushOrgUpdate(orgId, flags, 'admin');
  }
}
