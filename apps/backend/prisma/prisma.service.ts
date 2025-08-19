import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      log: [
        {
          emit: 'event',
          level: 'query',
        },
        {
          emit: 'event',
          level: 'error',
        },
        {
          emit: 'event',
          level: 'info',
        },
        {
          emit: 'event',
          level: 'warn',
        },
      ],
      errorFormat: 'colorless',
    });

    // Performance monitoring for slow queries
    this.$on('query' as never, (e: any) => {
      const duration = e.duration;

      if (duration > 1000) {
        this.logger.error(`🐌 SLOW QUERY (${duration}ms): ${e.query}`, {
          query: e.query,
          params: e.params,
          duration,
          target: e.target,
          timestamp: new Date().toISOString(),
        });
      } else if (duration > 500) {
        this.logger.warn(`⚠️ Slow query (${duration}ms): ${e.query.substring(0, 100)}...`, {
          duration,
          target: e.target,
        });
      } else if (process.env.NODE_ENV === 'development') {
        this.logger.debug(`Query (${duration}ms): ${e.query.substring(0, 100)}...`);
      }
    });

    // Error logging
    this.$on('error' as never, (e: any) => {
      this.logger.error('Prisma error:', e);
    });

    // Info and warn logging
    this.$on('info' as never, (e: any) => {
      this.logger.log('Prisma info:', e);
    });

    this.$on('warn' as never, (e: any) => {
      this.logger.warn('Prisma warning:', e);
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Database connected successfully');

      // Test the connection
      await this.$queryRaw`SELECT 1`;
      this.logger.log('✅ Database connection test passed');
    } catch (error) {
      this.logger.error('❌ Failed to connect to database:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('Database disconnected');
    } catch (error) {
      this.logger.error('Error disconnecting from database:', error);
    }
  }

  /**
   * Health check for database connection
   */
  async healthCheck(): Promise<{ status: string; timestamp: Date }> {
    try {
      await this.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Database health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get database metrics for monitoring
   */
  async getDatabaseMetrics(): Promise<{
    activeConnections?: number;
    maxConnections?: number;
    version?: string;
  }> {
    try {
      // Get PostgreSQL version
      const versionResult = await this.$queryRaw<[{ version: string }]>`SELECT version()`;
      const version = versionResult[0]?.version;

      // Get connection stats (PostgreSQL specific)
      const connectionStats = await this.$queryRaw<
        [
          {
            active_connections: number;
            max_connections: number;
          },
        ]
      >`
        SELECT 
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
          (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
      `;

      return {
        activeConnections: connectionStats[0]?.active_connections || 0,
        maxConnections: connectionStats[0]?.max_connections || 0,
        version: version?.split(' ')[0] || 'unknown',
      };
    } catch (error) {
      this.logger.error('Failed to get database metrics:', error);
      return {};
    }
  }

  /**
   * Execute queries with performance tracking
   */
  async executeWithPerformanceTracking<T>(
    queryName: string,
    queryFn: () => Promise<T>,
  ): Promise<T> {
    const start = Date.now();

    try {
      const result = await queryFn();
      const duration = Date.now() - start;

      if (duration > 1000) {
        this.logger.error(`🐌 SLOW OPERATION: ${queryName} took ${duration}ms`);
      } else if (duration > 500) {
        this.logger.warn(`⚠️ Slow operation: ${queryName} took ${duration}ms`);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.logger.error(`❌ Query failed: ${queryName} (${duration}ms)`, error);
      throw error;
    }
  }
}
