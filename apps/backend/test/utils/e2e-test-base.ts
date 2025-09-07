import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { DataIsolation } from '@/test/utils/isolation/data-isolation';
import { CleanupManager } from '@/test/utils/isolation/cleanup-manager';
import { TestDataFactory } from '@/test/factories/test-data.factory';

/**
 * Base class for E2E tests with built-in isolation and cleanup
 */
export class E2ETestBase {
  public app: INestApplication;
  public prisma: PrismaService;
  public jwtService: JwtService;
  public isolation: DataIsolation;
  public cleanup: CleanupManager;
  public factory: TestDataFactory;
  public moduleFixture: TestingModule;

  /**
   * Setup the test suite - called once before all tests
   */
  async setupSuite(): Promise<void> {
    // Create testing module
    this.moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // Initialize app
    this.app = this.moduleFixture.createNestApplication();

    // Apply the same validation configuration as main.ts
    this.app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    await this.app.init();

    // Get services
    this.prisma = this.app.get(PrismaService);
    this.jwtService = this.app.get(JwtService);
  }

  /**
   * Setup for each test - called before each test
   */
  async setupTest(): Promise<void> {
    // Create fresh isolation and cleanup for each test
    this.isolation = new DataIsolation();
    this.cleanup = new CleanupManager();
    this.factory = new TestDataFactory(this.prisma, this.isolation, this.jwtService);
  }

  /**
   * Teardown for each test - called after each test
   */
  async teardownTest(): Promise<void> {
    try {
      // Execute cleanup manager first
      await this.cleanup.executeCleanup();

      // Then run isolation cleanup
      await this.isolation.cleanup(this.prisma);
    } catch (error) {
      console.error('Test teardown error:', error);
    }
  }

  /**
   * Teardown the test suite - called once after all tests
   */
  async teardownSuite(): Promise<void> {
    try {
      // Final cleanup sweep for any remaining test data
      if (this.isolation) {
        await this.isolation.cleanup(this.prisma);
      }

      // Disconnect Prisma
      await this.prisma.$disconnect();

      // Close the app
      await this.app.close();
    } catch (error) {
      console.error('Suite teardown error:', error);
    }
  }

  /**
   * Helper to get HTTP server for supertest
   */
  getHttpServer() {
    return this.app.getHttpServer();
  }

  /**
   * Helper to create an authenticated request token
   */
  createAuthToken(userId: string, email: string, orgId?: string): string {
    return this.jwtService.sign({
      sub: userId,
      email,
      orgId,
    });
  }

  /**
   * Track an entity for cleanup
   */
  trackForCleanup(name: string, cleanupFn: () => Promise<void>): void {
    this.cleanup.addCleanup(name, cleanupFn);
  }
}
