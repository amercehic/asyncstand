import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '@/auth/guards/super-admin.guard';
import { PlanManagementService } from '@/admin/services/plan-management.service';
import { CreatePlanDto, UpdatePlanDto, PlanResponseDto } from '@/admin/dto/plan.dto';
import { LoggerService } from '@/common/logger.service';
import { AuditLog } from '@/common/audit/decorators';
import { AuditCategory, AuditSeverity } from '@/common/audit/types';

@ApiTags('Admin - Plan Management')
@ApiBearerAuth()
@Controller('admin/plans')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class PlanManagementController {
  constructor(
    private readonly planManagementService: PlanManagementService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(PlanManagementController.name);
  }

  @Get()
  @ApiOperation({ summary: 'Get all plans' })
  @ApiResponse({
    status: 200,
    description: 'List of all plans with features and subscription counts',
    type: [PlanResponseDto],
  })
  async getAllPlans(): Promise<PlanResponseDto[]> {
    this.logger.debug('Getting all plans');
    return this.planManagementService.getAllPlans();
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get plan usage analytics' })
  @ApiResponse({
    status: 200,
    description: 'Plan usage analytics including subscription counts and revenue',
  })
  async getPlanAnalytics() {
    this.logger.debug('Getting plan analytics');
    return this.planManagementService.getPlanAnalytics();
  }

  @Get('features')
  @ApiOperation({ summary: 'Get available features for plan assignment' })
  @ApiResponse({
    status: 200,
    description: 'List of available features',
  })
  async getAvailableFeatures() {
    this.logger.debug('Getting available features');
    return this.planManagementService.getAvailableFeatures();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get plan by ID' })
  @ApiParam({ name: 'id', description: 'Plan ID' })
  @ApiResponse({
    status: 200,
    description: 'Plan details',
    type: PlanResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async getPlanById(@Param('id') id: string): Promise<PlanResponseDto> {
    this.logger.debug('Getting plan by ID', { planId: id });
    return this.planManagementService.getPlanById(id);
  }

  @Get('key/:key')
  @ApiOperation({ summary: 'Get plan by key' })
  @ApiParam({ name: 'key', description: 'Plan key' })
  @ApiResponse({
    status: 200,
    description: 'Plan details',
    type: PlanResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async getPlanByKey(@Param('key') key: string): Promise<PlanResponseDto> {
    this.logger.debug('Getting plan by key', { key });
    return this.planManagementService.getPlanByKey(key);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new plan' })
  @ApiResponse({
    status: 201,
    description: 'Plan created successfully',
    type: PlanResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Plan key already exists' })
  @AuditLog({
    action: 'plan.create',
    category: AuditCategory.BILLING,
    severity: AuditSeverity.HIGH,
    captureRequest: true,
    captureResponse: true,
  })
  async createPlan(@Body() createPlanDto: CreatePlanDto): Promise<PlanResponseDto> {
    this.logger.debug('Creating plan', { key: createPlanDto.key });
    return this.planManagementService.createPlan(createPlanDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an existing plan' })
  @ApiParam({ name: 'id', description: 'Plan ID' })
  @ApiResponse({
    status: 200,
    description: 'Plan updated successfully',
    type: PlanResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  @AuditLog({
    action: 'plan.update',
    category: AuditCategory.BILLING,
    severity: AuditSeverity.HIGH,
    captureRequest: true,
    captureResponse: true,
  })
  async updatePlan(
    @Param('id') id: string,
    @Body() updatePlanDto: UpdatePlanDto,
  ): Promise<PlanResponseDto> {
    this.logger.debug('Updating plan', { planId: id });
    return this.planManagementService.updatePlan(id, updatePlanDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a plan (soft delete by marking inactive)' })
  @ApiParam({ name: 'id', description: 'Plan ID' })
  @ApiResponse({ status: 204, description: 'Plan deleted successfully' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete plan with active subscriptions',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuditLog({
    action: 'plan.delete',
    category: AuditCategory.BILLING,
    severity: AuditSeverity.CRITICAL,
    captureRequest: true,
  })
  async deletePlan(@Param('id') id: string): Promise<void> {
    this.logger.debug('Deleting plan', { planId: id });
    await this.planManagementService.deletePlan(id);
  }
}
