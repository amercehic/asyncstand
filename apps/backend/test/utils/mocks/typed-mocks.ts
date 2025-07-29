import { UserService } from '@/auth/services/user.service';
import { TokenService } from '@/auth/services/token.service';
import { UserUtilsService } from '@/auth/services/user-utils.service';
import { LoggerService } from '@/common/logger.service';
import { JwtService } from '@nestjs/jwt';

/**
 * Type helper to create properly typed Jest mocks
 */
export type MockedService<T> = {
  [K in keyof T]: T[K] extends (...args: unknown[]) => unknown ? jest.MockedFunction<T[K]> : T[K];
};

/**
 * Create a typed mock for any service
 */
export function createMockService<T>(): MockedService<T> {
  return {} as MockedService<T>;
}

/**
 * Create mock AuthService with commonly used methods
 */
export function createMockAuthService() {
  return {
    signup: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    acceptInvite: jest.fn(),
  };
}

/**
 * Create mock UserService with commonly used methods
 */
export function createMockUserService(): MockedService<UserService> {
  return {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getUserOrganizations: jest.fn(),
  } as unknown as MockedService<UserService>;
}

/**
 * Create mock TokenService with commonly used methods
 */
export function createMockTokenService(): MockedService<TokenService> {
  return {
    generateTokens: jest.fn(),
    revokeRefreshToken: jest.fn(),
    revokeAllUserTokens: jest.fn(),
    validateRefreshToken: jest.fn(),
  } as unknown as MockedService<TokenService>;
}

/**
 * Create mock UserUtilsService with commonly used methods
 */
export function createMockUserUtilsService(): MockedService<UserUtilsService> {
  return {
    validatePassword: jest.fn(),
    hashPassword: jest.fn(),
    generateSalt: jest.fn(),
    isValidEmail: jest.fn(),
  } as unknown as MockedService<UserUtilsService>;
}

/**
 * Create mock AuditLogService with commonly used methods
 */
export function createMockAuditLogService() {
  return {
    log: jest.fn(),
    logUserAction: jest.fn(),
    logSystemEvent: jest.fn(),
    logSecurityEvent: jest.fn(),
    getAuditLogs: jest.fn(),
  };
}

/**
 * Create mock LoggerService with commonly used methods
 */
export function createMockLoggerService(): MockedService<LoggerService> {
  return {
    setContext: jest.fn(),
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    logError: jest.fn(),
    logUserAction: jest.fn(),
  } as unknown as MockedService<LoggerService>;
}

/**
 * Create mock JwtService with commonly used methods
 */
export function createMockJwtService(): MockedService<JwtService> {
  return {
    sign: jest.fn(),
    signAsync: jest.fn(),
    verify: jest.fn(),
    verifyAsync: jest.fn(),
    decode: jest.fn(),
  } as unknown as MockedService<JwtService>;
}

/**
 * Create comprehensive mock for PrismaService
 */
export function createMockPrismaService() {
  const mockFindMany = jest.fn();
  const mockFindUnique = jest.fn();
  const mockFindFirst = jest.fn();
  const mockCreate = jest.fn();
  const mockCreateMany = jest.fn();
  const mockUpdate = jest.fn();
  const mockUpdateMany = jest.fn();
  const mockUpsert = jest.fn();
  const mockDelete = jest.fn();
  const mockDeleteMany = jest.fn();
  const mockCount = jest.fn();
  const mockAggregate = jest.fn();
  const mockGroupBy = jest.fn();

  const createModelMock = () => ({
    findMany: mockFindMany,
    findUnique: mockFindUnique,
    findFirst: mockFindFirst,
    create: mockCreate,
    createMany: mockCreateMany,
    update: mockUpdate,
    updateMany: mockUpdateMany,
    upsert: mockUpsert,
    delete: mockDelete,
    deleteMany: mockDeleteMany,
    count: mockCount,
    aggregate: mockAggregate,
    groupBy: mockGroupBy,
  });

  return {
    // Models
    user: createModelMock(),
    organization: createModelMock(),
    orgMember: createModelMock(),
    refreshToken: createModelMock(),
    passwordResetToken: createModelMock(),
    auditLog: createModelMock(),
    session: createModelMock(),

    // Transaction methods
    $transaction: jest.fn(),
    $executeRaw: jest.fn(),
    $queryRaw: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),

    // Expose individual mocks for direct access
    mocks: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      findFirst: mockFindFirst,
      create: mockCreate,
      createMany: mockCreateMany,
      update: mockUpdate,
      updateMany: mockUpdateMany,
      upsert: mockUpsert,
      delete: mockDelete,
      deleteMany: mockDeleteMany,
      count: mockCount,
      aggregate: mockAggregate,
      groupBy: mockGroupBy,
    },
  };
}

/**
 * Reset all mocks in a service
 */
export function resetMockService<T>(mockService: MockedService<T>): void {
  Object.values(mockService).forEach((method) => {
    if (jest.isMockFunction(method)) {
      method.mockReset();
    }
  });
}

/**
 * Clear all mocks in a service (keeps implementation but clears call history)
 */
export function clearMockService<T>(mockService: MockedService<T>): void {
  Object.values(mockService).forEach((method) => {
    if (jest.isMockFunction(method)) {
      method.mockClear();
    }
  });
}
