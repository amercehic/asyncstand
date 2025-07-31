import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@/prisma/prisma.service';
import { OrgRole, OrgMemberStatus } from '@prisma/client';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: OrgRole[]) => {
  return (target: unknown, key?: string, descriptor?: PropertyDescriptor) => {
    if (descriptor?.value) {
      Reflect.defineMetadata(ROLES_KEY, roles, descriptor.value);
    }
    return descriptor;
  };
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<OrgRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ApiError(ErrorCode.UNAUTHENTICATED, 'User not authenticated', 401);
    }

    // Check if user is suspended
    const orgMember = await this.prisma.orgMember.findUnique({
      where: {
        orgId_userId: {
          orgId: user.orgId,
          userId: user.userId,
        },
      },
    });

    if (!orgMember || orgMember.status !== OrgMemberStatus.active) {
      throw new ApiError(
        ErrorCode.FORBIDDEN,
        'User is suspended or not a member of this organization',
        403,
      );
    }

    // Check if user has required role
    if (!requiredRoles.includes(orgMember.role)) {
      throw new ApiError(
        ErrorCode.FORBIDDEN,
        'Insufficient permissions to access this resource',
        403,
      );
    }

    return true;
  }
}
