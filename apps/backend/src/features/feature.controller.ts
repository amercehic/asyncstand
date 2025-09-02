import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FeatureService } from '@/features/feature.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '@/auth/guards/super-admin.guard';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { CreateFeatureDto } from '@/features/dto/create-feature.dto';
import { UpdateFeatureDto } from '@/features/dto/update-feature.dto';
import { CreateFeatureOverrideDto } from '@/features/dto/feature-override.dto';
import {
  SwaggerGetEnabledFeatures,
  SwaggerCheckFeature,
  SwaggerCheckQuota,
  SwaggerListFeatures,
  SwaggerCreateFeature,
  SwaggerUpdateFeature,
  SwaggerSetOverride,
  SwaggerRemoveOverride,
  SwaggerListOverrides,
} from '@/swagger/features.swagger';

interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string;
  isSuperAdmin: boolean;
  orgId: string;
  role: string;
}

@ApiTags('Features')
@Controller('features')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class FeatureController {
  constructor(private readonly featureService: FeatureService) {}

  @Get('enabled')
  @SwaggerGetEnabledFeatures()
  async getEnabledFeatures(@CurrentUser() user: AuthenticatedUser) {
    const enabledFeatures = await this.featureService.getEnabledFeatures(user.orgId);
    return { features: enabledFeatures };
  }

  @Get('check/:featureKey')
  @SwaggerCheckFeature()
  async checkFeature(
    @CurrentUser() user: AuthenticatedUser,
    @Param('featureKey') featureKey: string,
  ) {
    const result = await this.featureService.isFeatureEnabled(featureKey, user.orgId, user.id);
    return result;
  }

  @Get('quota/:quotaType')
  @SwaggerCheckQuota()
  async checkQuota(
    @CurrentUser() user: AuthenticatedUser,
    @Param('quotaType') quotaType: 'members' | 'teams' | 'standups' | 'storage' | 'integrations',
  ) {
    return this.featureService.checkQuota(user.orgId, quotaType);
  }

  // Admin endpoints for managing features

  @Get('admin/list')
  @UseGuards(SuperAdminGuard)
  @SwaggerListFeatures()
  async listFeatures(@Query('category') category?: string) {
    const features = await this.featureService.listAllFeatures(category);
    return { features };
  }

  @Post('admin/create')
  @UseGuards(SuperAdminGuard)
  @SwaggerCreateFeature()
  async createFeature(@Body() createFeatureDto: CreateFeatureDto) {
    const feature = await this.featureService.createFeature(createFeatureDto);
    return { feature };
  }

  @Put('admin/:featureKey')
  @UseGuards(SuperAdminGuard)
  @SwaggerUpdateFeature()
  async updateFeature(
    @Param('featureKey') featureKey: string,
    @Body() updateFeatureDto: UpdateFeatureDto,
  ) {
    const feature = await this.featureService.updateFeature(featureKey, updateFeatureDto);
    return { feature };
  }

  @Post('admin/override')
  @UseGuards(SuperAdminGuard)
  @SwaggerSetOverride()
  async setOverride(
    @CurrentUser() user: AuthenticatedUser,
    @Body() overrideDto: CreateFeatureOverrideDto,
  ) {
    // Use current org if not specified
    const targetOrgId = overrideDto.orgId || user.orgId;

    const override = await this.featureService.createFeatureOverride(
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
  @SwaggerRemoveOverride()
  async removeOverride(@Param('orgId') orgId: string, @Param('featureKey') featureKey: string) {
    await this.featureService.removeFeatureOverride(orgId, featureKey);
    return { message: 'Override removed successfully' };
  }

  @Get('admin/overrides')
  @UseGuards(SuperAdminGuard)
  @SwaggerListOverrides()
  async listOverrides(@CurrentUser() user: AuthenticatedUser) {
    const overrides = await this.featureService.listFeatureOverrides(user.orgId);
    return { overrides };
  }
}
