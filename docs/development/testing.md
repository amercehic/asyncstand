# Testing Strategy

Comprehensive guide to testing in AsyncStand, covering unit, integration, and end-to-end testing.

## Testing Philosophy

AsyncStand follows a **test pyramid** approach with emphasis on:

1. **Fast feedback loops** - Quick unit tests for immediate validation
2. **Realistic scenarios** - Integration tests with real database interactions
3. **User workflows** - E2E tests covering complete user journeys
4. **Maintainable tests** - Clear, readable tests that serve as documentation

## Test Architecture

```
                    E2E Tests
                   (Fewer, Slower)
                 /               \
            Integration Tests
           (Medium, Moderate)
          /                    \
    Unit Tests                 Unit Tests
  (Many, Fast)              (Frontend/Backend)
```

### Test Categories

| Type | Scope | Speed | Database | Purpose |
|------|-------|-------|----------|---------|
| **Unit** | Single function/component | Fast (ms) | Mocked | Logic validation |
| **Integration** | Service interactions | Medium (100ms) | Test DB | Data flow validation |
| **E2E** | Complete workflows | Slow (seconds) | Test DB | User journey validation |

## Backend Testing

### Test Structure

```
apps/backend/test/
├── unit/                   # Isolated unit tests
│   ├── auth/
│   │   ├── services/
│   │   │   ├── auth.service.test.ts
│   │   │   ├── user.service.test.ts
│   │   │   └── token.service.test.ts
│   │   ├── controllers/
│   │   │   ├── auth.controller.test.ts
│   │   │   └── organization.controller.test.ts
│   │   └── guards/
│   │       ├── jwt-auth.guard.test.ts
│   │       └── roles.guard.test.ts
│   └── common/
│       └── audit/
│           └── audit-log.service.test.ts
├── integration/            # Service integration tests
│   └── auth/
│       └── auth-flow.integration.test.ts
├── e2e/                   # End-to-end API tests
│   ├── auth.e2e.test.ts
│   ├── teams.e2e.test.ts
│   └── organizations.e2e.test.ts
├── utils/                 # Test utilities
│   ├── factories/         # Data factories
│   │   ├── user.factory.ts
│   │   ├── organization.factory.ts
│   │   └── team.factory.ts
│   ├── fixtures/          # Static test data
│   ├── mocks/             # Service mocks
│   │   ├── prisma.mock.ts
│   │   └── services.mock.ts
│   └── helpers/           # Test helpers
│       ├── auth-helpers.ts
│       ├── database-helpers.ts
│       └── test-helpers.ts
└── setup/                 # Jest configuration
    ├── jest.setup.ts
    ├── integration-setup.ts
    └── integration-teardown.ts
```

### Unit Testing

#### Service Testing

**Example: AuthService unit test**

