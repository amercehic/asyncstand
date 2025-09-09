import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '@/auth/services/auth.service';
import { UserService } from '@/auth/services/user.service';
import { TokenService } from '@/auth/services/token.service';
import { UserUtilsService } from '@/auth/services/user-utils.service';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { LoggerService } from '@/common/logger.service';
import { SessionIdentifierService } from '@/common/session/session-identifier.service';
import { SessionCleanupService } from '@/common/session/session-cleanup.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as argon2 from '@node-rs/argon2';
import { DataIsolation } from '@/test/utils/isolation/data-isolation';

describe('Auth Integration', () => {
  let authService: AuthService;
  let prisma: PrismaService;
  let module: TestingModule;
  let isolation: DataIsolation;

  beforeAll(async () => {
    isolation = new DataIsolation();
    module = await Test.createTestingModule({
      providers: [
        AuthService,
        UserService,
        TokenService,
        UserUtilsService,
        PrismaService,
        {
          provide: LoggerService,
          useValue: {
            setContext: jest.fn(),
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
            debug: jest.fn(),
          },
        },
        {
          provide: SessionIdentifierService,
          useValue: {
            extractSessionId: jest.fn().mockReturnValue('test-session-id'),
            getAllSessionIds: jest.fn().mockReturnValue(['test-session-id']),
            getSessionContext: jest.fn().mockReturnValue({
              sessionId: 'test-session-id',
              source: 'test',
              isAuthenticated: false,
            }),
          },
        },
        {
          provide: SessionCleanupService,
          useValue: {
            cleanupSession: jest.fn().mockResolvedValue(undefined),
            cleanupSessions: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
            verify: jest.fn().mockReturnValue({ sub: 'user-id', orgId: 'org-id' }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                JWT_SECRET: 'test-secret',
                JWT_EXPIRES_IN: '1h',
                JWT_REFRESH_EXPIRES_IN: '7d',
              };
              return config[key];
            }),
          },
        },
        // Mock AuditLogService to avoid complex dependencies
        {
          provide: AuditLogService,
          useValue: {
            log: jest.fn().mockResolvedValue(undefined),
            logWithTransaction: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await module.close();
  });

  afterEach(async () => {
    // Clean up test data using proper isolation
    await isolation.cleanup(prisma);
  });

  describe('User Registration and Login Flow', () => {
    it('should register a new user and allow login', async () => {
      const signupData = {
        email: isolation.generateEmail('integration-test'),
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
      };

      // Register user
      const registeredUser = await authService.signup(
        signupData.email,
        signupData.password,
        `${signupData.firstName} ${signupData.lastName}`,
      );
      expect(registeredUser).toBeDefined();
      expect(registeredUser.email).toBe(signupData.email);
      expect(registeredUser.name).toBe(`${signupData.firstName} ${signupData.lastName}`);

      // Verify user exists in database
      const dbUser = await prisma.user.findUnique({
        where: { email: signupData.email },
      });
      expect(dbUser).toBeDefined();
      expect(dbUser.email).toBe(signupData.email);

      // Login with the registered user (need request object for IP)
      const mockRequest = { ip: '127.0.0.1' } as Request;
      const loginResult = await authService.login(
        signupData.email,
        signupData.password,
        mockRequest,
      );

      expect(loginResult).toBeDefined();
      expect(loginResult.accessToken).toBeDefined();
      expect(loginResult.refreshToken).toBeDefined();
      expect(loginResult.user.email).toBe(signupData.email);
    });

    it('should hash password correctly during registration', async () => {
      const signupData = {
        email: isolation.generateEmail('hash-test'),
        password: 'TestPassword123!',
        firstName: 'Hash',
        lastName: 'Test',
      };

      await authService.signup(
        signupData.email,
        signupData.password,
        `${signupData.firstName} ${signupData.lastName}`,
      );

      // Get user from database and verify password is hashed
      const dbUser = await prisma.user.findUnique({
        where: { email: signupData.email },
      });

      expect(dbUser).toBeDefined();
      expect(dbUser.passwordHash).toBeDefined();
      expect(dbUser.passwordHash).not.toBe(signupData.password);

      // Verify password can be verified
      const isValidPassword = await argon2.verify(dbUser.passwordHash, signupData.password);
      expect(isValidPassword).toBe(true);
    });

    it('should prevent duplicate email registration', async () => {
      const signupData = {
        email: isolation.generateEmail('duplicate-test'),
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
      };

      // Register user first time
      await authService.signup(
        signupData.email,
        signupData.password,
        `${signupData.firstName} ${signupData.lastName}`,
      );

      // Try to register with same email
      await expect(
        authService.signup(
          signupData.email,
          signupData.password,
          `${signupData.firstName} ${signupData.lastName}`,
        ),
      ).rejects.toThrow();
    });

    it('should fail login with incorrect password', async () => {
      const signupData = {
        email: isolation.generateEmail('login-fail-test'),
        password: 'CorrectPassword123!',
        firstName: 'Test',
        lastName: 'User',
      };

      await authService.signup(
        signupData.email,
        signupData.password,
        `${signupData.firstName} ${signupData.lastName}`,
      );

      // Try to login with wrong password
      const mockRequest = { ip: '127.0.0.1' } as Request;
      await expect(
        authService.login(signupData.email, 'WrongPassword123!', mockRequest),
      ).rejects.toThrow();
    });
  });
});
