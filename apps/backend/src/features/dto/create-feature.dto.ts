import {
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
  Length,
  ArrayMinSize,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Prisma } from '@prisma/client';
import { FEATURES } from '@/shared/feature-constants';

export class CreateFeatureDto {
  @ApiProperty({
    description: 'Unique key identifier for the feature',
    example: 'advanced-analytics',
    enum: Object.values(FEATURES),
  })
  @IsString()
  @Length(1, 100, { message: 'Feature key must be between 1-100 characters' })
  @IsIn(Object.values(FEATURES), {
    message: `Feature key must be one of the defined constants: ${Object.values(FEATURES).join(', ')}`,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  key: string;

  @ApiProperty({
    description: 'Human-readable name for the feature',
    example: 'Advanced Analytics',
  })
  @IsString()
  @Length(1, 200, { message: 'Feature name must be between 1-200 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the feature',
    example: 'Advanced analytics and reporting capabilities',
  })
  @IsOptional()
  @IsString()
  @Length(1, 500, { message: 'Description must be between 1-500 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;

  @ApiProperty({
    description: 'Whether the feature is globally enabled',
    example: true,
  })
  @IsBoolean()
  isEnabled: boolean;

  @ApiProperty({
    description: 'List of environments where this feature is available',
    example: ['development', 'production'],
    type: [String],
    isArray: true,
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(0)
  environment: string[];

  @ApiPropertyOptional({
    description: 'Category of the feature for organization',
    example: 'analytics',
  })
  @IsOptional()
  @IsString()
  @Length(1, 50, { message: 'Category must be between 1-50 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  category?: string;

  @ApiProperty({
    description: 'Whether this feature is tied to subscription plans',
    example: false,
  })
  @IsBoolean()
  isPlanBased: boolean;

  @ApiProperty({
    description: 'Whether this feature requires admin privileges',
    example: false,
  })
  @IsBoolean()
  requiresAdmin: boolean;

  @ApiPropertyOptional({
    description: 'Type of rollout strategy (percentage, org_list, user_list)',
    example: 'percentage',
  })
  @IsOptional()
  @IsString()
  rolloutType?: string;

  @ApiPropertyOptional({
    description: 'Configuration for rollout strategy',
    example: { percentage: 50 },
  })
  @IsOptional()
  rolloutValue?: Prisma.InputJsonValue;
}
