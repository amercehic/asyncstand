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
