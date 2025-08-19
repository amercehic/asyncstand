import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationController } from '@/auth/controllers/organization.controller';
import { OrganizationService } from '@/auth/services/organization.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { UpdateOrganizationDto } from '@/auth/dto/update-organization.dto';

describe('OrganizationController', () => {
  let controller: OrganizationController;
  let mockOrganizationService: jest.Mocked<OrganizationService>;

  const mockOrgId = 'org-123';
  const mockUserId = 'user-123';

  beforeEach(async () => {
    mockOrganizationService = {
      getOrganization: jest.fn(),
      updateOrganizationName: jest.fn(),
    } as unknown as jest.Mocked<OrganizationService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationController],
      providers: [{ provide: OrganizationService, useValue: mockOrganizationService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<OrganizationController>(OrganizationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getOrganization', () => {
    it('should return organization data', async () => {
      const expectedOrg = { id: mockOrgId, name: 'Test Organization' };
      mockOrganizationService.getOrganization.mockResolvedValue(expectedOrg);

      const result = await controller.getOrganization(mockOrgId, mockUserId);

      expect(result).toEqual(expectedOrg);
      expect(mockOrganizationService.getOrganization).toHaveBeenCalledWith(mockOrgId, mockUserId);
    });
  });

  describe('updateOrganization', () => {
    it('should update organization name', async () => {
      const updateDto: UpdateOrganizationDto = { name: 'Updated Organization' };
      const expectedResult = { id: mockOrgId, name: 'Updated Organization' };
      mockOrganizationService.updateOrganizationName.mockResolvedValue(expectedResult);

      const result = await controller.updateOrganization(mockOrgId, mockUserId, updateDto);

      expect(result).toEqual(expectedResult);
      expect(mockOrganizationService.updateOrganizationName).toHaveBeenCalledWith(
        mockOrgId,
        mockUserId,
        updateDto,
      );
    });
  });
});