```typescript
// auth.service.test.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '@/auth/services/auth.service';
import { PrismaService } from '@/prisma/prisma.service';
import { TokenService } from '@/auth/services/token.service';
import { createMockPrisma, createMockTokenService } from '@/test/utils/mocks';
import { createSignupDto, createMockUser } from '@/test/utils/factories';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let tokenService: jest.Mocked<TokenService>;

  beforeEach(async () => {
    const mockPrisma = createMockPrisma();
    const mockTokenService = createMockTokenService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TokenService, useValue: mockTokenService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    tokenService = module.get(TokenService);
  });

  describe('signup', () => {
    it('should create a new user with valid data', async () => {
      // Arrange
      const signupDto = createSignupDto({
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: 'Test User',
      });
      
      const mockUser = createMockUser({ email: signupDto.email });
      const mockTokens = { accessToken: 'token', refreshToken: 'refresh' };

      prisma.user.findUnique.mockResolvedValue(null); // Email not taken
      prisma.user.create.mockResolvedValue(mockUser);
      tokenService.generateTokens.mockReturnValue(mockTokens);

      // Act
      const result = await service.signup(signupDto);

      // Assert
      expect(result.user.email).toBe(signupDto.email);
      expect(result.tokens).toEqual(mockTokens);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: signupDto.email,
          name: signupDto.name,
        }),
      });
    });

    it('should throw ConflictException when email already exists', async () => {
      // Arrange
      const signupDto = createSignupDto();
      const existingUser = createMockUser({ email: signupDto.email });

      prisma.user.findUnique.mockResolvedValue(existingUser);

      // Act & Assert
      await expect(service.signup(signupDto)).rejects.toThrow(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should hash password before storing', async () => {
      // Arrange
      const signupDto = createSignupDto({ password: 'plaintext' });
      
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(createMockUser());

      // Act
      await service.signup(signupDto);

      // Assert
      const createCall = prisma.user.create.mock.calls[0][0];
      expect(createCall.data.passwordHash).not.toBe('plaintext');
      expect(createCall.data.passwordHash).toMatch(/^\$argon2/); // Argon2 hash format
    });
  });

  describe('login', () => {
    it('should return tokens for valid credentials', async () => {
      // Arrange
      const loginDto = { email: 'test@example.com', password: 'correct' };
      const mockUser = createMockUser({
        email: loginDto.email,
        passwordHash: await hashPassword(loginDto.password),
      });
      const mockTokens = { accessToken: 'token', refreshToken: 'refresh' };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      tokenService.generateTokens.mockReturnValue(mockTokens);

      // Act
      const result = await service.login(loginDto);

      // Assert
      expect(result.user.email).toBe(loginDto.email);
      expect(result.tokens).toEqual(mockTokens);
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      // Arrange
      const loginDto = { email: 'test@example.com', password: 'wrong' };
      const mockUser = createMockUser({
        email: loginDto.email,
        passwordHash: await hashPassword('correct'),
      });

      prisma.user.findUnique.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });
});
```

#### Controller Testing

**Example: AuthController unit test**

```typescript
// auth.controller.test.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '@/auth/controllers/auth.controller';
import { AuthService } from '@/auth/services/auth.service';
import { createMockAuthService } from '@/test/utils/mocks';
import { createSignupDto, createLoginDto } from '@/test/utils/factories';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const mockAuthService = createMockAuthService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  describe('signup', () => {
    it('should call AuthService.signup with correct parameters', async () => {
      // Arrange
      const signupDto = createSignupDto();
      const mockResult = {
        user: { id: '1', email: signupDto.email, name: signupDto.name },
        tokens: { accessToken: 'token', refreshToken: 'refresh' },
      };

      authService.signup.mockResolvedValue(mockResult);

      // Act
      const result = await controller.signup(signupDto);

      // Assert
      expect(authService.signup).toHaveBeenCalledWith(signupDto);
      expect(result).toEqual(mockResult);
    });
  });

  describe('login', () => {
    it('should call AuthService.login with correct parameters', async () => {
      // Arrange
      const loginDto = createLoginDto();
      const mockResult = {
        user: { id: '1', email: loginDto.email },
        tokens: { accessToken: 'token', refreshToken: 'refresh' },
      };

      authService.login.mockResolvedValue(mockResult);

      // Act
      const result = await controller.login(loginDto);

      // Assert
      expect(authService.login).toHaveBeenCalledWith(loginDto);
      expect(result).toEqual(mockResult);
    });
  });
});
```

### Integration Testing

Integration tests verify service interactions with real database connections.

**Example: Auth flow integration test**

