import { faker } from '@faker-js/faker';

export class TeamFactory {
  static createMockTeam(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: faker.string.uuid(),
      orgId: faker.string.uuid(),
      integrationId: faker.string.uuid(),
      name: faker.company.name(),
      timezone: 'America/New_York',
      createdByUserId: faker.string.uuid(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createMockTeamMember(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: faker.string.uuid(),
      teamId: faker.string.uuid(),
      platformUserId: faker.string.alphanumeric(10),
      integrationUserId: faker.string.uuid(),
      userId: faker.string.uuid(),
      name: faker.person.fullName(),
      active: true,
      addedByUserId: faker.string.uuid(),
      addedAt: new Date(),
      ...overrides,
    };
  }

  static createMockCreateTeamDto(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      name: faker.company.name(),
      integrationId: faker.string.uuid(),
      timezone: 'America/New_York',
      description: faker.lorem.sentence(),
      ...overrides,
    };
  }

  static createMockUpdateTeamDto(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      name: faker.company.name(),
      timezone: 'America/Los_Angeles',
      description: faker.lorem.sentence(),
      ...overrides,
    };
  }

  static createMockAddTeamMemberDto(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      slackUserId: faker.string.alphanumeric(10),
      ...overrides,
    };
  }

  static createMockTeamWithMembers(
    memberCount = 3,
    overrides: Partial<Record<string, unknown>> = {},
  ) {
    const team = this.createMockTeam(overrides);
    const members = Array.from({ length: memberCount }, (_, index) =>
      this.createMockTeamMember({
        teamId: team.id,
        name: `Member ${index + 1}`,
      }),
    );

    return {
      ...team,
      members,
    };
  }

  static createMockTeamListResponse(teamCount = 5) {
    const teams = Array.from({ length: teamCount }, () => ({
      id: faker.string.uuid(),
      name: faker.company.name(),
      channelName: faker.lorem.word(),
      memberCount: faker.number.int({ min: 1, max: 20 }),
      createdAt: new Date(),
    }));

    return {
      teams,
      total: teamCount,
    };
  }

  static createMockTeamDetailsResponse(overrides: Partial<Record<string, unknown>> = {}) {
    const team = this.createMockTeam(overrides);
    const members = Array.from({ length: 5 }, (_, index) => ({
      id: faker.string.uuid(),
      name: `Member ${index + 1}`,
      platformUserId: faker.string.alphanumeric(10),
      active: true,
      addedAt: new Date(),
    }));

    return {
      id: team.id,
      name: team.name,
      description: faker.lorem.sentence(),
      timezone: team.timezone,
      channelName: faker.lorem.word(),
      members,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    };
  }

  static createMockAvailableChannelsResponse(channelCount = 10) {
    const channels = Array.from({ length: channelCount }, () => ({
      id: faker.string.alphanumeric(10),
      name: faker.lorem.word(),
      isPrivate: faker.datatype.boolean(),
      memberCount: faker.number.int({ min: 1, max: 100 }),
      hasBot: faker.datatype.boolean(),
    }));

    return { channels };
  }

  static createMockAvailableMembersResponse(memberCount = 20) {
    const members = Array.from({ length: memberCount }, () => ({
      id: faker.string.alphanumeric(10),
      name: faker.person.fullName(),
      displayName: faker.person.firstName(),
      email: faker.internet.email(),
      profileImage: faker.image.avatar(),
    }));

    return { members };
  }
}
