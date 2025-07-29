import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationService } from '@/auth/services/organization.service';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { OrgRole } from '@prisma/client';
import { UpdateOrganizationDto } from '@/auth/dto/update-organization.dto';

describe('OrganizationService', () => {
  let service: OrganizationService;

  const mockPrismaService = {
    orgMember: {
      findUnique: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockLoggerService = {
    setContext: jest.fn(),
    info: jest.fn(),
  };

  const mockAuditLogService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateOrganizationName', () => {
    const orgId = 'org-123';
    const userId = 'user-123';
    const dto: UpdateOrganizationDto = { name: 'New Organization Name' };

    it('should update organization name successfully for owner user', async () => {
      const mockMember = {
        role: OrgRole.owner,
        org: { id: orgId, name: 'Old Name' },
        user: { id: userId },
      };

      const mockCurrentOrg = {
        id: orgId,
        name: 'Old Name',
      };

      const mockUpdatedOrg = {
        id: orgId,
        name: 'New Organization Name',
      };

      mockPrismaService.orgMember.findUnique.mockResolvedValue(mockMember);
      mockPrismaService.organization.findUnique.mockResolvedValue(mockCurrentOrg);
      mockPrismaService.organization.update.mockResolvedValue(mockUpdatedOrg);
      mockAuditLogService.log.mockResolvedValue(undefined);

      const result = await service.updateOrganizationName(orgId, userId, dto);

      expect(result).toEqual({
        id: orgId,
        name: 'New Organization Name',
      });

      expect(mockPrismaService.organization.update).toHaveBeenCalledWith({
        where: { id: orgId },
        data: { name: dto.name },
      });

      expect(mockAuditLogService.log).toHaveBeenCalled();
    });

    it('should update organization name successfully for owner user', async () => {
      const mockMember = {
        role: OrgRole.owner,
        org: { id: orgId, name: 'Old Name' },
        user: { id: userId },
      };

      const mockCurrentOrg = {
        id: orgId,
        name: 'Old Name',
      };

      const mockUpdatedOrg = {
        id: orgId,
        name: 'New Organization Name',
      };

      mockPrismaService.orgMember.findUnique.mockResolvedValue(mockMember);
      mockPrismaService.organization.findUnique.mockResolvedValue(mockCurrentOrg);
      mockPrismaService.organization.update.mockResolvedValue(mockUpdatedOrg);
      mockAuditLogService.log.mockResolvedValue(undefined);

      const result = await service.updateOrganizationName(orgId, userId, dto);

      expect(result).toEqual({
        id: orgId,
        name: 'New Organization Name',
      });
    });

    it('should throw error if user is not a member', async () => {
      mockPrismaService.orgMember.findUnique.mockResolvedValue(null);

      await expect(service.updateOrganizationName(orgId, userId, dto)).rejects.toThrow(
        new ApiError(ErrorCode.FORBIDDEN, 'User is not a member of this organization', 403),
      );
    });

    it('should throw error if user is admin (not owner)', async () => {
      const mockMember = {
        role: OrgRole.admin,
        org: { id: orgId, name: 'Old Name' },
        user: { id: userId },
      };

      mockPrismaService.orgMember.findUnique.mockResolvedValue(mockMember);

      await expect(service.updateOrganizationName(orgId, userId, dto)).rejects.toThrow(
        new ApiError(
          ErrorCode.FORBIDDEN,
          'Only organization owners can update organization name',
          403,
        ),
      );
    });

    it('should throw error if user is member (not owner)', async () => {
      const mockMember = {
        role: OrgRole.member,
        org: { id: orgId, name: 'Old Name' },
        user: { id: userId },
      };

      mockPrismaService.orgMember.findUnique.mockResolvedValue(mockMember);

      await expect(service.updateOrganizationName(orgId, userId, dto)).rejects.toThrow(
        new ApiError(
          ErrorCode.FORBIDDEN,
          'Only organization owners can update organization name',
          403,
        ),
      );
    });

    it('should throw error if organization not found', async () => {
      const mockMember = {
        role: OrgRole.admin,
        org: { id: orgId, name: 'Old Name' },
        user: { id: userId },
      };

      mockPrismaService.orgMember.findUnique.mockResolvedValue(mockMember);
      mockPrismaService.organization.findUnique.mockResolvedValue(null);

      await expect(service.updateOrganizationName(orgId, userId, dto)).rejects.toThrow(
        new ApiError(ErrorCode.NOT_FOUND, 'Organization not found', 404),
      );
    });
  });

  describe('getOrganization', () => {
    const orgId = 'org-123';
    const userId = 'user-123';

    it('should return organization details for valid member', async () => {
      const mockMember = {
        org: {
          id: orgId,
          name: 'Test Organization',
        },
      };

      mockPrismaService.orgMember.findUnique.mockResolvedValue(mockMember);

      const result = await service.getOrganization(orgId, userId);

      expect(result).toEqual({
        id: orgId,
        name: 'Test Organization',
      });
    });

    it('should throw error if user is not a member', async () => {
      mockPrismaService.orgMember.findUnique.mockResolvedValue(null);

      await expect(service.getOrganization(orgId, userId)).rejects.toThrow(
        new ApiError(ErrorCode.FORBIDDEN, 'User is not a member of this organization', 403),
      );
    });
  });
});
