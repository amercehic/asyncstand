import { faker } from '@faker-js/faker';

export class StandupConfigFactory {
  static createMockStandupConfig(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: faker.string.uuid(),
      teamId: faker.string.uuid(),
      questions: [
        'What did you accomplish yesterday?',
        'What will you work on today?',
        'Are there any blockers or impediments?',
      ],
      weekdays: [1, 2, 3, 4, 5], // Monday to Friday
      timeLocal: '09:00',
      timezone: 'America/New_York',
      reminderMinutesBefore: 15,
      responseTimeoutHours: 2,
      isActive: true,
      createdByUserId: faker.string.uuid(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createMockStandupConfigMember(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      standupConfigId: faker.string.uuid(),
      teamMemberId: faker.string.uuid(),
      include: true,
      role: 'member',
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createMockCreateStandupConfigDto(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      questions: [
        'What did you accomplish yesterday?',
        'What will you work on today?',
        'Are there any blockers or impediments?',
      ],
      weekdays: [1, 2, 3, 4, 5],
      timeLocal: '09:00',
      timezone: 'America/New_York',
      reminderMinutesBefore: 15,
      responseTimeoutHours: 2,
      isActive: true,
      ...overrides,
    };
  }

  static createMockUpdateStandupConfigDto(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      questions: [
        'What did you complete since the last standup?',
        'What are you focusing on next?',
        'What support do you need from the team?',
      ],
      weekdays: [1, 2, 3, 4],
      timeLocal: '10:00',
      timezone: 'America/Los_Angeles',
      reminderMinutesBefore: 30,
      responseTimeoutHours: 4,
      isActive: false,
      ...overrides,
    };
  }

  static createMockUpdateMemberParticipationDto(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      include: true,
      role: 'lead',
      ...overrides,
    };
  }

  static createMockBulkUpdateParticipationDto(memberCount = 3, overrides: Partial<Record<string, unknown>> = {}) {
    const members = Array.from({ length: memberCount }, (_, index) => ({
      teamMemberId: faker.string.uuid(),
      include: index < 2, // First 2 members included, last one excluded
      role: index === 0 ? 'lead' : 'member',
    }));

    return {
      members,
      ...overrides,
    };
  }

  static createMockStandupConfigResponse(overrides: Partial<Record<string, unknown>> = {}) {
    const config = this.createMockStandupConfig(overrides);
    const memberParticipation = Array.from({ length: 5 }, (_, index) => ({
      teamMember: {
        id: faker.string.uuid(),
        name: `Member ${index + 1}`,
        platformUserId: faker.string.alphanumeric(10),
      },
      include: index < 4, // 4 out of 5 members participate
      role: index === 0 ? 'lead' : 'member',
    }));

    return {
      ...config,
      team: {
        id: config.teamId,
        name: faker.company.name(),
        channelName: faker.lorem.word(),
      },
      memberParticipation,
    };
  }

  static createMockPreviewResponse(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      schedule: {
        weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        timeLocal: '09:00',
        timezone: 'America/New_York',
        nextStandup: faker.date.future(),
      },
      questions: [
        'What did you accomplish yesterday?',
        'What will you work on today?',
        'Are there any blockers or impediments?',
      ],
      participatingMembers: 4,
      totalMembers: 5,
      reminderSettings: {
        minutesBefore: 15,
        timeoutHours: 2,
      },
      ...overrides,
    };
  }

  static createMockStandupConfigWithMembers(memberCount = 5, overrides: Partial<Record<string, unknown>> = {}) {
    const config = this.createMockStandupConfig(overrides);
    const configMembers = Array.from({ length: memberCount }, (_, index) =>
      this.createMockStandupConfigMember({
        standupConfigId: config.id,
        teamMemberId: faker.string.uuid(),
        include: index < memberCount - 1, // All but last member participate
        role: index === 0 ? 'lead' : 'member',
      }),
    );

    return {
      ...config,
      configMembers: configMembers.map(cm => ({
        ...cm,
        teamMember: {
          id: cm.teamMemberId,
          name: `Member ${configMembers.indexOf(cm) + 1}`,
          platformUserId: faker.string.alphanumeric(10),
          user: {
            name: `User ${configMembers.indexOf(cm) + 1}`,
          },
          integrationUser: null,
        },
      })),
    };
  }

  static createValidQuestions(count = 3): string[] {
    const baseQuestions = [
      'What did you accomplish yesterday?',
      'What will you work on today?',
      'Are there any blockers or impediments?',
      'What are you focusing on next?',
      'What support do you need from the team?',
      'Any wins or learnings to share?',
      'What progress did you make toward your goals?',
      'What obstacles are blocking your progress?',
      'What went well since the last standup?',
      'What could have gone better?',
    ];

    return baseQuestions.slice(0, count);
  }

  static createInvalidQuestions(): string[] {
    return [
      'Too short', // < 10 characters
      'This is a valid question that meets the minimum length requirement',
      '', // Empty
      'A'.repeat(201), // > 200 characters
    ];
  }

  static createValidWeekdays(): number[] {
    return [1, 2, 3, 4, 5]; // Monday to Friday
  }

  static createInvalidWeekdays(): number[] {
    return [7, 8, -1]; // Invalid weekday numbers
  }

  static createValidTimezones(): string[] {
    return ['America/New_York', 'Europe/London', 'Asia/Tokyo', 'UTC'];
  }

  static createInvalidTimezones(): string[] {
    return ['Invalid/Timezone', 'EST', 'PDT'];
  }
}