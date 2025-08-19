import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@ValidatorConstraint({ name: 'OrganizationExists', async: true })
@Injectable()
export class OrganizationExistsConstraint implements ValidatorConstraintInterface {
  constructor(private readonly prisma: PrismaService) {}

  async validate(orgId: string): Promise<boolean> {
    if (!orgId || typeof orgId !== 'string') {
      return false;
    }

    try {
      const organization = await this.prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true }, // Only select ID for performance
      });

      return !!organization;
    } catch {
      // Log error but don't expose internal details
      // Validation error - returning false
      return false;
    }
  }

  defaultMessage(args: ValidationArguments): string {
    return `Organization with ID '${args.value}' does not exist`;
  }
}

export function OrganizationExists(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: OrganizationExistsConstraint,
    });
  };
}

@ValidatorConstraint({ name: 'UserBelongsToOrganization', async: true })
@Injectable()
export class UserBelongsToOrganizationConstraint implements ValidatorConstraintInterface {
  constructor(private readonly prisma: PrismaService) {}

  async validate(value: unknown, args: ValidationArguments): Promise<boolean> {
    // This validator expects to be used on objects with both userId and orgId
    const obj = args.object as Record<string, unknown>;
    const valueObj = value as Record<string, unknown>;
    const userId = obj.userId || valueObj?.userId;
    const orgId = obj.organizationId || obj.orgId || valueObj?.orgId;

    if (!userId || !orgId || typeof userId !== 'string' || typeof orgId !== 'string') {
      return false;
    }

    try {
      const membership = await this.prisma.orgMember.findUnique({
        where: {
          orgId_userId: {
            orgId,
            userId,
          },
        },
        select: { status: true },
      });

      return membership?.status === 'active';
    } catch {
      // Validation error - returning false
      return false;
    }
  }

  defaultMessage(): string {
    return 'User must be an active member of the specified organization';
  }
}

export function UserBelongsToOrganization(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: UserBelongsToOrganizationConstraint,
    });
  };
}

@ValidatorConstraint({ name: 'TeamExists', async: true })
@Injectable()
export class TeamExistsConstraint implements ValidatorConstraintInterface {
  constructor(private readonly prisma: PrismaService) {}

  async validate(teamId: string): Promise<boolean> {
    if (!teamId || typeof teamId !== 'string') {
      return false;
    }

    try {
      const team = await this.prisma.team.findUnique({
        where: { id: teamId },
        select: { id: true },
      });

      return !!team;
    } catch {
      // Validation error - returning false
      return false;
    }
  }

  defaultMessage(args: ValidationArguments): string {
    return `Team with ID '${args.value}' does not exist`;
  }
}

export function TeamExists(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: TeamExistsConstraint,
    });
  };
}

@ValidatorConstraint({ name: 'IntegrationExists', async: true })
@Injectable()
export class IntegrationExistsConstraint implements ValidatorConstraintInterface {
  constructor(private readonly prisma: PrismaService) {}

  async validate(integrationId: string): Promise<boolean> {
    if (!integrationId || typeof integrationId !== 'string') {
      return false;
    }

    try {
      const integration = await this.prisma.integration.findUnique({
        where: { id: integrationId },
        select: { id: true, tokenStatus: true },
      });

      return integration?.tokenStatus === 'ok';
    } catch {
      // Validation error - returning false
      return false;
    }
  }

  defaultMessage(args: ValidationArguments): string {
    return `Integration with ID '${args.value}' does not exist or is not active`;
  }
}

export function IntegrationExists(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IntegrationExistsConstraint,
    });
  };
}