```typescript
// auth-flow.integration.test.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthService } from '@/auth/services/auth.service';
import { cleanupDatabase, createTestUser } from '@/test/utils/database-helpers';

describe('Auth Flow Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);
    authService = app.get<AuthService>(AuthService);

    await app.init();
  });

  beforeEach(async () => {
    await cleanupDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('User Registration Flow', () => {
    it('should create user, organization, and audit log', async () => {
      // Arrange
      const signupData = {
        email: 'integration@example.com',
        password: 'SecurePass123!',
        name: 'Integration Test User',
      };

      // Act
      const result = await authService.signup(signupData);

      // Assert - User created
      expect(result.user.email).toBe(signupData.email);
      expect(result.tokens.accessToken).toBeDefined();

      // Assert - Database state
      const user = await prisma.user.findUnique({
        where: { email: signupData.email },
        include: {
          orgMembers: {
            include: { org: true },
          },
        },
      });

      expect(user).toBeDefined();
      expect(user.orgMembers).toHaveLength(1);
      expect(user.orgMembers[0].role).toBe('owner');
      expect(user.orgMembers[0].status).toBe('active');

      // Assert - Audit log created
      const auditLogs = await prisma.auditLog.findMany({
        where: { actorUserId: user.id },
      });

      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].action).toBe('user.signup');
      expect(auditLogs[0].category).toBe('auth');
    });

    it('should handle duplicate email registration', async () => {
      // Arrange
      const email = 'duplicate@example.com';
      await createTestUser({ email });

      const signupData = {
        email,
        password: 'SecurePass123!',
        name: 'Duplicate User',
      };

      // Act & Assert
      await expect(authService.signup(signupData)).rejects.toThrow(
        'Email already exists'
      );

      // Verify no additional user created
      const users = await prisma.user.findMany({ where: { email } });
      expect(users).toHaveLength(1);
    });
  });

  describe('Authentication Flow', () => {
    it('should authenticate user and create session', async () => {
      // Arrange
      const password = 'SecurePass123!';
      const user = await createTestUser({ password });

      // Act
      const result = await authService.login({
        email: user.email,
        password,
      });

      // Assert
      expect(result.user.id).toBe(user.id);
      expect(result.tokens.accessToken).toBeDefined();

      // Check session created
      const sessions = await prisma.session.findMany({
        where: { userId: user.id },
      });

      expect(sessions).toHaveLength(1);
      expect(sessions[0].revokedAt).toBeNull();
    });

    it('should create refresh token with proper expiration', async () => {
      // Arrange
      const user = await createTestUser();

      // Act
      const result = await authService.login({
        email: user.email,
        password: 'SecurePass123!',
      });

      // Assert
      const refreshTokens = await prisma.refreshToken.findMany({
        where: { userId: user.id },
      });

      expect(refreshTokens).toHaveLength(1);
      expect(refreshTokens[0].revokedAt).toBeNull();
      expect(refreshTokens[0].fingerprint).toBeDefined();
    });
  });

  describe('Organization Management', () => {
    it('should allow user to create additional organization', async () => {
      // Arrange
      const user = await createTestUser();

      // Act
      const org = await authService.createOrganization(user.id, {
        name: 'Second Organization',
      });

      // Assert
      expect(org.name).toBe('Second Organization');

      // Check user has multiple org memberships
      const userWithOrgs = await prisma.user.findUnique({
        where: { id: user.id },
        include: { orgMembers: true },
      });

      expect(userWithOrgs.orgMembers).toHaveLength(2);
    });
  });
});
```

### End-to-End Testing

E2E tests verify complete API workflows with HTTP requests.

**Example: Authentication E2E test**

