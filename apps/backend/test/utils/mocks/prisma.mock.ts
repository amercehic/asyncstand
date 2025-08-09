import { TestHelpers } from '@/test/utils/test-helpers';

export type MockPrismaService = {
  user: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    deleteMany: jest.Mock;
  };
  organization: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    deleteMany: jest.Mock;
  };
  orgMember: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    upsert: jest.Mock;
    delete: jest.Mock;
    deleteMany: jest.Mock;
  };
  refreshToken: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    delete: jest.Mock;
    deleteMany: jest.Mock;
  };
  passwordResetToken: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    deleteMany: jest.Mock;
  };
  integration: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    deleteMany: jest.Mock;
  };
  auditLog: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    deleteMany: jest.Mock;
  };
  team: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    deleteMany: jest.Mock;
    count: jest.Mock;
  };
  teamMember: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    delete: jest.Mock;
    deleteMany: jest.Mock;
    count: jest.Mock;
    groupBy: jest.Mock;
  };
  standupConfig: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    deleteMany: jest.Mock;
  };
  standupConfigMember: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    upsert: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    deleteMany: jest.Mock;
  };
  channel: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    deleteMany: jest.Mock;
  };
  integrationUser: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    deleteMany: jest.Mock;
  };
  integrationSyncState: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    upsert: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    deleteMany: jest.Mock;
  };
  $transaction: jest.Mock;
  $disconnect: jest.Mock;
  $executeRaw: jest.Mock;
  $queryRaw: jest.Mock;
  $queryRawUnsafe: jest.Mock;
};

