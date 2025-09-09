/**
 * Mock utilities for Slack API responses
 */
export class SlackMockService {
  private testPrefix: string;

  constructor(testPrefix: string) {
    this.testPrefix = testPrefix;
  }

  /**
   * Generate mock Slack channels response
   */
  getMockChannels() {
    return {
      ok: true,
      channels: [
        {
          id: `C${this.testPrefix}_1`,
          name: `${this.testPrefix}-general`,
          is_channel: true,
          is_private: false,
          is_archived: false,
          topic: { value: 'General discussion' },
          purpose: { value: 'Company-wide announcements' },
          num_members: 5,
        },
        {
          id: `C${this.testPrefix}_2`,
          name: `${this.testPrefix}-dev`,
          is_channel: true,
          is_private: false,
          is_archived: false,
          topic: { value: 'Development team chat' },
          purpose: { value: 'Development discussions' },
          num_members: 3,
        },
      ],
    };
  }

  /**
   * Generate mock Slack users response
   */
  getMockUsers() {
    return {
      ok: true,
      members: [
        {
          id: `U${this.testPrefix}_1`,
          name: `${this.testPrefix}_user1`,
          deleted: false,
          is_bot: false,
          is_app_user: false,
          profile: {
            real_name: 'Test User 1',
            display_name: `${this.testPrefix}_user1`,
            email: `${this.testPrefix}_user1@example.com`,
            image_192: 'https://example.com/avatar1.jpg',
          },
          tz: 'America/New_York',
        },
        {
          id: `U${this.testPrefix}_2`,
          name: `${this.testPrefix}_user2`,
          deleted: false,
          is_bot: false,
          is_app_user: false,
          profile: {
            real_name: 'Test User 2',
            display_name: `${this.testPrefix}_user2`,
            email: `${this.testPrefix}_user2@example.com`,
            image_192: 'https://example.com/avatar2.jpg',
          },
          tz: 'America/Los_Angeles',
        },
      ],
    };
  }

  /**
   * Generate mock channel info response
   */
  getMockChannelInfo(channelId?: string) {
    return {
      ok: true,
      channel: {
        id: channelId || `C${this.testPrefix}_1`,
        name: `${this.testPrefix}-general`,
        is_channel: true,
        is_private: false,
        is_archived: false,
        topic: { value: 'General discussion' },
        purpose: { value: 'Company-wide announcements' },
        num_members: 5,
      },
    };
  }

  /**
   * Generate mock user info response
   */
  getMockUserInfo(userId?: string) {
    return {
      ok: true,
      user: {
        id: userId || `U${this.testPrefix}_1`,
        name: `${this.testPrefix}_user1`,
        profile: {
          real_name: 'Test User',
          display_name: 'Test User',
          email: `${this.testPrefix}_user@example.com`,
        },
      },
    };
  }

  /**
   * Generate mock post message response
   */
  getMockPostMessage() {
    return {
      ok: true,
      ts: Date.now().toString(),
      channel: `C${this.testPrefix}_1`,
      message: {
        text: 'Test message',
        ts: Date.now().toString(),
        user: `U${this.testPrefix}_bot`,
      },
    };
  }

  /**
   * Setup global fetch mock for Slack APIs
   */
  setupMockFetch(): jest.Mock {
    const mockFetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('slack.com/api/conversations.info')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(this.getMockChannelInfo()),
        });
      }
      if (url.includes('slack.com/api/users.info')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(this.getMockUserInfo()),
        });
      }
      if (url.includes('slack.com/api/conversations.list')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(this.getMockChannels()),
        });
      }
      if (url.includes('slack.com/api/users.list')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(this.getMockUsers()),
        });
      }
      if (url.includes('slack.com/api/chat.postMessage')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(this.getMockPostMessage()),
        });
      }

      // Default response for unknown endpoints
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      });
    });

    return mockFetch;
  }
}
