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
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FeatureService } from '@/features/feature.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '@/auth/guards/super-admin.guard';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { CreateFeatureDto } from '@/features/dto/create-feature.dto';
import { UpdateFeatureDto } from '@/features/dto/update-feature.dto';
import {
  SwaggerGetEnabledFeatures,
  SwaggerCheckFeature,
  SwaggerCheckQuota,
  SwaggerListFeatures,
  SwaggerCreateFeature,
  SwaggerUpdateFeature,
  SwaggerDeleteFeature,
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
    try {
      const feature = await this.featureService.createFeature(createFeatureDto);
      return { feature };
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof error.message === 'string' &&
        error.message.includes('already exists')
      ) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
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

  @Delete('admin/:featureKey')
  @UseGuards(SuperAdminGuard)
  @SwaggerDeleteFeature()
  async deleteFeature(@Param('featureKey') featureKey: string) {
    await this.featureService.deleteFeature(featureKey);
    return { success: true };
  }
}
