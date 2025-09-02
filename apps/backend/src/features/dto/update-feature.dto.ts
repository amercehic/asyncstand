import { IsString, IsBoolean, IsOptional, IsArray, Length, ArrayMinSize } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Prisma } from '@prisma/client';

export class UpdateFeatureDto {
  @ApiPropertyOptional({
    description: 'Human-readable name for the feature',
    example: 'Updated Advanced Analytics',
  })
  @IsOptional()
  @IsString()
  @Length(1, 200, { message: 'Feature name must be between 1-200 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the feature',
    example: 'Updated advanced analytics and reporting capabilities',
  })
  @IsOptional()
  @IsString()
  @Length(1, 500, { message: 'Description must be between 1-500 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether the feature is globally enabled',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'List of environments where this feature is available',
    example: ['development', 'staging', 'production'],
    type: [String],
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(0)
  environment?: string[];

  @ApiPropertyOptional({
    description: 'Category of the feature for organization',
    example: 'analytics',
  })
  @IsOptional()
  @IsString()
  @Length(1, 50, { message: 'Category must be between 1-50 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  category?: string;

  @ApiPropertyOptional({
    description: 'Whether this feature is tied to subscription plans',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isPlanBased?: boolean;

  @ApiPropertyOptional({
    description: 'Whether this feature requires admin privileges',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  requiresAdmin?: boolean;

  @ApiPropertyOptional({
    description: 'Type of rollout strategy (percentage, org_list, user_list)',
    example: 'percentage',
  })
  @IsOptional()
  @IsString()
  rolloutType?: string;

  @ApiPropertyOptional({
    description: 'Configuration for rollout strategy',
    example: { percentage: 75 },
  })
  @IsOptional()
  rolloutValue?: Prisma.InputJsonValue;
}
