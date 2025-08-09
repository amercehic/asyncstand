import { Test, TestingModule } from '@nestjs/testing';
import { SlackMessageFormatterService } from '@/integrations/slack/slack-message-formatter.service';

describe('SlackMessageFormatterService', () => {
  let service: SlackMessageFormatterService;

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
      providers: [SlackMessageFormatterService],
    }).compile();

    service = module.get<SlackMessageFormatterService>(SlackMessageFormatterService);
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
