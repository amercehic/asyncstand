import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Block } from '@slack/web-api';
import { SlackMessageFormatterService } from '@/integrations/slack/slack-message-formatter.service';
import { AnswerCollectionService } from '@/standups/answer-collection.service';

interface SlackSectionBlock extends Block {
  type: 'section';
  text: {
    type: string;
    text: string;
  };
}

interface SlackActionsBlock extends Block {
  type: 'actions';
  elements: Array<{
    type: string;
    text?: { type: string; text: string };
    style?: string;
    action_id?: string;
    value?: string;
  }>;
}

describe('SlackMessageFormatterService', () => {
  let service: SlackMessageFormatterService;
  let mockAnswerCollectionService: jest.Mocked<AnswerCollectionService>;
  let mockConfigService: jest.Mocked<ConfigService>;

  const mockInstance = {
    id: 'instance-123',
    targetDate: new Date('2024-01-15T10:00:00Z'),
    state: 'collecting',
    configSnapshot: {
      questions: [
        'What did you work on yesterday?',
        'What will you work on today?',
        'Any blockers or help needed?',
      ],
      responseTimeoutHours: 2,
      participatingMembers: [
        { id: 'member1', name: 'John Doe', platformUserId: 'U123456' },
        { id: 'member2', name: 'Jane Smith', platformUserId: 'U789012' },
      ],
    },
    team: {
      name: 'Engineering Team',
    },
  };

  const mockMemberAnswers = [
    {
      teamMemberId: 'member1',
      memberName: 'John Doe',
      answers: [
        { questionIndex: 0, answer: 'Worked on user authentication' },
        { questionIndex: 1, answer: 'Will work on API documentation' },
        { questionIndex: 2, answer: 'No blockers' },
      ],
      isComplete: true,
    },
    {
      teamMemberId: 'member2',
      memberName: 'Jane Smith',
      answers: [
        { questionIndex: 0, answer: 'Fixed frontend bugs' },
        { questionIndex: 1, answer: 'Will start on dashboard UI' },
      ],
      isComplete: false,
    },
  ];

  const mockParticipation = {
    totalMembers: 2,
    respondedMembers: 1,
    responseRate: 50,
    missingMembers: ['Jane Smith'],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlackMessageFormatterService,
        {
          provide: AnswerCollectionService,
          useValue: {
            generateMagicTokensForInstance: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('http://localhost:3000'),
          },
        },
      ],
    }).compile();

    service = module.get<SlackMessageFormatterService>(SlackMessageFormatterService);
    mockAnswerCollectionService = module.get(AnswerCollectionService);
    mockConfigService = module.get(ConfigService);
  });

  describe('formatStandupReminder', () => {
    it('should format standup reminder correctly', () => {
      const result = service.formatStandupReminder(mockInstance, 'Test Team');

      expect(result.text).toBe('🌅 Daily Standup Time - Test Team');
      expect(result.blocks).toBeDefined();
      expect(result.blocks).toHaveLength(6);

      // Check header block
      expect(result.blocks[0]).toEqual({
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🌅 Daily Standup Time - Test Team',
        },
      });

      // Check questions section
      expect(result.blocks[2]).toEqual({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '1. What did you work on yesterday?\n2. What will you work on today?\n3. Any blockers or help needed?',
        },
      });

      // Check action buttons
      const actionsBlock = result.blocks[4] as { type: string; elements: unknown[] };
      expect(actionsBlock.type).toBe('actions');
      expect(actionsBlock.elements).toHaveLength(2);
      expect(actionsBlock.elements[0]).toMatchObject({
        type: 'button',
        text: { type: 'plain_text', text: '📝 Submit Response' },
        style: 'primary',
        action_id: 'submit_standup_response',
        value: 'instance-123',
      });
      expect(actionsBlock.elements[1]).toMatchObject({
        type: 'button',
        text: { type: 'plain_text', text: '⏭️ Skip Today' },
        action_id: 'skip_standup',
        value: 'instance-123',
      });
    });

    it('should handle timeout hours correctly in deadline text', () => {
      const instanceWithDifferentTimeout = {
        ...mockInstance,
        configSnapshot: {
          ...mockInstance.configSnapshot,
          responseTimeoutHours: 4,
        },
      };

      const result = service.formatStandupReminder(instanceWithDifferentTimeout, 'Test Team');

      const timelineBlock = result.blocks[3] as { text: { text: string } };
      expect(timelineBlock.text.text).toContain('4 hours remaining');
    });
  });

  describe('formatStandupSummary', () => {
    it('should format standup summary correctly with responses', () => {
      const result = service.formatStandupSummary(
        mockInstance,
        mockMemberAnswers,
        mockParticipation,
        'Test Team',
      );

      expect(result.text).toBe('📊 Daily Standup Summary - Monday, January 15, 2024');
      expect(result.blocks).toBeDefined();

      // Check header
      expect(result.blocks[0]).toEqual({
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📊 Daily Standup Summary',
        },
      });

      // Check participation stats
      expect((result.blocks[1] as { text: { text: string } }).text.text).toContain(
        'Team: Test Team | Participation: 1/2 members (50%)',
      );

      // Should have divider before responses
      expect(result.blocks[2]).toEqual({ type: 'divider' });

      // Check questions and answers are formatted
      const questionBlocks = result.blocks.filter(
        (block) =>
          block.type === 'section' &&
          (block as { text?: { text?: string } }).text?.text?.includes(
            'What did you work on yesterday?',
          ),
      );
      expect(questionBlocks).toHaveLength(1);
    });

    it('should handle missing responses correctly', () => {
      const result = service.formatStandupSummary(
        mockInstance,
        mockMemberAnswers,
        mockParticipation,
        'Test Team',
      );

      // Should include missing members section
      const missingBlock = result.blocks.find((block) =>
        (block as { text?: { text?: string } }).text?.text?.includes('Missing Responses:'),
      );
      expect(missingBlock).toBeDefined();
    });

    it('should handle empty responses correctly', () => {
      const emptyParticipation = {
        totalMembers: 2,
        respondedMembers: 0,
        responseRate: 0,
        missingMembers: ['John Doe', 'Jane Smith'],
      };

      const result = service.formatStandupSummary(
        mockInstance,
        [],
        emptyParticipation,
        'Test Team',
      );

      expect((result.blocks[1] as { text: { text: string } }).text.text).toContain(
        'Participation: 0/2 members (0%)',
      );

      // Should not have responses section but should have missing members
      const missingBlock = result.blocks.find((block) =>
        (block as { text?: { text?: string } }).text?.text?.includes('Missing Responses:'),
      );
      expect(missingBlock).toBeDefined();
    });

    it('should format next standup date correctly', () => {
      const result = service.formatStandupSummary(
        mockInstance,
        mockMemberAnswers,
        mockParticipation,
        'Test Team',
      );

      const contextBlock = result.blocks[result.blocks.length - 1] as {
        type: string;
        elements: { text: string }[];
      };
      expect(contextBlock.type).toBe('context');
      expect(contextBlock.elements[0].text).toContain('Next standup: Tuesday, Jan 16');
    });
  });

  describe('createResponseModal', () => {
    it('should create response modal correctly', () => {
      const questions = ['Question 1', 'Question 2'];
      const result = service.createResponseModal('instance-123', questions, 'U123456');

      expect(result).toEqual({
        type: 'modal',
        callback_id: 'standup_response_instance-123',
        title: {
          type: 'plain_text',
          text: 'Daily Standup',
        },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'Please answer the following standup questions:',
            },
          },
          {
            type: 'input',
            block_id: 'question_0',
            element: {
              type: 'plain_text_input',
              action_id: 'answer_0',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: 'Enter your response...',
              },
            },
            label: {
              type: 'plain_text',
              text: '1. Question 1',
            },
          },
          {
            type: 'input',
            block_id: 'question_1',
            element: {
              type: 'plain_text_input',
              action_id: 'answer_1',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: 'Enter your response...',
              },
            },
            label: {
              type: 'plain_text',
              text: '2. Question 2',
            },
          },
        ],
        submit: {
          type: 'plain_text',
          text: 'Submit',
        },
        close: {
          type: 'plain_text',
          text: 'Cancel',
        },
      });
    });

    it('should handle empty questions array', () => {
      const result = service.createResponseModal('instance-123', [], 'U123456');

      expect(result.blocks).toHaveLength(1); // Only the instruction section
      expect((result.blocks[0] as { text: { text: string } }).text.text).toBe(
        'Please answer the following standup questions:',
      );
    });

    it('should handle single question', () => {
      const result = service.createResponseModal('instance-123', ['Single question'], 'U123456');

      expect(result.blocks).toHaveLength(2); // Instruction + 1 question
      expect((result.blocks[1] as { label: { text: string } }).label.text).toBe(
        '1. Single question',
      );
    });
  });

  describe('formatFollowupReminder', () => {
    it('should format followup reminder correctly', () => {
      const missingMembers = ['John Doe', 'Jane Smith'];
      const timeRemaining = '1h 30m';

      const result = service.formatFollowupReminder(mockInstance, timeRemaining, missingMembers);

      expect(result.text).toBe('⏰ Standup Reminder');
      expect(result.blocks).toHaveLength(3);

      // Check reminder message
      expect((result.blocks[0] as { text: { text: string } }).text.text).toContain(
        '⏰ *Standup Reminder!*',
      );
      expect((result.blocks[0] as { text: { text: string } }).text.text).toContain('• John Doe');
      expect((result.blocks[0] as { text: { text: string } }).text.text).toContain('• Jane Smith');

      // Check time remaining
      expect((result.blocks[1] as { text: { text: string } }).text.text).toContain(
        '*1h 30m* remaining',
      );

      // Check action button
      expect(result.blocks[2]).toEqual({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📝 Submit Now',
            },
            style: 'primary',
            action_id: 'submit_standup_response',
            value: 'instance-123',
          },
        ],
      });
    });

    it('should handle single missing member', () => {
      const result = service.formatFollowupReminder(mockInstance, '30m', ['John Doe']);

      expect((result.blocks[0] as { text: { text: string } }).text.text).toContain('• John Doe');
      expect((result.blocks[0] as { text: { text: string } }).text.text).not.toContain(
        '• Jane Smith',
      );
    });

    it('should handle empty missing members array', () => {
      const result = service.formatFollowupReminder(mockInstance, '30m', []);

      expect((result.blocks[0] as { text: { text: string } }).text.text).toContain(
        'Still waiting for responses from:\n',
      );
    });
  });

  describe('formatUserStatusResponse', () => {
    it('should format status for user who has not responded', () => {
      const result = service.formatUserStatusResponse(mockInstance, false, 'Test Team');

      expect(result.text).toBe('Standup Status: ⏳ Pending');
      expect(result.blocks).toHaveLength(2);

      // Check status message
      expect((result.blocks[0] as { text: { text: string } }).text.text).toContain(
        '*Standup Status for Test Team*',
      );
      expect((result.blocks[0] as { text: { text: string } }).text.text).toContain(
        'Your status: ⏳ Pending',
      );

      // Check action button is present
      expect(result.blocks[1]).toEqual({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📝 Submit Response',
            },
            style: 'primary',
            action_id: 'submit_standup_response',
            value: 'instance-123',
          },
        ],
      });
    });

    it('should format status for user who has responded', () => {
      const result = service.formatUserStatusResponse(mockInstance, true, 'Test Team');

      expect(result.text).toBe('Standup Status: ✅ Responded');
      expect(result.blocks).toHaveLength(1); // No action button

      expect((result.blocks[0] as { text: { text: string } }).text.text).toContain(
        'Your status: ✅ Responded',
      );
    });

    it('should handle null instance', () => {
      const result = service.formatUserStatusResponse(null, false, 'Test Team');

      expect(result.text).toBe('No active standup found for your team.');
      expect(result.blocks).toHaveLength(1);
      expect((result.blocks[0] as { text: { text: string } }).text.text).toBe(
        '📭 No active standup found for your team.',
      );
    });
  });

  describe('formatHelpMessage', () => {
    it('should format help message correctly', () => {
      const result = service.formatHelpMessage();

      expect(result.text).toBe('Standup Bot Help');
      expect(result.blocks).toHaveLength(4);

      // Check header
      expect(result.blocks[0]).toEqual({
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🤖 Standup Bot Help',
        },
      });

      // Check commands section
      expect((result.blocks[2] as { text: { text: string } }).text.text).toContain(
        '/standup status',
      );
      expect((result.blocks[2] as { text: { text: string } }).text.text).toContain(
        '/standup submit',
      );
      expect((result.blocks[2] as { text: { text: string } }).text.text).toContain('/standup skip');
      expect((result.blocks[2] as { text: { text: string } }).text.text).toContain('/standup help');

      // Check how it works section
      expect((result.blocks[3] as { text: { text: string } }).text.text).toContain('How it works:');
      expect((result.blocks[3] as { text: { text: string } }).text.text).toContain(
        'Standups are automatically posted daily',
      );
    });
  });

  describe('getTimeRemaining', () => {
    beforeEach(() => {
      // Mock Date.now to return a consistent time
      jest.spyOn(global.Date, 'now').mockReturnValue(new Date('2024-01-15T10:00:00Z').getTime());
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should format time remaining with hours and minutes', () => {
      const deadline = new Date('2024-01-15T12:30:00Z'); // 2.5 hours from now

      // Use reflection to access private method for testing
      const timeRemaining = (
        service as unknown as { getTimeRemaining: (deadline: Date) => string }
      ).getTimeRemaining(deadline);

      expect(timeRemaining).toBe('2h 30m');
    });

    it('should format time remaining with only minutes', () => {
      const deadline = new Date('2024-01-15T10:45:00Z'); // 45 minutes from now

      const timeRemaining = (
        service as unknown as { getTimeRemaining: (deadline: Date) => string }
      ).getTimeRemaining(deadline);

      expect(timeRemaining).toBe('45m');
    });

    it('should handle expired deadline', () => {
      const deadline = new Date('2024-01-15T09:00:00Z'); // 1 hour ago

      const timeRemaining = (
        service as unknown as { getTimeRemaining: (deadline: Date) => string }
      ).getTimeRemaining(deadline);

      expect(timeRemaining).toBe('Time expired');
    });

    it('should handle zero time remaining', () => {
      const deadline = new Date('2024-01-15T10:00:00Z'); // Exactly now

      const timeRemaining = (
        service as unknown as { getTimeRemaining: (deadline: Date) => string }
      ).getTimeRemaining(deadline);

      expect(timeRemaining).toBe('Time expired');
    });
  });

  describe('formatStandupReminderWithMagicLinks', () => {
    const mockMagicTokens = [
      {
        teamMemberId: 'member1',
        memberName: 'John Doe',
        magicToken: 'token-abc123',
        submissionUrl: 'https://app.asyncstand.com/standup/submit?token=token-abc123',
      },
      {
        teamMemberId: 'member2',
        memberName: 'Jane Smith',
        magicToken: 'token-xyz789',
        submissionUrl: 'https://app.asyncstand.com/standup/submit?token=token-xyz789',
      },
    ];

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should format standup reminder with magic links correctly', async () => {
      mockAnswerCollectionService.generateMagicTokensForInstance.mockResolvedValue(mockMagicTokens);
      mockConfigService.get.mockReturnValue('https://app.asyncstand.com');

      const result = await service.formatStandupReminderWithMagicLinks(
        mockInstance,
        'Test Team',
        'org-123',
      );

      expect(result.text).toBe('🌅 Daily Standup Time - Test Team');
      expect(result.blocks).toBeDefined();
      expect(result.blocks.length).toBeGreaterThan(6); // Should have more blocks than regular reminder

      // Check header block
      expect(result.blocks[0]).toEqual({
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🌅 Daily Standup Time - Test Team',
        },
      });

      // Check magic links explanation section
      const magicLinksSection = result.blocks.find(
        (block): block is SlackSectionBlock =>
          (block as SlackSectionBlock).text?.text?.includes('🌐 *Quick Submit:*') || false,
      );
      expect(magicLinksSection).toBeDefined();

      // Check personalized magic links section
      const linksSection = result.blocks.find(
        (block): block is SlackSectionBlock =>
          (block as SlackSectionBlock).text?.text?.includes(
            '<https://app.asyncstand.com/standup/submit?token=token-abc123|Submit for John Doe>',
          ) || false,
      );
      expect(linksSection).toBeDefined();
      expect(linksSection?.text.text).toContain('Submit for John Doe');
      expect(linksSection?.text.text).toContain('Submit for Jane Smith');

      // Verify service calls
      expect(mockAnswerCollectionService.generateMagicTokensForInstance).toHaveBeenCalledWith(
        'instance-123',
        'org-123',
      );
      expect(mockConfigService.get).toHaveBeenCalledWith('appUrl');
    });

    it('should use localhost fallback when appUrl is not configured', async () => {
      mockAnswerCollectionService.generateMagicTokensForInstance.mockResolvedValue(mockMagicTokens);
      mockConfigService.get.mockReturnValue(null);

      const result = await service.formatStandupReminderWithMagicLinks(
        mockInstance,
        'Test Team',
        'org-123',
      );

      const linksSection = result.blocks.find(
        (block): block is SlackSectionBlock =>
          (block as SlackSectionBlock).text?.text?.includes(
            'http://localhost:3000/standup/submit?token=',
          ) || false,
      );
      expect(linksSection).toBeDefined();
    });

    it('should include action buttons like regular reminder', async () => {
      mockAnswerCollectionService.generateMagicTokensForInstance.mockResolvedValue(mockMagicTokens);

      const result = await service.formatStandupReminderWithMagicLinks(
        mockInstance,
        'Test Team',
        'org-123',
      );

      // Check action buttons are present
      const actionsBlock = result.blocks.find(
        (block): block is SlackActionsBlock => block.type === 'actions',
      );
      expect(actionsBlock).toBeDefined();
      expect(actionsBlock?.elements).toHaveLength(2);
      expect(actionsBlock?.elements[0]).toMatchObject({
        type: 'button',
        text: { type: 'plain_text', text: '📝 Submit Response' },
        style: 'primary',
        action_id: 'submit_standup_response',
        value: 'instance-123',
      });
    });

    it('should fallback to regular reminder when magic token generation fails', async () => {
      mockAnswerCollectionService.generateMagicTokensForInstance.mockRejectedValue(
        new Error('Token generation failed'),
      );

      const result = await service.formatStandupReminderWithMagicLinks(
        mockInstance,
        'Test Team',
        'org-123',
      );

      // Should match regular reminder format
      expect(result.text).toBe('🌅 Daily Standup Time - Test Team');
      expect(result.blocks).toHaveLength(6); // Same as regular reminder

      // Should not contain magic links sections
      const magicLinksSection = result.blocks.find(
        (block): block is SlackSectionBlock =>
          (block as SlackSectionBlock).text?.text?.includes('🌐 *Quick Submit:*') || false,
      );
      expect(magicLinksSection).toBeUndefined();

      expect(mockAnswerCollectionService.generateMagicTokensForInstance).toHaveBeenCalledWith(
        'instance-123',
        'org-123',
      );
    });

    it('should handle empty magic tokens array', async () => {
      mockAnswerCollectionService.generateMagicTokensForInstance.mockResolvedValue([]);

      const result = await service.formatStandupReminderWithMagicLinks(
        mockInstance,
        'Test Team',
        'org-123',
      );

      // Should still include magic links explanation but no links
      const magicLinksSection = result.blocks.find(
        (block): block is SlackSectionBlock =>
          (block as SlackSectionBlock).text?.text?.includes('🌐 *Quick Submit:*') || false,
      );
      expect(magicLinksSection).toBeDefined();

      // Should not have any actual links
      const linksSection = result.blocks.find(
        (block): block is SlackSectionBlock =>
          (block as SlackSectionBlock).text?.text?.includes('Submit for') || false,
      );
      expect(linksSection).toBeUndefined();
    });

    it('should update context message to mention magic links', async () => {
      mockAnswerCollectionService.generateMagicTokensForInstance.mockResolvedValue(mockMagicTokens);

      const result = await service.formatStandupReminderWithMagicLinks(
        mockInstance,
        'Test Team',
        'org-123',
      );

      const contextBlock = result.blocks[result.blocks.length - 1] as {
        type: string;
        elements: { text: string }[];
      };
      expect(contextBlock.type).toBe('context');
      expect(contextBlock.elements[0].text).toContain('click your magic link');
    });
  });

  describe('formatFollowupReminderWithMagicLinks', () => {
    const mockMissingMembers = [
      { id: 'member1', name: 'John Doe', platformUserId: 'U123456' },
      { id: 'member3', name: 'Bob Wilson', platformUserId: 'U345678' },
    ];

    const mockMagicTokens = [
      {
        teamMemberId: 'member1',
        memberName: 'John Doe',
        magicToken: 'token-abc123',
        submissionUrl: 'https://app.asyncstand.com/standup/submit?token=token-abc123',
      },
      {
        teamMemberId: 'member2',
        memberName: 'Jane Smith',
        magicToken: 'token-xyz789',
        submissionUrl: 'https://app.asyncstand.com/standup/submit?token=token-xyz789',
      },
      {
        teamMemberId: 'member3',
        memberName: 'Bob Wilson',
        magicToken: 'token-def456',
        submissionUrl: 'https://app.asyncstand.com/standup/submit?token=token-def456',
      },
    ];

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should format followup reminder with magic links for missing members only', async () => {
      mockAnswerCollectionService.generateMagicTokensForInstance.mockResolvedValue(mockMagicTokens);
      mockConfigService.get.mockReturnValue('https://app.asyncstand.com');

      const result = await service.formatFollowupReminderWithMagicLinks(
        mockInstance,
        '1h 30m',
        mockMissingMembers,
        'org-123',
      );

      expect(result.text).toBe('⏰ Standup Reminder');
      expect(result.blocks.length).toBeGreaterThan(3); // Should have more blocks than regular followup

      // Check missing members section
      expect((result.blocks[0] as SlackSectionBlock).text.text).toContain('⏰ *Standup Reminder!*');
      expect((result.blocks[0] as SlackSectionBlock).text.text).toContain('• John Doe');
      expect((result.blocks[0] as SlackSectionBlock).text.text).toContain('• Bob Wilson');

      // Check magic links section header
      const magicLinksHeader = result.blocks.find(
        (block): block is SlackSectionBlock =>
          (block as SlackSectionBlock).text?.text?.includes('🌐 *Quick Submit Links:*') || false,
      );
      expect(magicLinksHeader).toBeDefined();

      // Check magic links - should only include links for missing members
      const linksSection = result.blocks.find(
        (block): block is SlackSectionBlock =>
          (block as SlackSectionBlock).text?.text?.includes(
            '<https://app.asyncstand.com/standup/submit?token=',
          ) || false,
      );
      expect(linksSection).toBeDefined();
      expect(linksSection?.text.text).toContain('Submit for John Doe');
      expect(linksSection?.text.text).toContain('Submit for Bob Wilson');
      // Should NOT contain Jane Smith (not in missing members)
      expect(linksSection?.text.text).not.toContain('Submit for Jane Smith');

      // Verify service calls
      expect(mockAnswerCollectionService.generateMagicTokensForInstance).toHaveBeenCalledWith(
        'instance-123',
        'org-123',
      );
    });

    it('should filter magic tokens to only include missing members', async () => {
      // Return tokens for all members but only some are missing
      mockAnswerCollectionService.generateMagicTokensForInstance.mockResolvedValue(mockMagicTokens);

      const singleMissingMember = [{ id: 'member1', name: 'John Doe', platformUserId: 'U123456' }];

      const result = await service.formatFollowupReminderWithMagicLinks(
        mockInstance,
        '2h',
        singleMissingMember,
        'org-123',
      );

      const linksSection = result.blocks.find(
        (block): block is SlackSectionBlock =>
          (block as SlackSectionBlock).text?.text?.includes('Submit for') || false,
      );
      expect(linksSection).toBeDefined();
      expect(linksSection?.text.text).toContain('Submit for John Doe');
      expect(linksSection?.text.text).not.toContain('Submit for Jane Smith');
      expect(linksSection?.text.text).not.toContain('Submit for Bob Wilson');
    });

    it('should include submit button like regular followup reminder', async () => {
      mockAnswerCollectionService.generateMagicTokensForInstance.mockResolvedValue(mockMagicTokens);

      const result = await service.formatFollowupReminderWithMagicLinks(
        mockInstance,
        '45m',
        mockMissingMembers,
        'org-123',
      );

      // Check action button
      const actionsBlock = result.blocks[result.blocks.length - 1];
      expect(actionsBlock).toEqual({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📝 Submit Now',
            },
            style: 'primary',
            action_id: 'submit_standup_response',
            value: 'instance-123',
          },
        ],
      });
    });

    it('should fallback to regular followup reminder when magic token generation fails', async () => {
      mockAnswerCollectionService.generateMagicTokensForInstance.mockRejectedValue(
        new Error('Database connection failed'),
      );

      const result = await service.formatFollowupReminderWithMagicLinks(
        mockInstance,
        '1h',
        mockMissingMembers,
        'org-123',
      );

      // Should match regular followup reminder format
      expect(result.text).toBe('⏰ Standup Reminder');
      expect(result.blocks).toHaveLength(3); // Same as regular followup reminder

      // Should not contain magic links sections
      const magicLinksSection = result.blocks.find(
        (block): block is SlackSectionBlock =>
          (block as SlackSectionBlock).text?.text?.includes('🌐 *Quick Submit Links:*') || false,
      );
      expect(magicLinksSection).toBeUndefined();

      expect(mockAnswerCollectionService.generateMagicTokensForInstance).toHaveBeenCalledWith(
        'instance-123',
        'org-123',
      );
    });

    it('should handle no missing members gracefully', async () => {
      mockAnswerCollectionService.generateMagicTokensForInstance.mockResolvedValue(mockMagicTokens);

      const result = await service.formatFollowupReminderWithMagicLinks(
        mockInstance,
        '30m',
        [], // No missing members
        'org-123',
      );

      // Should still format reminder but with no magic links
      expect(result.text).toBe('⏰ Standup Reminder');
      expect((result.blocks[0] as SlackSectionBlock).text.text).toContain(
        'Still waiting for responses from:\n',
      );

      // Should not have magic links section since no members are missing
      const linksSection = result.blocks.find(
        (block): block is SlackSectionBlock =>
          (block as SlackSectionBlock).text?.text?.includes('Submit for') || false,
      );
      expect(linksSection).toBeUndefined();
    });

    it('should use localhost fallback when appUrl is not configured', async () => {
      mockAnswerCollectionService.generateMagicTokensForInstance.mockResolvedValue(mockMagicTokens);
      mockConfigService.get.mockReturnValue(undefined);

      const result = await service.formatFollowupReminderWithMagicLinks(
        mockInstance,
        '2h',
        mockMissingMembers,
        'org-123',
      );

      const linksSection = result.blocks.find(
        (block): block is SlackSectionBlock =>
          (block as SlackSectionBlock).text?.text?.includes(
            'http://localhost:3000/standup/submit?token=',
          ) || false,
      );
      expect(linksSection).toBeDefined();
    });

    it('should maintain time remaining information', async () => {
      mockAnswerCollectionService.generateMagicTokensForInstance.mockResolvedValue([]);

      const timeRemaining = '15m';
      const result = await service.formatFollowupReminderWithMagicLinks(
        mockInstance,
        timeRemaining,
        mockMissingMembers,
        'org-123',
      );

      expect((result.blocks[1] as SlackSectionBlock).text.text).toContain(
        `*${timeRemaining}* remaining`,
      );
    });

    it('should handle partial token generation failures gracefully', async () => {
      // Return partial tokens (some members might not have valid tokens)
      const partialTokens = [mockMagicTokens[0]]; // Only one token for John Doe
      mockAnswerCollectionService.generateMagicTokensForInstance.mockResolvedValue(partialTokens);

      const result = await service.formatFollowupReminderWithMagicLinks(
        mockInstance,
        '1h',
        mockMissingMembers,
        'org-123',
      );

      const linksSection = result.blocks.find(
        (block): block is SlackSectionBlock =>
          (block as SlackSectionBlock).text?.text?.includes('Submit for') || false,
      );
      expect(linksSection).toBeDefined();
      expect(linksSection?.text.text).toContain('Submit for John Doe');
      expect(linksSection?.text.text).not.toContain('Submit for Bob Wilson'); // No token generated
    });
  });

  describe('edge cases', () => {
    it('should handle instance with no team', () => {
      const instanceWithoutTeam = {
        ...mockInstance,
        team: undefined,
      };

      const result = service.formatStandupReminder(instanceWithoutTeam, 'Fallback Team');

      expect(result.text).toBe('🌅 Daily Standup Time - Fallback Team');
    });

    it('should handle empty questions array', () => {
      const instanceWithNoQuestions = {
        ...mockInstance,
        configSnapshot: {
          ...mockInstance.configSnapshot,
          questions: [],
        },
      };

      const result = service.formatStandupReminder(instanceWithNoQuestions, 'Test Team');

      expect((result.blocks[2] as { text: { text: string } }).text.text).toBe('');
    });

    it('should handle zero participating members', () => {
      const instanceWithNoMembers = {
        ...mockInstance,
        configSnapshot: {
          ...mockInstance.configSnapshot,
          participatingMembers: [],
        },
      };

      const result = service.formatStandupReminder(instanceWithNoMembers, 'Test Team');

      expect((result.blocks[3] as { text: { text: string } }).text.text).toContain(
        '👥 *Waiting for:* 0 team members',
      );
    });
  });
});
