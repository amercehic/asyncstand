import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '@/auth/guards/roles.guard';
import { OrganizationService } from '@/auth/services/organization.service';
import { UpdateOrganizationDto } from '@/auth/dto/update-organization.dto';
import { CurrentOrg } from '@/auth/decorators/current-org.decorator';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { OrgRole } from '@prisma/client';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SwaggerGetOrganization, SwaggerUpdateOrganization } from '@/swagger/organization.swagger';
import { Audit } from '@/common/audit/audit.decorator';
import { AuditCategory, AuditSeverity } from '@/common/audit/types';

@ApiTags('Organization')
@ApiBearerAuth('JWT-auth')
@Controller('org')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @SwaggerGetOrganization()
  async getOrganization(@CurrentOrg() orgId: string, @CurrentUser('userId') userId: string) {
    return this.organizationService.getOrganization(orgId, userId);
  }

  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(OrgRole.owner)
  @SwaggerUpdateOrganization()
  @Audit({
    action: 'organization.updated',
    category: AuditCategory.DATA_MODIFICATION,
    severity: AuditSeverity.MEDIUM,
    resourcesFromRequest: (req) => [
      { type: 'organization', id: req.user?.orgId, action: 'UPDATED' },
    ],
  })
  async updateOrganization(
    @CurrentOrg() orgId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationService.updateOrganizationName(orgId, userId, dto);
  }
}