```typescript
// auth.e2e.test.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { cleanupDatabase } from '@/test/utils/database-helpers';

describe('Authentication (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);

    await app.init();
  });

  beforeEach(async () => {
    await cleanupDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/signup', () => {
    it('should register new user successfully', async () => {
      const signupData = {
        email: 'e2e@example.com',
        password: 'SecurePass123!',
        name: 'E2E Test User',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send(signupData)
        .expect(201);

      expect(response.body.user.email).toBe(signupData.email);
      expect(response.body.user.name).toBe(signupData.name);
      expect(response.body.tokens.accessToken).toBeDefined();
      expect(response.body.tokens.refreshToken).toBeDefined();

      // Verify password is not returned
      expect(response.body.user.passwordHash).toBeUndefined();
    });

    it('should return 400 for invalid email', async () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'SecurePass123!',
        name: 'Test User',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send(invalidData)
        .expect(400);

      expect(response.body.message).toContain('email must be a valid email');
    });

    it('should return 400 for weak password', async () => {
      const weakPasswordData = {
        email: 'test@example.com',
        password: '123',
        name: 'Test User',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send(weakPasswordData)
        .expect(400);

      expect(response.body.message).toContain('password must be at least 8 characters');
    });

    it('should return 409 for duplicate email', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'SecurePass123!',
        name: 'First User',
      };

      // First registration
      await request(app.getHttpServer())
        .post('/auth/signup')
        .send(userData)
        .expect(201);

      // Duplicate registration
      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ ...userData, name: 'Second User' })
        .expect(409);

      expect(response.body.message).toContain('Email already exists');
    });
  });

  describe('POST /auth/login', () => {
    let userCredentials: { email: string; password: string };

    beforeEach(async () => {
      userCredentials = {
        email: 'login@example.com',
        password: 'SecurePass123!',
      };

      // Create user for login tests
      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          ...userCredentials,
          name: 'Login Test User',
        })
        .expect(201);
    });

    it('should login with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userCredentials)
        .expect(200);

      expect(response.body.user.email).toBe(userCredentials.email);
      expect(response.body.tokens.accessToken).toBeDefined();
      expect(response.body.tokens.refreshToken).toBeDefined();
    });

    it('should return 401 for invalid email', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: userCredentials.password,
        })
        .expect(401);

      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should return 401 for invalid password', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: userCredentials.email,
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body.message).toBe('Invalid credentials');
    });
  });

  describe('Protected Routes', () => {
    let accessToken: string;
    let userId: string;

    beforeEach(async () => {
      // Create user and get token
      const signupResponse = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'protected@example.com',
          password: 'SecurePass123!',
          name: 'Protected Test User',
        })
        .expect(201);

      accessToken = signupResponse.body.tokens.accessToken;
      userId = signupResponse.body.user.id;
    });

    it('should access protected route with valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(userId);
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer())
        .get('/auth/profile')
        .expect(401);
    });

    it('should return 401 with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('Refresh Token Flow', () => {
    let refreshToken: string;
    let accessToken: string;

    beforeEach(async () => {
      const signupResponse = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'refresh@example.com',
          password: 'SecurePass123!',
          name: 'Refresh Test User',
        })
        .expect(201);

      refreshToken = signupResponse.body.tokens.refreshToken;
      accessToken = signupResponse.body.tokens.accessToken;
    });

    it('should refresh tokens successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.tokens.accessToken).toBeDefined();
      expect(response.body.tokens.refreshToken).toBeDefined();
      expect(response.body.tokens.accessToken).not.toBe(accessToken);
    });

    it('should return 401 for invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-refresh-token' })
        .expect(401);
    });
  });
});
```

## Test Utilities & Helpers

### Data Factories

**User Factory:**

```typescript
// test/utils/factories/user.factory.ts
import { User } from '@prisma/client';
import { hashPassword } from '@/auth/utils/password.util';

export interface CreateUserOptions {
  email?: string;
  password?: string;
  name?: string;
  passwordHash?: string;
}

export function createUserData(options: CreateUserOptions = {}): Partial<User> {
  return {
    email: options.email || `user-${Date.now()}@example.com`,
    name: options.name || 'Test User',
    passwordHash: options.passwordHash || hashPassword(options.password || 'DefaultPass123!'),
  };
}

export async function createTestUser(
  prisma: PrismaService,
  options: CreateUserOptions = {}
): Promise<User> {
  const userData = createUserData(options);
  return prisma.user.create({ data: userData });
}
```

**Organization Factory:**

