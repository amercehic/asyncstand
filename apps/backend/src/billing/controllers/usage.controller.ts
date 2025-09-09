import { Controller, Get, UseGuards, HttpStatus, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '@/auth/guards/roles.guard';
import { CurrentOrg } from '@/auth/decorators/current-org.decorator';
import { UsageTrackingService } from '@/billing/services/usage-tracking.service';
import { PlanEnforcementService } from '@/billing/services/plan-enforcement.service';
import { CurrentUsageDto, BillingPeriodDto } from '@/billing/dto/usage.dto';
import { OrgRole } from '@prisma/client';

@ApiTags('Usage')
@ApiBearerAuth('JWT-auth')
@Controller('usage')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsageController {
  constructor(
    private readonly usageTrackingService: UsageTrackingService,
    private readonly planEnforcementService: PlanEnforcementService,
  ) {}

  @Get('current')
  @Roles(OrgRole.owner, OrgRole.admin, OrgRole.member)
  @ApiOperation({
    summary: 'Get current usage',
    description: 'Get current usage statistics for the organization',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Current usage statistics',
    type: CurrentUsageDto,
  })
  async getCurrentUsage(@CurrentOrg() orgId: string) {
    const usage = await this.usageTrackingService.getCurrentUsage(orgId);

    return {
      message: 'Usage statistics retrieved successfully',
      usage,
    };
  }

  @Get('billing-period')
  @Roles(OrgRole.owner, OrgRole.admin, OrgRole.member)
  @ApiOperation({
    summary: 'Get billing period',
    description: 'Get current billing period information',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Billing period information',
    type: BillingPeriodDto,
  })
  async getBillingPeriod(@CurrentOrg() orgId: string) {
    const billingPeriod = await this.usageTrackingService.getBillingPeriod(orgId);

    return {
      message: 'Billing period retrieved successfully',
      billingPeriod,
    };
  }

  @Get('warnings')
  @Roles(OrgRole.owner, OrgRole.admin, OrgRole.member)
  @ApiOperation({
    summary: 'Get usage warnings',
    description: 'Get warnings about approaching or exceeded limits',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Usage warnings',
  })
  async getUsageWarnings(@CurrentOrg() orgId: string) {
    const warnings = await this.planEnforcementService.getUsageWarnings(orgId);

    return {
      message: 'Usage warnings retrieved successfully',
      ...warnings,
    };
  }

  @Get('limits-check')
  @Roles(OrgRole.owner, OrgRole.admin, OrgRole.member)
  @ApiOperation({
    summary: 'Check all limits',
    description: 'Check all plan limits and get recommendations',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Limits check results',
  })
  async checkLimits(@CurrentOrg() orgId: string) {
    const [usage, warnings, needsUpgrade] = await Promise.all([
      this.usageTrackingService.getCurrentUsage(orgId),
      this.planEnforcementService.getUsageWarnings(orgId),
      this.planEnforcementService.needsUpgrade(orgId),
    ]);

    return {
      message: 'Limits check completed',
      usage,
      warnings: warnings.warnings,
      needsUpgrade,
      recommendations: needsUpgrade
        ? ['Consider upgrading to Pro plan for unlimited access']
        : ['You are within all plan limits'],
    };
  }

  @Get('can-perform/:action')
  @Roles(OrgRole.owner, OrgRole.admin, OrgRole.member)
  @ApiOperation({
    summary: 'Check if action is allowed',
    description: 'Check if a specific action is allowed based on current plan limits',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Action permission check result',
  })
  async canPerformAction(@CurrentOrg() orgId: string, @Param('action') action: string) {
    const validActions = [
      'create_team',
      'invite_member',
      'create_standup_config',
      'create_standup',
    ];

    if (!validActions.includes(action)) {
      return {
        allowed: false,
        reason: `Invalid action: ${action}. Valid actions: ${validActions.join(', ')}`,
        upgradeRequired: false,
      };
    }

    const result = await this.usageTrackingService.canPerformAction(
      orgId,
      action as 'create_team' | 'invite_member' | 'create_standup_config' | 'create_standup',
    );

    return {
      message: 'Action permission checked',
      action,
      ...result,
    };
  }
}
