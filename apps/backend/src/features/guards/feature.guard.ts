import { Injectable, CanActivate, ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureService } from '@/features/feature.service';
import { FEATURE_KEY } from '@/features/decorators/require-feature.decorator';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private featureService: FeatureService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.getAllAndOverride<string>(FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredFeature) {
      return true; // No feature required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.orgId) {
      throw new ApiError(
        ErrorCode.UNAUTHENTICATED,
        'User authentication required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const featureCheck = await this.featureService.isFeatureEnabled(
      requiredFeature,
      user.orgId,
      user.id,
    );

    if (!featureCheck.enabled) {
      throw new ApiError(
        ErrorCode.FEATURE_DISABLED,
        `Feature '${requiredFeature}' is not available. ${featureCheck.reason || 'Please upgrade your plan or contact support.'}`,
        HttpStatus.FORBIDDEN,
      );
    }

    // Add feature check result to request for potential use in controller
    request.featureCheck = featureCheck;

    return true;
  }
}
