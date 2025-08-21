import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { CustomThrottlerGuard } from '@/common/guards/throttler.guard';
import { LoggerService } from '@/common/logger.service';
import { CacheService } from '@/common/cache/cache.service';

interface RequestWithUser {
  user?: {
    id?: string;
    organizationId?: string;
  };
  ip: string;
}

interface ThrottlerRequestProps {
  context: ExecutionContext;
  limit: number;
  ttl: number;
  throttler: { name?: string };
}

@Injectable()
export class AdaptiveThrottleGuard extends CustomThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    logger: LoggerService,
    private readonly cacheService: CacheService,
  ) {
    super(options, storageService, reflector, logger);
  }

  protected async handleRequest(requestProps: ThrottlerRequestProps): Promise<boolean> {
    const request = requestProps.context.switchToHttp().getRequest();

    // Adjust limits based on user authentication and organization status
    const adjustedLimits = await this.getAdjustedLimits(
      request,
      requestProps.limit,
      requestProps.ttl,
      requestProps.throttler.name || 'default',
    );

    return super.handleRequest({
      ...requestProps,
      limit: adjustedLimits.limit,
      ttl: adjustedLimits.ttl,
    });
  }

  private async getAdjustedLimits(
    request: RequestWithUser,
    baseLimit: number,
    baseTtl: number,
    throttlerName: string,
  ): Promise<{ limit: number; ttl: number }> {
    const user = request.user;
    const ip = request.ip;

    // Base configuration
    let limit = baseLimit;
    let ttl = baseTtl;

    // Authenticated users get higher limits
    if (user) {
      limit = Math.floor(baseLimit * 1.5); // 50% increase for authenticated users

      // Premium organizations get even higher limits
      const isPremiumOrg = await this.isPremiumOrganization(user.organizationId);
      if (isPremiumOrg) {
        limit = Math.floor(baseLimit * 2); // 100% increase for premium orgs
      }
    }

    // Check for suspicious activity and reduce limits accordingly
    const suspiciousScore = await this.getSuspiciousScore(ip, user?.id);
    if (suspiciousScore > 0.5) {
      limit = Math.floor(limit * 0.5); // Reduce limit by 50% for suspicious activity
      this.logger.warn('Reduced rate limit due to suspicious activity', {
        ip,
        userId: user?.id,
        suspiciousScore,
        originalLimit: baseLimit,
        adjustedLimit: limit,
        throttlerName,
      } as Record<string, unknown>);
    }

    // Progressive rate limiting for repeated violations
    const violationCount = await this.getViolationCount(ip, user?.id);
    if (violationCount > 0) {
      const penalty = Math.min(violationCount * 0.1, 0.8); // Max 80% penalty
      limit = Math.floor(limit * (1 - penalty));
      ttl = Math.floor(ttl * (1 + penalty)); // Increase window for violations

      this.logger.info('Applied progressive rate limiting', {
        ip,
        userId: user?.id,
        violationCount,
        penalty,
        adjustedLimit: limit,
        adjustedTtl: ttl,
      } as Record<string, unknown>);
    }

    return { limit, ttl };
  }

  private async isPremiumOrganization(orgId?: string): Promise<boolean> {
    if (!orgId) return false;

    try {
      const cacheKey = this.cacheService.buildKey('org-premium-status', orgId);
      const cached = await this.cacheService.get<boolean>(cacheKey);

      if (cached !== null) {
        return cached;
      }

      // This would check subscription status in a real implementation
      // For now, return false as a placeholder
      const isPremium = false;

      await this.cacheService.set(cacheKey, isPremium, 3600); // Cache for 1 hour
      return isPremium;
    } catch (error) {
      this.logger.error(
        'Error checking premium organization status',
        error as Record<string, unknown>,
      );
      return false;
    }
  }

  private async getSuspiciousScore(ip: string, userId?: string): Promise<number> {
    try {
      const key = userId ? `suspicious:user:${userId}` : `suspicious:ip:${ip}`;
      const score = await this.cacheService.get<number>(key);
      return score || 0;
    } catch (error) {
      this.logger.error('Error getting suspicious score', error as Record<string, unknown>);
      return 0;
    }
  }

  private async getViolationCount(ip: string, userId?: string): Promise<number> {
    try {
      const key = userId ? `violations:user:${userId}` : `violations:ip:${ip}`;
      const count = await this.cacheService.get<number>(key);
      return count || 0;
    } catch (error) {
      this.logger.error('Error getting violation count', error as Record<string, unknown>);
      return 0;
    }
  }

  /**
   * Record a rate limit violation
   */
  async recordViolation(ip: string, userId?: string): Promise<void> {
    try {
      const key = userId ? `violations:user:${userId}` : `violations:ip:${ip}`;
      const current = await this.getViolationCount(ip, userId);
      await this.cacheService.set(key, current + 1, 3600); // Expire after 1 hour

      // If violations exceed threshold, increase suspicious score
      if (current >= 3) {
        const suspiciousKey = userId ? `suspicious:user:${userId}` : `suspicious:ip:${ip}`;
        const currentScore = await this.getSuspiciousScore(ip, userId);
        const newScore = Math.min(currentScore + 0.1, 1.0);
        await this.cacheService.set(suspiciousKey, newScore, 7200); // Expire after 2 hours
      }
    } catch (error) {
      this.logger.error('Error recording rate limit violation', error as Record<string, unknown>);
    }
  }
}
