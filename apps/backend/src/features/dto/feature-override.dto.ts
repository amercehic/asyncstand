import { IsString, IsBoolean, IsOptional, IsDateString, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateFeatureOverrideDto {
  @ApiProperty({
    description: 'Feature key to override',
    example: 'advanced-analytics',
  })
  @IsString()
  @Length(1, 100, { message: 'Feature key must be between 1-100 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  featureKey: string;

  @ApiPropertyOptional({
    description: 'Organization ID (defaults to current user org if not provided)',
    example: 'org_123456789',
  })
  @IsOptional()
  @IsString()
  orgId?: string;

  @ApiProperty({
    description: 'Whether the feature should be enabled for this organization',
    example: true,
  })
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({
    description: 'Custom value for the feature override',
    example: 'premium_tier',
  })
  @IsOptional()
  @IsString()
  @Length(1, 500, { message: 'Value must be between 1-500 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  value?: string;

  @ApiPropertyOptional({
    description: 'Reason for the override (for audit purposes)',
    example: 'Beta testing customer',
  })
  @IsOptional()
  @IsString()
  @Length(1, 500, { message: 'Reason must be between 1-500 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  reason?: string;

  @ApiPropertyOptional({
    description: 'ISO date string when this override expires',
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
