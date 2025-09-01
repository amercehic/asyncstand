import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FeatureService } from '@/features/feature.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '@/auth/guards/super-admin.guard';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { PrismaService } from '@/prisma/prisma.service';
import { ApiError } from '@/common/api-error';
import { ErrorCode } from 'shared';
import { Prisma } from '@prisma/client';

interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string;
  isSuperAdmin: boolean;
  orgId: string;
  role: string;
}

interface CreateFeatureDto {
  key: string;
  name: string;
  description?: string;
  isEnabled: boolean;
  environment: string[];
  category?: string;
  isPlanBased: boolean;
  requiresAdmin: boolean;
  rolloutType?: string;
  rolloutValue?: Prisma.InputJsonValue;
}

interface UpdateFeatureDto {
  name?: string;
  description?: string;
  isEnabled?: boolean;
  environment?: string[];
  category?: string;
  isPlanBased?: boolean;
  requiresAdmin?: boolean;
  rolloutType?: string;
  rolloutValue?: Prisma.InputJsonValue;
}

@ApiTags('Features')
@Controller('features')
@UseGuards(JwtAuthGuard)
export class FeatureController {
  constructor(
    private readonly featureService: FeatureService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('enabled')
  @ApiOperation({ summary: 'Get all enabled features for the current organization' })
  @ApiResponse({ status: HttpStatus.OK })
  @ApiBearerAuth()
  async getEnabledFeatures(@CurrentUser() user: AuthenticatedUser) {
    const enabledFeatures = await this.featureService.getEnabledFeatures(user.orgId);
    return { features: enabledFeatures };
  }

  @Get('check/:featureKey')
  @ApiOperation({ summary: 'Check if a specific feature is enabled' })
  @ApiResponse({ status: HttpStatus.OK })
  @ApiBearerAuth()
  async checkFeature(
    @CurrentUser() user: AuthenticatedUser,
    @Param('featureKey') featureKey: string,
  ) {
    const result = await this.featureService.isFeatureEnabled(featureKey, user.orgId, user.id);
    return result;
  }

  @Get('quota/:quotaType')
  @ApiOperation({ summary: 'Check quota usage for a specific resource' })
  @ApiResponse({ status: HttpStatus.OK })
  @ApiBearerAuth()
  async checkQuota(
    @CurrentUser() user: AuthenticatedUser,
    @Param('quotaType') quotaType: 'members' | 'teams' | 'standups' | 'storage' | 'integrations',
  ) {
    return this.featureService.checkQuota(user.orgId, quotaType);
  }

  // Admin endpoints for managing features

  @Get('admin/list')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'List all features (super admin only)' })
  @ApiResponse({ status: HttpStatus.OK })
  @ApiBearerAuth()
  async listFeatures(@Query('category') category?: string) {
    const where = category ? { category } : {};
    const features = await this.prisma.feature.findMany({
      where,
      include: {
        planFeatures: {
          include: { plan: true },
        },
        _count: {
          select: { orgOverrides: true },
        },
      },
      orderBy: { key: 'asc' },
    });
    return { features };
  }

  @Post('admin/create')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Create a new feature flag (super admin only)' })
  @ApiResponse({ status: HttpStatus.CREATED })
  @ApiBearerAuth()
  async createFeature(@Body() createFeatureDto: CreateFeatureDto) {
    const feature = await this.prisma.feature.create({
      data: createFeatureDto,
    });
    return { feature };
  }

  @Put('admin/:featureKey')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Update a feature flag (super admin only)' })
  @ApiResponse({ status: HttpStatus.OK })
  @ApiBearerAuth()
  async updateFeature(
    @Param('featureKey') featureKey: string,
    @Body() updateFeatureDto: UpdateFeatureDto,
  ) {
    const feature = await this.prisma.feature.update({
      where: { key: featureKey },
      data: updateFeatureDto,
    });
    return { feature };
  }

  @Post('admin/override')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Set a feature override for an organization (super admin only)' })
  @ApiResponse({ status: HttpStatus.CREATED })
  @ApiBearerAuth()
  async setOverride(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    overrideDto: {
      featureKey: string;
      orgId?: string;
      enabled: boolean;
      value?: string;
      reason?: string;
      expiresAt?: string;
    },
  ) {
    // Use current org if not specified
    const targetOrgId = overrideDto.orgId || user.orgId;

    // Verify the feature exists
    const feature = await this.prisma.feature.findUnique({
      where: { key: overrideDto.featureKey },
    });

    if (!feature) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Feature not found', HttpStatus.NOT_FOUND);
    }

    const override = await this.featureService.setFeatureOverride(
      targetOrgId,
      overrideDto.featureKey,
      overrideDto.enabled,
      {
        value: overrideDto.value,
        reason: overrideDto.reason,
        expiresAt: overrideDto.expiresAt ? new Date(overrideDto.expiresAt) : undefined,
      },
    );

    return { override };
  }

  @Delete('admin/override/:orgId/:featureKey')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Remove a feature override (super admin only)' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiBearerAuth()
  async removeOverride(@Param('orgId') orgId: string, @Param('featureKey') featureKey: string) {
    await this.featureService.removeFeatureOverride(orgId, featureKey);
    return { message: 'Override removed successfully' };
  }

  @Get('admin/overrides')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'List all feature overrides (super admin only)' })
  @ApiResponse({ status: HttpStatus.OK })
  @ApiBearerAuth()
  async listOverrides(@CurrentUser() user: AuthenticatedUser) {
    const overrides = await this.prisma.featureOverride.findMany({
      where: { orgId: user.orgId },
      include: { feature: true },
    });
    return { overrides };
  }
}
