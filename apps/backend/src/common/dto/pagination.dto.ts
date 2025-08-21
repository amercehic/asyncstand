import { IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationDto {
  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Page must be a number' })
  @Min(1, { message: 'Page must be at least 1' })
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Limit must be a number' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit cannot exceed 100' })
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Sort field',
  })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @Transform(({ value }) => value?.toLowerCase())
  sortOrder?: 'asc' | 'desc' = 'desc';

  get offset(): number {
    return (this.page - 1) * this.limit;
  }

  get take(): number {
    return this.limit;
  }

  get skip(): number {
    return this.offset;
  }

  /**
   * Get Prisma orderBy object
   */
  getOrderBy(): Record<string, 'asc' | 'desc'> {
    return { [this.sortBy]: this.sortOrder };
  }
}

/**
 * Cursor-based pagination for high performance scenarios
 */
export class CursorPaginationDto {
  @ApiPropertyOptional({
    description: 'Cursor for next page (usually an ID or timestamp)',
  })
  @IsOptional()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Number of items to return',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Take must be a number' })
  @Min(1, { message: 'Take must be at least 1' })
  @Max(100, { message: 'Take cannot exceed 100' })
  take?: number = 20;

  @ApiPropertyOptional({
    description: 'Sort field for cursor',
    default: 'id',
  })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  sortBy?: string = 'id';

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @Transform(({ value }) => value?.toLowerCase())
  sortOrder?: 'asc' | 'desc' = 'desc';
}
