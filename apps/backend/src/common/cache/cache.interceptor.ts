import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { CacheService } from '@/common/cache/cache.service';
import { CACHEABLE_KEY, CacheableOptions } from '@/common/cache/decorators/cacheable.decorator';

interface RequestWithUser extends Request {
  user?: {
    id?: string;
    organizationId?: string;
  };
}

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const cacheOptions = this.reflector.get<CacheableOptions>(CACHEABLE_KEY, context.getHandler());

    if (!cacheOptions) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const cacheKey = this.generateCacheKey(cacheOptions, context, request);

    try {
      const cachedResult = await this.cacheService.get(cacheKey);
      if (cachedResult !== null) {
        this.logger.debug(`Cache hit for key: ${cacheKey}`);
        return of(cachedResult);
      }
    } catch (error) {
      this.logger.error(`Cache read error for key ${cacheKey}:`, error);
    }

    return next.handle().pipe(
      tap(async (result) => {
        try {
          if (result !== undefined && result !== null) {
            await this.cacheService.set(cacheKey, result, cacheOptions.ttl);
            this.logger.debug(`Cache set for key: ${cacheKey}`);
          }
        } catch (error) {
          this.logger.error(`Cache write error for key ${cacheKey}:`, error);
        }
      }),
    );
  }

  private generateCacheKey(
    options: CacheableOptions,
    context: ExecutionContext,
    request: RequestWithUser,
  ): string {
    const { prefix, keyGenerator } = options;

    if (keyGenerator) {
      const args = this.extractMethodArgs(context);
      return this.cacheService.buildKey(prefix, keyGenerator(...args));
    }

    // Default key generation
    const className = context.getClass().name;
    const methodName = context.getHandler().name;
    const args = this.extractMethodArgs(context);

    // Include user/org context for multi-tenant caching
    const userId = request.user?.id || 'anonymous';
    const orgId = request.user?.organizationId || 'no-org';

    const argsHash = this.hashArgs(args);

    return this.cacheService.buildKey(prefix, className, methodName, userId, orgId, argsHash);
  }

  private extractMethodArgs(context: ExecutionContext): unknown[] {
    const request = context.switchToHttp().getRequest();
    const args = [];

    // Include relevant request parameters
    if (request.params) {
      args.push(...Object.values(request.params));
    }
    if (request.query) {
      args.push(JSON.stringify(request.query));
    }

    return args;
  }

  private hashArgs(args: unknown[]): string {
    if (args.length === 0) return 'no-args';

    try {
      const argsString = JSON.stringify(args);
      // Simple hash function for cache key
      let hash = 0;
      for (let i = 0; i < argsString.length; i++) {
        const char = argsString.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return Math.abs(hash).toString(16);
    } catch {
      return 'hash-error';
    }
  }
}