```typescript
// test/utils/factories/organization.factory.ts
import { Organization, OrgMember } from '@prisma/client';

export interface CreateOrganizationOptions {
  name?: string;
  ownerId?: string;
}

export async function createTestOrganization(
  prisma: PrismaService,
  options: CreateOrganizationOptions = {}
): Promise<Organization & { members: OrgMember[] }> {
  const org = await prisma.organization.create({
    data: {
      name: options.name || `Test Org ${Date.now()}`,
    },
  });

  if (options.ownerId) {
    await prisma.orgMember.create({
      data: {
        orgId: org.id,
        userId: options.ownerId,
        role: 'owner',
        status: 'active',
      },
    });
  }

  return prisma.organization.findUnique({
    where: { id: org.id },
    include: { members: true },
  });
}
```

### Mock Services

**Prisma Mock:**

```typescript
// test/utils/mocks/prisma.mock.ts
export function createMockPrisma() {
  return {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    orgMember: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
    $disconnect: jest.fn(),
  };
}
```

### Database Helpers

**Cleanup Utilities:**

```typescript
// test/utils/database-helpers.ts
import { PrismaService } from '@/prisma/prisma.service';

export async function cleanupDatabase(prisma: PrismaService): Promise<void> {
  // Clean up in reverse dependency order
  await prisma.auditLog.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.orgMember.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.team.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
}

export async function createDatabaseSnapshot(prisma: PrismaService) {
  // Create transaction savepoint for rollback
  return prisma.$executeRaw`SAVEPOINT test_snapshot`;
}

export async function restoreDatabaseSnapshot(prisma: PrismaService) {
  // Rollback to savepoint
  return prisma.$executeRaw`ROLLBACK TO test_snapshot`;
}
```

## Test Configuration

### Jest Configuration

**Main Jest Config (`jest.config.js`):**

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/test/setup/jest.setup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  projects: [
    '<rootDir>/test/configs/jest.unit.config.js',
    '<rootDir>/test/configs/jest.integration.config.js',
    '<rootDir>/test/configs/jest.e2e.config.js',
  ],
};
```

**Unit Test Config:**

```javascript
// test/configs/jest.unit.config.js
module.exports = {
  displayName: 'Unit Tests',
  testMatch: ['<rootDir>/test/unit/**/*.test.ts'],
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/test/setup/jest.setup.ts'],
};
```

**Integration Test Config:**

```javascript
// test/configs/jest.integration.config.js
module.exports = {
  displayName: 'Integration Tests',
  testMatch: ['<rootDir>/test/integration/**/*.test.ts'],
  testEnvironment: 'node',
  setupFilesAfterEnv: [
    '<rootDir>/test/setup/jest.setup.ts',
    '<rootDir>/test/setup/integration-setup.ts',
  ],
  globalTeardown: '<rootDir>/test/setup/integration-teardown.ts',
  testTimeout: 30000,
};
```

### Test Environment Setup

**Jest Setup (`test/setup/jest.setup.ts`):**

```typescript
import { config } from 'dotenv';
import { join } from 'path';

// Load test environment variables
config({ path: join(process.cwd(), '.env.test') });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

// Mock external services
jest.mock('@/common/redis.service');
jest.mock('@/integrations/slack/slack-api.service');

// Global test timeout
jest.setTimeout(30000);
```

**Integration Setup:**

```typescript
// test/setup/integration-setup.ts
import { Test } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';

let prisma: PrismaService;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  prisma = moduleRef.get<PrismaService>(PrismaService);

  // Ensure test database is clean
  await cleanupDatabase(prisma);
});

afterAll(async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
});
```

## Test Execution

### Running Tests

```bash
# All tests
pnpm test

# Specific test types
pnpm test:unit
pnpm test:integration
pnpm test:e2e

# Watch mode (unit tests only)
pnpm test:watch

# Coverage reports
pnpm test:coverage
pnpm test:coverage:all

# Specific test files
pnpm test auth.service.test.ts
pnpm test --testNamePattern="should create user"

# Debug mode
pnpm test --detectOpenHandles --verbose

