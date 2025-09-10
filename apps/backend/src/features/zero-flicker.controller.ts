import { Controller, Get, Req, Res, UseGuards, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { CurrentOrg } from '@/auth/decorators/current-org.decorator';
import { ZeroFlickerFlagsService } from '@/features/zero-flicker.service';

@ApiTags('Feature Flags (Zero Flicker)')
@Controller('api/feature-flags')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ZeroFlickerFlagsController {
  private readonly logger = new Logger(ZeroFlickerFlagsController.name);

  constructor(private readonly flagsService: ZeroFlickerFlagsService) {}

  /**
   * Get feature flags with ETag support for efficient polling
   */
  @Get()
  async getFeatureFlags(
    @CurrentUser('userId') userId: string,
    @CurrentOrg() orgId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const { flags, etag } = await this.flagsService.getFlagsForUser(userId, orgId);

      // Check If-None-Match header for conditional requests
      const ifNoneMatch = req.headers['if-none-match'];
      if (ifNoneMatch && ifNoneMatch === etag) {
        // ETag matches, return 304 Not Modified
        res.setHeader('ETag', etag);
        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        res.status(304).end();
        return;
      }

      // Set response headers
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      res.setHeader('Content-Type', 'application/json');

      // Send flags
      res.json(flags);
    } catch (error) {
      this.logger.error(`Failed to get flags for user ${userId} org ${orgId}:`, error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get enabled features as array (backwards compatibility with existing API)
   */
  @Get('enabled')
  async getEnabledFeatures(@CurrentOrg() orgId: string): Promise<string[]> {
    try {
      return await this.flagsService.getEnabledFeaturesForOrg(orgId);
    } catch (error) {
      this.logger.error(`Failed to get enabled features for org ${orgId}:`, error);
      return [];
    }
  }

  /**
   * Check a specific feature flag
   */
  @Get(':featureKey')
  async checkFeature(
    @CurrentUser('userId') userId: string,
    @CurrentOrg() orgId: string,
    @Req() req: Request,
  ): Promise<{
    key: string;
    enabled: boolean;
    source: string;
    timestamp: string;
  }> {
    try {
      const featureKey = req.params.featureKey;
      const { flags } = await this.flagsService.getFlagsForUser(userId, orgId);

      return {
        key: featureKey,
        enabled: flags[featureKey] || false,
        source: 'database',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to check feature ${req.params.featureKey}:`, error);
      return {
        key: req.params.featureKey,
        enabled: false,
        source: 'error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Admin endpoint to clear cache
   */
  @Get('admin/clear-cache')
  clearCache(
    @CurrentUser('userId') userId: string,
    @CurrentOrg() orgId: string,
  ): { message: string; timestamp: string } {
    this.flagsService.clearCache();
    this.logger.log(`Cache cleared by user ${userId} from org ${orgId}`);

    return {
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Admin endpoint to get cache stats
   */
  @Get('admin/cache-stats')
  getCacheStats(): {
    cache: { size: number; keys: string[] };
    timestamp: string;
  } {
    return {
      cache: this.flagsService.getCacheStats(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Admin endpoint to invalidate cache for current org
   */
  @Get('admin/invalidate-org-cache')
  invalidateOrgCache(
    @CurrentUser('userId') userId: string,
    @CurrentOrg() orgId: string,
  ): { message: string; timestamp: string } {
    this.flagsService.invalidateOrgCache(orgId);
    this.logger.log(`Org cache invalidated for ${orgId} by user ${userId}`);

    return {
      message: `Cache invalidated for organization ${orgId}`,
      timestamp: new Date().toISOString(),
    };
  }
}
