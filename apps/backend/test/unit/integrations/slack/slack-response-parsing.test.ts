import { Test, TestingModule } from '@nestjs/testing';
import { SlackEventService } from '@/integrations/slack/slack-event.service';
import { SlackMessagingService } from '@/integrations/slack/slack-messaging.service';
import { SlackMessageFormatterService } from '@/integrations/slack/slack-message-formatter.service';
import { AnswerCollectionService } from '@/standups/answer-collection.service';
import { LoggerService } from '@/common/logger.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('SlackEventService - Response Parsing', () => {
  let service: SlackEventService;

  const mockSlackMessaging = {
    sendMessage: jest.fn(),
  };

  const mockFormatter = {
    formatStandupReminder: jest.fn(),
  };

  const mockAnswerCollection = {
    submitFullResponse: jest.fn(),
  };

  const mockPrismaService = {
    standupInstance: { findFirst: jest.fn() },
  };

  beforeEach(async () => {
    const mockLogger = {
      setContext: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      logError: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlackEventService,
        { provide: SlackMessagingService, useValue: mockSlackMessaging },
        { provide: SlackMessageFormatterService, useValue: mockFormatter },
        { provide: AnswerCollectionService, useValue: mockAnswerCollection },
        { provide: LoggerService, useValue: mockLogger },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SlackEventService>(SlackEventService);
  });

  // Access private method for testing
  const parseResponse = (responseText: string, questionCount: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (service as any).parseStandupResponse(responseText, questionCount);
  };

  describe('Numbered List Parsing', () => {
    it('should parse numbered list with periods', () => {
      const responseText =
        '1. Completed user authentication\n2. Will work on API endpoints\n3. No blockers today';
      const result = parseResponse(responseText, 3);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ questionIndex: 0, text: 'Completed user authentication' });
      expect(result[1]).toEqual({ questionIndex: 1, text: 'Will work on API endpoints' });
      expect(result[2]).toEqual({ questionIndex: 2, text: 'No blockers today' });
    });

    it('should parse numbered list with parentheses', () => {
      const responseText =
        '1) Fixed login bug\n2) Working on dashboard\n3) Need help with deployment';
      const result = parseResponse(responseText, 3);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ questionIndex: 0, text: 'Fixed login bug' });
      expect(result[1]).toEqual({ questionIndex: 1, text: 'Working on dashboard' });
      expect(result[2]).toEqual({ questionIndex: 2, text: 'Need help with deployment' });
    });

    it('should handle numbered list with extra whitespace', () => {
      const responseText = '  1.   Completed task A  \n  2.   Started task B  \n  3.   No issues  ';
      const result = parseResponse(responseText, 3);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ questionIndex: 0, text: 'Completed task A' });
      expect(result[1]).toEqual({ questionIndex: 1, text: 'Started task B' });
      expect(result[2]).toEqual({ questionIndex: 2, text: 'No issues' });
    });

    it('should handle fewer answers than questions in numbered format', () => {
      const responseText = '1. Did task A\n2. Will do task B';
      const result = parseResponse(responseText, 3);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ questionIndex: 0, text: 'Did task A' });
      expect(result[1]).toEqual({ questionIndex: 1, text: 'Will do task B' });
      expect(result[2]).toEqual({ questionIndex: 2, text: '' });
    });
  });

  describe('Bullet Point Parsing', () => {
    it('should parse bullet points with dashes', () => {
      const responseText =
        '- Finished code review\n- Planning next sprint\n- Waiting for design feedback';
      const result = parseResponse(responseText, 3);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ questionIndex: 0, text: 'Finished code review' });
      expect(result[1]).toEqual({ questionIndex: 1, text: 'Planning next sprint' });
      expect(result[2]).toEqual({ questionIndex: 2, text: 'Waiting for design feedback' });
    });

    it('should parse bullet points with asterisks', () => {
      const responseText = '* Deployed new feature\n* Testing in staging\n* No blockers';
      const result = parseResponse(responseText, 3);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ questionIndex: 0, text: 'Deployed new feature' });
      expect(result[1]).toEqual({ questionIndex: 1, text: 'Testing in staging' });
      expect(result[2]).toEqual({ questionIndex: 2, text: 'No blockers' });
    });

    it('should parse bullet points with unicode bullets', () => {
      const responseText = '• Updated documentation\n• Refactored components\n• Ready for demo';
      const result = parseResponse(responseText, 3);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ questionIndex: 0, text: 'Updated documentation' });
      expect(result[1]).toEqual({ questionIndex: 1, text: 'Refactored components' });
      expect(result[2]).toEqual({ questionIndex: 2, text: 'Ready for demo' });
    });

    it('should handle mixed bullet types', () => {
      const responseText = '- Completed frontend\n* Working on backend\n• No issues found';
      const result = parseResponse(responseText, 3);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ questionIndex: 0, text: 'Completed frontend' });
      expect(result[1]).toEqual({ questionIndex: 1, text: 'Working on backend' });
      expect(result[2]).toEqual({ questionIndex: 2, text: 'No issues found' });
    });
  });

  describe('Line-by-Line Parsing', () => {
    it('should parse plain lines without markers', () => {
      const responseText = 'Implemented user login\nWorking on dashboard\nNo blockers';
      const result = parseResponse(responseText, 3);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ questionIndex: 0, text: 'Implemented user login' });
      expect(result[1]).toEqual({ questionIndex: 1, text: 'Working on dashboard' });
      expect(result[2]).toEqual({ questionIndex: 2, text: 'No blockers' });
    });

    it('should handle empty lines in between', () => {
      const responseText = 'Task A completed\n\nTask B in progress\n\nNo issues';
      const result = parseResponse(responseText, 3);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ questionIndex: 0, text: 'Task A completed' });
      expect(result[1]).toEqual({ questionIndex: 1, text: 'Task B in progress' });
      expect(result[2]).toEqual({ questionIndex: 2, text: 'No issues' });
    });

    it('should respect question count limit', () => {
      const responseText = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
      const result = parseResponse(responseText, 3);

      expect(result).toHaveLength(3);
      // With 5 lines, this should fall back to single response mode (too many lines)
      expect(result[0]).toEqual({
        questionIndex: 0,
        text: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5',
      });
      expect(result[1]).toEqual({ questionIndex: 1, text: '' });
      expect(result[2]).toEqual({ questionIndex: 2, text: '' });
    });
  });

  describe('Single Response Parsing', () => {
    it('should put single response in first question only', () => {
      const responseText = 'This is a single comprehensive answer that covers everything';
      const result = parseResponse(responseText, 3);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        questionIndex: 0,
        text: 'This is a single comprehensive answer that covers everything',
      });
      expect(result[1]).toEqual({ questionIndex: 1, text: '' });
      expect(result[2]).toEqual({ questionIndex: 2, text: '' });
    });

    it('should handle multi-line single response', () => {
      const responseText =
        'Today I worked on multiple tasks.\nI made good progress on the project.\nEverything is going well.';

      // This should trigger line-by-line mode since it has exactly 3 lines for 3 questions
      const result = parseResponse(responseText, 3);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ questionIndex: 0, text: 'Today I worked on multiple tasks.' });
      expect(result[1]).toEqual({ questionIndex: 1, text: 'I made good progress on the project.' });
      expect(result[2]).toEqual({ questionIndex: 2, text: 'Everything is going well.' });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty response', () => {
      const responseText = '';
      const result = parseResponse(responseText, 3);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ questionIndex: 0, text: '' });
      expect(result[1]).toEqual({ questionIndex: 1, text: '' });
      expect(result[2]).toEqual({ questionIndex: 2, text: '' });
    });

    it('should handle whitespace-only response', () => {
      const responseText = '   \n   \n   ';
      const result = parseResponse(responseText, 3);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ questionIndex: 0, text: '' });
      expect(result[1]).toEqual({ questionIndex: 1, text: '' });
      expect(result[2]).toEqual({ questionIndex: 2, text: '' });
    });

    it('should handle single question scenario', () => {
      const responseText = '1. Only one question to answer';
      const result = parseResponse(responseText, 1);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ questionIndex: 0, text: 'Only one question to answer' });
    });

    it('should prioritize numbered format over bullets', () => {
      const responseText = '1. First answer\n- Second point\n2. Second answer\n- Another point';
      const result = parseResponse(responseText, 2);

      expect(result).toHaveLength(2);
      // Numbered format takes priority - bullet points in between are treated as separate content
      expect(result[0]).toEqual({ questionIndex: 0, text: 'First answer' });
      expect(result[1]).toEqual({ questionIndex: 1, text: 'Second answer' });
    });
  });

  describe('Real-world Examples', () => {
    it('should handle typical standup response format 1', () => {
      const responseText = `1. Yesterday I completed the user registration feature and fixed 3 bugs in the login flow
2. Today I will work on the password reset functionality and start on email notifications
3. I'm blocked on getting access to the production database for testing`;

      const result = parseResponse(responseText, 3);

      expect(result).toHaveLength(3);
      expect(result[0].text).toContain('user registration feature');
      expect(result[1].text).toContain('password reset functionality');
      expect(result[2].text).toContain('blocked on getting access');
    });

    it('should handle typical standup response format 2', () => {
      const responseText = `• Shipped the new dashboard to staging
• Working on mobile responsive fixes
• Need design review for the settings page`;

      const result = parseResponse(responseText, 3);

      expect(result).toHaveLength(3);
      expect(result[0].text).toBe('Shipped the new dashboard to staging');
      expect(result[1].text).toBe('Working on mobile responsive fixes');
      expect(result[2].text).toBe('Need design review for the settings page');
    });

    it('should handle casual multi-line response', () => {
      const responseText = `Good progress today!
Fixed the login bug that was affecting mobile users
Working on the new feature for tomorrow
No major blockers right now`;

      const result = parseResponse(responseText, 3);

      expect(result).toHaveLength(3);
      // Should use single response mode since there are 4 lines (exceeds our line limit of questionCount)
      expect(result[0].text).toBe(`Good progress today!
Fixed the login bug that was affecting mobile users
Working on the new feature for tomorrow
No major blockers right now`);
      expect(result[1].text).toBe('');
      expect(result[2].text).toBe('');
    });
  });
});