# CI mode
pnpm test:ci
```

### Test Organization by Feature

```bash
# Authentication tests
pnpm test auth

# Team management tests
pnpm test teams

# Organization tests
pnpm test organizations

# Integration tests
pnpm test integrations
```

## Continuous Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: asyncstand_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:6
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run database migrations
        run: |
          cd apps/backend
          pnpm db:migrate
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/asyncstand_test

      - name: Run unit tests
        run: pnpm test:unit
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/asyncstand_test
          REDIS_URL: redis://localhost:6379

      - name: Run integration tests
        run: pnpm test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/asyncstand_test
          REDIS_URL: redis://localhost:6379

      - name: Run E2E tests
        run: pnpm test:e2e
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/asyncstand_test
          REDIS_URL: redis://localhost:6379

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

## Test Quality & Best Practices

### Test Quality Metrics

**Coverage Targets:**
- **Unit Tests**: 90%+ line coverage
- **Integration Tests**: 80%+ branch coverage
- **E2E Tests**: 70%+ user journey coverage

**Performance Targets:**
- **Unit Tests**: < 10ms per test
- **Integration Tests**: < 100ms per test
- **E2E Tests**: < 5s per test

### Writing Effective Tests

#### Good Test Characteristics

1. **Fast**: Quick feedback loop
2. **Independent**: No dependencies between tests
3. **Repeatable**: Same results every time
4. **Self-Validating**: Clear pass/fail result
5. **Timely**: Written with or before code

#### Test Naming Convention

```typescript
// Pattern: should_[expected_behavior]_when_[state_under_test]
describe('AuthService', () => {
  describe('signup', () => {
    it('should_create_user_and_organization_when_valid_data_provided', () => {});
    it('should_throw_ConflictException_when_email_already_exists', () => {});
    it('should_hash_password_when_storing_user', () => {});
  });
});
```

#### Arrange-Act-Assert Pattern

```typescript
it('should create user successfully', async () => {
  // Arrange - Set up test data and mocks
  const signupDto = createSignupDto();
  prisma.user.findUnique.mockResolvedValue(null);

  // Act - Execute the functionality
  const result = await authService.signup(signupDto);

  // Assert - Verify the results
  expect(result.user.email).toBe(signupDto.email);
  expect(prisma.user.create).toHaveBeenCalled();
});
```

### Common Testing Pitfalls

#### Avoid These Anti-Patterns

1. **Testing Implementation Details**
   ```typescript
   // Bad - testing private methods
   expect(service['hashPassword']).toHaveBeenCalled();
   
   // Good - testing public behavior
   expect(result.user.passwordHash).not.toBe(plainPassword);
   ```

2. **Brittle Tests**
   ```typescript
   // Bad - depends on exact order
   expect(prisma.user.create).toHaveBeenNthCalledWith(1, ...);
   
   // Good - focuses on important calls
   expect(prisma.user.create).toHaveBeenCalledWith(
     expect.objectContaining({ data: expect.any(Object) })
   );
   ```

3. **Excessive Mocking**
   ```typescript
   // Bad - mocking everything
   jest.mock('@/every/single/dependency');
   
   // Good - mock external dependencies only
   jest.mock('@/external/slack-api');
   ```

4. **Shared Test State**
   ```typescript
   // Bad - shared state between tests
   let globalUser;
   beforeAll(() => { globalUser = createUser(); });
   
   // Good - fresh state per test
   beforeEach(() => { cleanupDatabase(); });
   ```

### Performance Testing

For performance-critical operations, include performance assertions:

```typescript
it('should handle bulk user creation efficiently', async () => {
  const start = Date.now();
  
  await authService.bulkCreateUsers(1000);
  
  const duration = Date.now() - start;
  expect(duration).toBeLessThan(5000); // 5 seconds max
});
```

---

This comprehensive testing strategy ensures AsyncStand maintains high quality, reliability, and performance across all components while providing fast feedback to developers. 