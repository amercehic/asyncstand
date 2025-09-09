import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PlanFeatureDto {
  @ApiProperty({ description: 'Feature key' })
  @IsString()
  featureKey: string;

  @ApiProperty({ description: 'Whether the feature is enabled for this plan' })
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({ description: 'Optional value for the feature' })
  @IsOptional()
  @IsString()
  value?: string;
}

export class CreatePlanDto {
  @ApiProperty({ description: 'Unique plan key (e.g., "starter", "pro")' })
  @IsString()
  key: string;

  @ApiProperty({ description: 'Plan name (e.g., "Starter Plan")' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Display name (e.g., "Starter")' })
  @IsString()
  displayName: string;

  @ApiPropertyOptional({ description: 'Plan description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Price in cents' })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ description: 'Billing interval', default: 'month' })
  @IsOptional()
  @IsString()
  interval?: string;

  @ApiPropertyOptional({ description: 'Stripe price ID' })
  @IsOptional()
  @IsString()
  stripePriceId?: string;

  @ApiPropertyOptional({ description: 'Whether the plan is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Sort order for display', default: 0 })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Member limit (null for unlimited)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  memberLimit?: number;

  @ApiPropertyOptional({ description: 'Team limit (null for unlimited)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  teamLimit?: number;

  @ApiPropertyOptional({ description: 'Standup configuration limit (null for unlimited)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  standupConfigLimit?: number;

  @ApiPropertyOptional({ description: 'Monthly standup limit (null for unlimited)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  standupLimit?: number;

  @ApiPropertyOptional({ description: 'Storage limit in MB (null for unlimited)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  storageLimit?: number;

  @ApiPropertyOptional({ description: 'Integration limit (null for unlimited)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  integrationLimit?: number;

  @ApiPropertyOptional({ description: 'Plan features', type: [PlanFeatureDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanFeatureDto)
  features?: PlanFeatureDto[];
}

export class UpdatePlanDto {
  @ApiPropertyOptional({ description: 'Plan name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Display name' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ description: 'Plan description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Price in cents' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ description: 'Billing interval' })
  @IsOptional()
  @IsString()
  interval?: string;

  @ApiPropertyOptional({ description: 'Stripe price ID' })
  @IsOptional()
  @IsString()
  stripePriceId?: string;

  @ApiPropertyOptional({ description: 'Whether the plan is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Sort order for display' })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Member limit (null for unlimited)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  memberLimit?: number;

  @ApiPropertyOptional({ description: 'Team limit (null for unlimited)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  teamLimit?: number;

  @ApiPropertyOptional({ description: 'Standup configuration limit (null for unlimited)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  standupConfigLimit?: number;

  @ApiPropertyOptional({ description: 'Monthly standup limit (null for unlimited)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  standupLimit?: number;

  @ApiPropertyOptional({ description: 'Storage limit in MB (null for unlimited)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  storageLimit?: number;

  @ApiPropertyOptional({ description: 'Integration limit (null for unlimited)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  integrationLimit?: number;

  @ApiPropertyOptional({ description: 'Plan features', type: [PlanFeatureDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanFeatureDto)
  features?: PlanFeatureDto[];
}

export class PlanResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  key: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  price: number;

  @ApiProperty()
  interval: string;

  @ApiProperty()
  stripePriceId: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  memberLimit: number;

  @ApiProperty()
  teamLimit: number;

  @ApiProperty()
  standupConfigLimit: number;

  @ApiProperty()
  standupLimit: number;

  @ApiProperty()
  storageLimit: number;

  @ApiProperty()
  integrationLimit: number;

  @ApiProperty({ type: [PlanFeatureDto] })
  features: PlanFeatureDto[];

  @ApiProperty()
  subscriptionCount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
