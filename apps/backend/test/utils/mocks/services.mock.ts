import { TestHelpers } from '@/test/utils/test-helpers';

// Mock JwtService
export const createMockJwtService = () => ({
  sign: jest.fn().mockReturnValue('mock_jwt_token'),
  verify: jest.fn().mockReturnValue({
    sub: TestHelpers.generateRandomString(),
    orgId: TestHelpers.generateRandomString(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 900,
  }),
  decode: jest.fn().mockReturnValue({}),
});

// Mock LoggerService
export const createMockLoggerService = () => ({
  setContext: jest.fn(),
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  logError: jest.fn(),
});

// Mock AuditLogService
export const createMockAuditLogService = () => ({
  log: jest.fn().mockResolvedValue(undefined),
  logWithTransaction: jest.fn().mockResolvedValue(undefined),
});

// Mock UserUtilsService
export const createMockUserUtilsService = () => ({
  hashPassword: jest.fn().mockResolvedValue('hashed_password_123'),
  validatePassword: jest.fn().mockResolvedValue(true),
  generateRandomPassword: jest.fn().mockReturnValue('RandomPass123!'),
});

// Mock TokenService
export const createMockTokenService = () => ({
  generateTokens: jest.fn().mockResolvedValue({
    accessToken: 'mock_access_token',
    refreshToken: 'mock_refresh_token',
    expiresIn: 900,
  }),
  revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
  revokeAllUserTokens: jest.fn().mockResolvedValue(undefined),
  validateRefreshToken: jest.fn().mockResolvedValue(true),
});

// Mock UserService
export const createMockUserService = () => ({
  createUserWithOrganization: jest.fn().mockResolvedValue(TestHelpers.createMockUser()),
  createUserWithNewOrganization: jest.fn().mockResolvedValue({
    user: TestHelpers.createMockUser(),
    org: TestHelpers.createMockOrganization(),
  }),
  addUserToOrganization: jest.fn().mockResolvedValue(TestHelpers.createMockUser()),
});

// Mock AuthService
export const createMockAuthService = () => ({
  signup: jest.fn().mockResolvedValue(TestHelpers.createMockUser()),
  login: jest.fn().mockResolvedValue({
    accessToken: 'mock_access_token',
    refreshToken: 'mock_refresh_token',
    expiresIn: 900,
    user: TestHelpers.createMockUser(),
    organizations: [TestHelpers.createMockOrganization()],
  }),
  logout: jest.fn().mockResolvedValue({ success: true }),
  acceptInvite: jest.fn().mockResolvedValue({
    accessToken: 'mock_access_token',
    refreshToken: 'mock_refresh_token',
    expiresIn: 900,
    user: TestHelpers.createMockUser(),
    organization: TestHelpers.createMockOrganization(),
  }),
});

// Mock OrgMembersService
export const createMockOrgMembersService = () => ({
  listMembers: jest.fn().mockResolvedValue({
    members: [
      {
        id: TestHelpers.generateRandomString(),
        email: TestHelpers.generateRandomEmail(),
        name: 'Test User',
        role: 'member',
        status: 'active',
        joinedAt: new Date(),
      },
    ],
  }),
  inviteMember: jest.fn().mockResolvedValue({
    message: 'Invitation sent successfully',
    invitedEmail: TestHelpers.generateRandomEmail(),
    inviteToken: 'mock_invite_token',
  }),
  updateMember: jest.fn().mockResolvedValue({
    message: 'Member updated successfully',
    member: {
      id: TestHelpers.generateRandomString(),
      email: TestHelpers.generateRandomEmail(),
      role: 'member',
      status: 'active',
    },
  }),
  deleteMember: jest.fn().mockResolvedValue({
    message: 'Member deleted successfully',
  }),
});

// Mock PasswordResetService
export const createMockPasswordResetService = () => ({
  requestPasswordReset: jest.fn().mockResolvedValue(undefined),
  resetPassword: jest.fn().mockResolvedValue(undefined),
  validateResetToken: jest.fn().mockResolvedValue(true),
});

// Mock CacheService
export const createMockCacheService = () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  invalidate: jest.fn().mockResolvedValue(undefined),
  buildKey: jest.fn().mockReturnValue('mock_cache_key'),
  getOrSet: jest.fn().mockImplementation((_key, fallback) => fallback()),
  increment: jest.fn().mockResolvedValue(1),
  exists: jest.fn().mockResolvedValue(false),
  getStats: jest.fn().mockResolvedValue({ memory: '10MB', keys: 100 }),
});

// Mock RedisService
export const createMockRedisService = () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  keys: jest.fn().mockResolvedValue([]),
  incr: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
  exists: jest.fn().mockResolvedValue(0),
  dbsize: jest.fn().mockResolvedValue(100),
  info: jest.fn().mockResolvedValue('used_memory_human:10MB'),
  flushdb: jest.fn().mockResolvedValue('OK'),
});

// Mock SecurityMonitorService
export const createMockSecurityMonitorService = () => ({
  recordEvent: jest.fn().mockResolvedValue(undefined),
  checkForSuspiciousActivity: jest.fn().mockResolvedValue(false),
  getSecurityMetrics: jest.fn().mockResolvedValue({
    totalEvents: 0,
    eventsByType: {},
    eventsBySeverity: {},
    alertsGenerated: 0,
  }),
  cleanup: jest.fn().mockResolvedValue(undefined),
});

// Mock RateLimitService
export const createMockRateLimitService = () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ allowed: true, resetTime: Date.now() }),
  recordViolation: jest.fn().mockResolvedValue(undefined),
  getRemainingRequests: jest.fn().mockResolvedValue(100),
});

// Mock CsrfService
export const createMockCsrfService = () => ({
  generateToken: jest.fn().mockReturnValue('mock_csrf_token'),
  validateToken: jest.fn().mockResolvedValue(true),
  getTokenFromRequest: jest.fn().mockReturnValue('mock_csrf_token'),
  invalidateToken: jest.fn().mockResolvedValue(undefined),
});

// Helper to reset all mocks
export const resetAllMocks = (...mocks: Record<string, unknown>[]): void => {
  mocks.forEach((mock) => {
    if (mock && typeof mock === 'object') {
      Object.values(mock).forEach((method) => {
        if (jest.isMockFunction(method)) {
          method.mockClear();
        }
      });
    }
  });
};
