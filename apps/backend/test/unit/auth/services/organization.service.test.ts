/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { OrganizationService } from '@/auth/services/organization.service';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { OrgRole } from '@prisma/client';
import { createMockPrismaService, MockPrismaService } from '@/test/utils/mocks/prisma.mock';
import {
  createMockLoggerService,
  createMockAuditLogService,
} from '@/test/utils/mocks/services.mock';

describe('OrganizationService', () => {
  let service: OrganizationService;
  let mockPrisma: MockPrismaService;
  let mockLogger: ReturnType<typeof createMockLoggerService>;
  let mockAuditLog: ReturnType<typeof createMockAuditLogService>;

  const mockOrgMember = {
    orgId: 'org-1',
    userId: 'user-1',
    role: OrgRole.owner,
    org: {
      id: 'org-1',
      name: 'Test Organization',
    },
    user: {
      id: 'user-1',
      name: 'Test User',
    },
  };

  const mockOrganization = {
    id: 'org-1',
    name: 'Test Organization',
  };

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();
    mockLogger = createMockLoggerService();
    mockAuditLog = createMockAuditLogService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LoggerService, useValue: mockLogger },
        { provide: AuditLogService, useValue: mockAuditLog },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
  });

  describe('updateOrganizationName', () => {
    const updateDto = { name: 'Updated Organization Name' };

    beforeEach(() => {
      mockPrisma.orgMember.findUnique.mockResolvedValue(mockOrgMember as any);
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization as any);
      mockPrisma.organization.update.mockResolvedValue({
        ...mockOrganization,
        name: updateDto.name,
      } as any);
      mockAuditLog.log.mockResolvedValue(undefined);
    });

    it('should update organization name successfully when user is owner', async () => {
      const result = await service.updateOrganizationName('org-1', 'user-1', updateDto);

      expect(result).toEqual({
        id: 'org-1',
        name: 'Updated Organization Name',
      });

      expect(mockPrisma.orgMember.findUnique).toHaveBeenCalledWith({
        where: {
          orgId_userId: {
            orgId: 'org-1',
            userId: 'user-1',
          },
        },
        include: {
          org: true,
          user: true,
        },
      });

      expect(mockPrisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: { name: updateDto.name },
      });

      expect(mockAuditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org-1',
          actorUserId: 'user-1',
          action: 'organization_name_updated',
          resources: [
            {
              type: 'organization',
              id: 'org-1',
              action: 'updated',
              previousValues: { name: 'Test Organization' },
              newValues: { name: updateDto.name },
            },
          ],
        }),
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Organization name updated: Test Organization -> Updated Organization Name by user user-1',
      );
    });

    it('should throw error if user is not a member of the organization', async () => {
      mockPrisma.orgMember.findUnique.mockResolvedValue(null);

      await expect(service.updateOrganizationName('org-1', 'user-1', updateDto)).rejects.toThrow(
        new ApiError(
          ErrorCode.FORBIDDEN,
          'User is not a member of this organization',
          HttpStatus.FORBIDDEN,
        ),
      );
    });

    it('should throw error if user is not an owner', async () => {
      const nonOwnerMember = {
        ...mockOrgMember,
        role: OrgRole.member,
      };
      mockPrisma.orgMember.findUnique.mockResolvedValue(nonOwnerMember as any);

      await expect(service.updateOrganizationName('org-1', 'user-1', updateDto)).rejects.toThrow(
        new ApiError(
          ErrorCode.FORBIDDEN,
          'Only organization owners can update organization name',
          HttpStatus.FORBIDDEN,
        ),
      );
    });

    it('should throw error if organization not found', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(service.updateOrganizationName('org-1', 'user-1', updateDto)).rejects.toThrow(
        new ApiError(ErrorCode.NOT_FOUND, 'Organization not found', HttpStatus.NOT_FOUND),
      );
    });
  });

  describe('getOrganization', () => {
    beforeEach(() => {
      mockPrisma.orgMember.findUnique.mockResolvedValue(mockOrgMember as any);
    });

    it('should return organization data when user is a member', async () => {
      const result = await service.getOrganization('org-1', 'user-1');

      expect(result).toEqual({
        id: 'org-1',
        name: 'Test Organization',
      });

      expect(mockPrisma.orgMember.findUnique).toHaveBeenCalledWith({
        where: {
          orgId_userId: {
            orgId: 'org-1',
            userId: 'user-1',
          },
        },
        include: {
          org: true,
        },
      });
    });

    it('should throw error if user is not a member of the organization', async () => {
      mockPrisma.orgMember.findUnique.mockResolvedValue(null);

      await expect(service.getOrganization('org-1', 'user-1')).rejects.toThrow(
        new ApiError(
          ErrorCode.FORBIDDEN,
          'User is not a member of this organization',
          HttpStatus.FORBIDDEN,
        ),
      );
    });
  });
});
