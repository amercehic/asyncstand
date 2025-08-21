import { ApiProperty } from '@nestjs/swagger';

export interface PaginationMeta {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface CursorPaginatedResult<T> {
  data: T[];
  meta: {
    hasNext: boolean;
    hasPrev: boolean;
    nextCursor?: string;
    prevCursor?: string;
    count: number;
  };
}

/**
 * Generic paginated response class for Swagger documentation
 */
export class PaginatedResponseDto<T> {
  @ApiProperty({ isArray: true })
  data: T[];

  @ApiProperty({
    description: 'Pagination metadata',
    example: {
      page: 1,
      limit: 20,
      totalCount: 100,
      totalPages: 5,
      hasNext: true,
      hasPrev: false,
    },
  })
  meta: PaginationMeta;
}

/**
 * Utility class to create paginated responses
 */
export class PaginationHelper {
  static createPaginatedResult<T>(
    data: T[],
    totalCount: number,
    page: number,
    limit: number,
  ): PaginatedResult<T> {
    const totalPages = Math.ceil(totalCount / limit);

    return {
      data,
      meta: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  static createCursorPaginatedResult<T>(
    data: T[],
    hasMore: boolean,
    getCursor: (item: T) => string,
    sortOrder: 'asc' | 'desc' = 'desc',
  ): CursorPaginatedResult<T> {
    const hasNext = hasMore;
    const hasPrev = data.length > 0; // Simplified - would need proper implementation

    let nextCursor: string | undefined;
    let prevCursor: string | undefined;

    if (data.length > 0) {
      if (sortOrder === 'desc') {
        nextCursor = hasMore ? getCursor(data[data.length - 1]) : undefined;
        prevCursor = getCursor(data[0]);
      } else {
        nextCursor = hasMore ? getCursor(data[data.length - 1]) : undefined;
        prevCursor = getCursor(data[0]);
      }
    }

    return {
      data,
      meta: {
        hasNext,
        hasPrev,
        nextCursor,
        prevCursor,
        count: data.length,
      },
    };
  }
}

/**
 * Prisma pagination helper for common query patterns
 */
export class PrismaPaginationHelper {
  static getPaginationQuery(
    page: number,
    limit: number,
    sortBy: string = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
  ) {
    return {
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    };
  }

  static getCursorPaginationQuery(
    cursor: string | undefined,
    take: number,
    sortBy: string = 'id',
    sortOrder: 'asc' | 'desc' = 'desc',
  ) {
    const query: Record<string, unknown> = {
      take: take + 1, // Take one extra to check if there are more items
      orderBy: { [sortBy]: sortOrder },
    };

    if (cursor) {
      query.cursor = { [sortBy]: cursor };
      query.skip = 1; // Skip the cursor item itself
    }

    return query;
  }
}