export const createMockPrismaService = (): MockPrismaService => {
  const mockUser = TestHelpers.createMockUser();
  const mockOrg = TestHelpers.createMockOrganization();

  return {
    user: {
      create: jest.fn().mockResolvedValue(mockUser),
      findUnique: jest.fn().mockResolvedValue(mockUser),
      findMany: jest.fn().mockResolvedValue([mockUser]),
      update: jest.fn().mockResolvedValue(mockUser),
      delete: jest.fn().mockResolvedValue(mockUser),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    organization: {
      create: jest.fn().mockResolvedValue(mockOrg),
      findUnique: jest.fn().mockResolvedValue(mockOrg),
      findMany: jest.fn().mockResolvedValue([mockOrg]),
      update: jest.fn().mockResolvedValue(mockOrg),
      delete: jest.fn().mockResolvedValue(mockOrg),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    orgMember: {
      create: jest.fn().mockResolvedValue({
        id: TestHelpers.generateRandomString(),
        orgId: mockOrg.id,
        userId: mockUser.id,
        role: 'member',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      findUnique: jest.fn().mockResolvedValue({
        id: TestHelpers.generateRandomString(),
        orgId: mockOrg.id,
        userId: mockUser.id,
        role: 'member',
        status: 'active',
        user: mockUser,
        org: mockOrg,
      }),
      findFirst: jest.fn().mockResolvedValue({
        id: TestHelpers.generateRandomString(),
        orgId: mockOrg.id,
        userId: mockUser.id,
        role: 'member',
        status: 'active',
        user: mockUser,
        org: mockOrg,
      }),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      upsert: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    refreshToken: {
      create: jest.fn().mockResolvedValue({
        id: TestHelpers.generateRandomString(),
        token: 'mock_refresh_token',
        userId: mockUser.id,
        ipAddress: '127.0.0.1',
        fingerprint: 'test_fingerprint',
        createdAt: new Date(),
        revokedAt: null,
      }),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      delete: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    passwordResetToken: {
      create: jest.fn().mockResolvedValue({
        id: TestHelpers.generateRandomString(),
        token: 'mock_reset_token',
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        usedAt: null,
      }),
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    integration: {
      create: jest.fn().mockResolvedValue({
        id: TestHelpers.generateRandomString(),
        orgId: mockOrg.id,
        platform: 'slack',
        externalTeamId: 'T123456789',
        accessToken: 'encrypted_token',
        refreshToken: 'encrypted_refresh',
        tokenStatus: 'ok',
        scopes: ['chat:write'],
        createdAt: new Date(),
      }),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({
        id: TestHelpers.generateRandomString(),
        orgId: mockOrg.id,
        actorUserId: mockUser.id,
        action: 'test.action',
        category: 'test',
        severity: 'low',
        createdAt: new Date(),
      }),
      findUnique: jest.fn().mockResolvedValue({
        id: TestHelpers.generateRandomString(),
        orgId: mockOrg.id,
        actorUserId: mockUser.id,
        action: 'test.action',
        category: 'test',
        severity: 'low',
        createdAt: new Date(),
      }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    team: {
      create: jest.fn().mockResolvedValue({
        id: TestHelpers.generateRandomString(),
        orgId: mockOrg.id,
        name: 'Test Team',
        integrationId: TestHelpers.generateRandomString(),
        channelId: TestHelpers.generateRandomString(),
        slackChannelId: 'C123456789',
        timezone: 'America/New_York',
        createdByUserId: mockUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(0),
    },
    teamMember: {
      create: jest.fn().mockResolvedValue({
        id: TestHelpers.generateRandomString(),
        teamId: TestHelpers.generateRandomString(),
        integrationUserId: TestHelpers.generateRandomString(),
        platformUserId: 'U123456789',
        name: 'Test Member',
        active: true,
        addedByUserId: mockUser.id,
        addedAt: new Date(),
        removedAt: null,
      }),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      delete: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    standupConfig: {
      create: jest.fn().mockResolvedValue({
        id: TestHelpers.generateRandomString(),
        teamId: TestHelpers.generateRandomString(),
        questions: ['What did you work on?', 'What will you work on?', 'Any blockers?'],
        weekdays: [1, 2, 3, 4, 5],
        timeLocal: '09:00',
        timezone: 'America/New_York',
        reminderMinutesBefore: 15,
        responseTimeoutHours: 2,
        isActive: true,
        createdByUserId: mockUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    standupConfigMember: {
      create: jest.fn().mockResolvedValue({
        standupConfigId: TestHelpers.generateRandomString(),
        teamMemberId: TestHelpers.generateRandomString(),
        include: true,
        role: 'member',
        updatedAt: new Date(),
      }),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    channel: {
      create: jest.fn().mockResolvedValue({
        id: TestHelpers.generateRandomString(),
        integrationId: TestHelpers.generateRandomString(),
        channelId: 'C123456789',
        name: 'test-channel',
        topic: 'Test channel topic',
        purpose: 'Test channel purpose',
        isPrivate: false,
        isArchived: false,
        memberCount: 5,
        lastSyncAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    integrationUser: {
      create: jest.fn().mockResolvedValue({
        id: TestHelpers.generateRandomString(),
        integrationId: TestHelpers.generateRandomString(),
        externalUserId: 'U123456789',
        name: 'Test User',
        displayName: 'Test User',
        email: 'test@example.com',
        isBot: false,
        isDeleted: false,
        profileImage: 'https://example.com/avatar.jpg',
        timezone: 'America/New_York',
        platformData: {},
        lastSyncAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    integrationSyncState: {
      create: jest.fn().mockResolvedValue({
        id: TestHelpers.generateRandomString(),
        integrationId: TestHelpers.generateRandomString(),
        lastSyncAt: new Date(),
        errorMsg: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn().mockImplementation(async (callback) => {
      if (typeof callback === 'function') {
        return callback(createMockPrismaService());
      }
      return callback;
    }),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $executeRaw: jest.fn().mockResolvedValue([{ id: TestHelpers.generateRandomString() }]),
    $queryRaw: jest.fn().mockResolvedValue([]),
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ decrypted: 'decrypted-token' }]),
  };
};

export const resetMockPrismaService = (mockPrisma: MockPrismaService): void => {
  Object.values(mockPrisma).forEach((model) => {
    if (typeof model === 'object' && model !== null) {
      Object.values(model).forEach((method) => {
        if (jest.isMockFunction(method)) {
          method.mockClear();
        }
      });
    }
  });
};
