import { Injectable, CanActivate, ExecutionContext, HttpStatus } from '@nestjs/common';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ApiError(
        ErrorCode.UNAUTHENTICATED,
        'Authentication required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!user.isSuperAdmin) {
      throw new ApiError(
        ErrorCode.INSUFFICIENT_PERMISSIONS,
        'Super admin access required',
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
