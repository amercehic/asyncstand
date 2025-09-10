import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export type Flags = Record<string, boolean>;

interface CacheEntry {
  flags: Flags;
  timestamp: number;
  etag: string;
}

interface InFlightRequest {
  promise: Promise<Flags>;
  timestamp: number;
}

@Injectable()
export class ZeroFlickerFlagsService {
  private readonly logger = new Logger(ZeroFlickerFlagsService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, InFlightRequest>();
  private readonly TTL_MS = 60 * 1000; // 60 seconds
  private readonly IN_FLIGHT_TTL = 10 * 1000; // 10 seconds for in-flight dedupe

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get feature flags for a user with TTL caching and in-flight request deduplication
   * Integrates with your existing feature flag system
   */
  async getFlagsForUser(userId: string, orgId: string): Promise<{ flags: Flags; etag: string }> {
    const cacheKey = `user:${userId}:org:${orgId}`;
    const now = Date.now();

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && now - cached.timestamp < this.TTL_MS) {
      this.logger.debug(`Cache hit for user ${userId} org ${orgId}`);
      return { flags: cached.flags, etag: cached.etag };
    }

    // Check for in-flight request
    const inFlight = this.inFlight.get(cacheKey);
    if (inFlight && now - inFlight.timestamp < this.IN_FLIGHT_TTL) {
      this.logger.debug(`Using in-flight request for user ${userId} org ${orgId}`);
      const flags = await inFlight.promise;
      const entry = this.cache.get(cacheKey);
      return { flags, etag: entry?.etag || this.generateETag(flags) };
    }

    // Create new request
    const promise = this.fetchFlagsFromDB(orgId);
    this.inFlight.set(cacheKey, { promise, timestamp: now });

    try {
      const flags = await promise;
      const etag = this.generateETag(flags);

      // Update cache
      this.cache.set(cacheKey, {
        flags,
        timestamp: now,
        etag,
      });

      this.logger.debug(`Fetched fresh flags for user ${userId} org ${orgId}`);
      return { flags, etag };
    } catch (error) {
      this.logger.error(`Failed to fetch flags for user ${userId} org ${orgId}:`, error);

      // Return stale cache if available
      if (cached) {
        this.logger.warn(`Returning stale cache for user ${userId} org ${orgId}`);
        return { flags: cached.flags, etag: cached.etag };
      }

      // Fallback to empty flags
      const fallbackFlags = {};
      const fallbackEtag = this.generateETag(fallbackFlags);
      return { flags: fallbackFlags, etag: fallbackEtag };
    } finally {
      // Clean up in-flight tracking
      this.inFlight.delete(cacheKey);
    }
  }

  /**
   * Fetch flags from your existing database structure
   */
  private async fetchFlagsFromDB(orgId: string): Promise<Flags> {
    try {
      // Get organization with features
      const org = await this.prisma.organization.findUnique({
        where: { id: orgId },
        include: {
          featureOverrides: {
            include: {
              feature: true,
            },
          },
        },
      });

      if (!org) {
        this.logger.warn(`Organization ${orgId} not found`);
        return {};
      }

      // Transform to flags map
      const flags: Flags = {};

      // Add enabled organization features
      for (const override of org.featureOverrides) {
        if (override.enabled) {
          flags[override.feature.key] = true;
        }
      }

      // Always include core features as enabled
      const coreFeatures = ['dashboard', 'standups'];
      for (const coreFeature of coreFeatures) {
        flags[coreFeature] = true;
      }

      this.logger.log(`Fetched ${Object.keys(flags).length} flags for org ${orgId}`);
      return flags;
    } catch (error) {
      this.logger.error('Failed to fetch flags from database:', error);
      throw error;
    }
  }

  /**
   * Get flags using existing API pattern (for backwards compatibility)
   */
  async getEnabledFeaturesForOrg(orgId: string): Promise<string[]> {
    const { flags } = await this.getFlagsForUser('system', orgId);
    return Object.entries(flags)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key);
  }

  /**
   * Generate ETag for flags object
   */
  private generateETag(flags: Flags): string {
    const flagsString = JSON.stringify(flags, Object.keys(flags).sort());
    const hash = this.simpleHash(flagsString);
    return `"${hash}"`;
  }

  /**
   * Simple hash function for ETag generation
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Clear cache for testing purposes
   */
  clearCache(): void {
    this.cache.clear();
    this.inFlight.clear();
    this.logger.debug('Cache cleared');
  }

  /**
   * Get cache stats for monitoring
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Invalidate cache for specific user/org
   */
  invalidateCache(userId: string, orgId: string): void {
    const cacheKey = `user:${userId}:org:${orgId}`;
    this.cache.delete(cacheKey);
    this.logger.debug(`Invalidated cache for ${cacheKey}`);
  }

  /**
   * Invalidate all cache entries for an organization
   */
  invalidateOrgCache(orgId: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.includes(`:org:${orgId}`)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    this.logger.debug(`Invalidated ${keysToDelete.length} cache entries for org ${orgId}`);
  }
}
