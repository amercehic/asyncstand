import { faker } from '@faker-js/faker';
import { IntegrationPlatform, TokenStatus } from '@prisma/client';

export class IntegrationFactory {
  static createMockIntegration(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: faker.string.uuid(),
      orgId: faker.string.uuid(),
      platform: IntegrationPlatform.slack,
      externalTeamId: faker.string.alphanumeric(10),
      accessToken: faker.string.alphanumeric(50),
      refreshToken: faker.string.alphanumeric(50),
      expiresAt: faker.date.future(),
      tokenStatus: TokenStatus.ok,
      scopes: ['channels:read', 'users:read', 'chat:write'],
      userScopes: ['identify'],
      installedByUserId: faker.string.uuid(),
      botToken: faker.string.alphanumeric(50),
      botUserId: faker.string.alphanumeric(10),
      appId: faker.string.alphanumeric(10),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createMockSlackChannel(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: faker.string.uuid(),
      integrationId: faker.string.uuid(),
      channelId: faker.string.alphanumeric(10),
      name: faker.lorem.word(),
      topic: faker.lorem.sentence(),
      purpose: faker.lorem.sentence(),
      isPrivate: faker.datatype.boolean(),
      isArchived: false,
      memberCount: faker.number.int({ min: 1, max: 50 }),
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSyncAt: new Date(),
      ...overrides,
    };
  }

  static createMockIntegrationUser(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: faker.string.uuid(),
      integrationId: faker.string.uuid(),
      externalUserId: faker.string.alphanumeric(10),
      name: faker.person.fullName(),
      displayName: faker.person.firstName(),
      email: faker.internet.email(),
      isBot: false,
      isDeleted: false,
      profileImage: faker.image.avatar(),
      timezone: 'America/New_York',
      platformData: {
        real_name: faker.person.fullName(),
        title: faker.person.jobTitle(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSyncAt: new Date(),
      ...overrides,
    };
  }

  static createMockSlackOAuthResponse(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      ok: true,
      access_token: faker.string.alphanumeric(50),
      token_type: 'bot',
      scope: 'channels:read,users:read,chat:write',
      bot_user_id: faker.string.alphanumeric(10),
      app_id: faker.string.alphanumeric(10),
      team: {
        id: faker.string.alphanumeric(10),
        name: faker.company.name(),
      },
      authed_user: {
        id: faker.string.alphanumeric(10),
        scope: 'identify',
        access_token: faker.string.alphanumeric(50),
        token_type: 'user',
      },
      ...overrides,
    };
  }

  static createMockSlackUsersListResponse(overrides: Partial<Record<string, unknown>> = {}) {
    const members = Array.from({ length: 5 }, () => ({
      id: faker.string.alphanumeric(10),
      name: faker.internet.userName(),
      real_name: faker.person.fullName(),
      profile: {
        email: faker.internet.email(),
        display_name: faker.person.firstName(),
        image_192: faker.image.avatar(),
        title: faker.person.jobTitle(),
        tz: 'America/New_York',
      },
      is_bot: false,
      deleted: false,
    }));

    return {
      ok: true,
      members,
      cache_ts: Date.now(),
      response_metadata: {
        next_cursor: '',
      },
      ...overrides,
    };
  }

  static createMockSlackChannelsListResponse(overrides: Partial<Record<string, unknown>> = {}) {
    const channels = Array.from({ length: 3 }, () => ({
      id: faker.string.alphanumeric(10),
      name: faker.lorem.word(),
      topic: {
        value: faker.lorem.sentence(),
      },
      purpose: {
        value: faker.lorem.sentence(),
      },
      is_private: faker.datatype.boolean(),
      is_archived: false,
      num_members: faker.number.int({ min: 1, max: 50 }),
    }));

    return {
      ok: true,
      channels,
      response_metadata: {
        next_cursor: '',
      },
      ...overrides,
    };
  }

  static createMockSlackErrorResponse(error = 'invalid_auth') {
    return {
      ok: false,
      error,
    };
  }
}