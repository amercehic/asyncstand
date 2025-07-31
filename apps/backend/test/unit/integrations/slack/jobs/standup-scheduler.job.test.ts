import { Test, TestingModule } from '@nestjs/testing';
import { StandupSchedulerJob } from '@/integrations/slack/jobs/standup-scheduler.job';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggerService } from '@/common/logger.service';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { StandupInstanceState } from '@prisma/client';
import { createMockPrismaService } from '@/../test/helpers/mock-prisma';

// Mock fetch globally
global.fetch = jest.fn();

describe('StandupSchedulerJob', () => {
  let job: StandupSchedulerJob;
  let prismaService: jest.Mocked<PrismaService>;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StandupSchedulerJob,
        {
          provide: PrismaService,
          useValue: createMockPrismaService(),
        },
        {
          provide: LoggerService,
          useValue: {
            setContext: jest.fn(),
            info: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            log: jest.fn(),
          },
        },
      ],
    }).compile();

    job = module.get<StandupSchedulerJob>(StandupSchedulerJob);
    prismaService = module.get(PrismaService);
    loggerService = module.get(LoggerService);
    auditLogService = module.get(AuditLogService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processScheduledStandups', () => {
    it('should process teams with matching standup times', async () => {
      const mockTeam = {
        id: 'team-1',
        name: 'Test Team',
        orgId: 'org-1',
        channelId: 'channel-1',
        timezone: 'UTC',
        configs: [
          {
            id: 'config-1',
            timeLocal: '09:00',
            weekdays: [1, 2, 3, 4, 5], // Mon-Fri
            questions: ['What did you do yesterday?', 'What will you do today?'],
            configMembers: [
              {
                include: true,
                teamMember: {
                  id: 'member-1',
                  name: 'John Doe',
                  platformUserId: 'slack-user-1',
                  active: true,
                },
              },
            ],
          },
        ],
        integration: {
          botToken: 'xoxb-test-token',
        },
        members: [],
      };

      // Mock Monday at 9:00 AM
      const mockDate = new Date('2024-01-08T09:00:00Z'); // Monday
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as unknown as Date);

      prismaService.team.findMany.mockResolvedValue([mockTeam] as never);
      prismaService.standupInstance.findFirst.mockResolvedValue(null); // No existing instance
      prismaService.standupInstance.create.mockResolvedValue({
        id: 'instance-1',
        teamId: 'team-1',
        configSnapshot: mockTeam.configs[0],
        targetDate: mockDate,
        state: StandupInstanceState.collecting,
        createdAt: mockDate,
      } as never);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      });

      await job.processScheduledStandups();

      expect(prismaService.standupInstance.create).toHaveBeenCalledWith({
        data: {
          teamId: 'team-1',
          configSnapshot: mockTeam.configs[0],
          targetDate: expect.any(Date) as Date,
          state: StandupInstanceState.collecting,
        },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer xoxb-test-token',
            'Content-Type': 'application/json',
          },
        }),
      );

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org-1',
          action: 'standup.instance.created',
        }),
      );
    });

    it('should skip teams without matching time', async () => {
      const mockTeam = {
        id: 'team-1',
        configs: [
          {
            timeLocal: '10:00', // Different time
            weekdays: [1, 2, 3, 4, 5],
          },
        ],
        timezone: 'UTC',
      };

      const mockDate = new Date('2024-01-08T09:00:00Z'); // Monday at 9:00
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as unknown as Date);

      prismaService.team.findMany.mockResolvedValue([mockTeam] as never);

      await job.processScheduledStandups();

      expect(prismaService.standupInstance.create).not.toHaveBeenCalled();
    });

    it('should skip teams with existing standup instance today', async () => {
      const mockTeam = {
        id: 'team-1',
        configs: [
          {
            timeLocal: '09:00',
            weekdays: [1, 2, 3, 4, 5],
          },
        ],
        timezone: 'UTC',
      };

      const mockDate = new Date('2024-01-08T09:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as unknown as Date);

      prismaService.team.findMany.mockResolvedValue([mockTeam] as never);
      prismaService.standupInstance.findFirst.mockResolvedValue({
        id: 'existing-instance',
      } as never); // Existing instance

      await job.processScheduledStandups();

      expect(prismaService.standupInstance.create).not.toHaveBeenCalled();
    });
  });

  describe('isTimeForStandup', () => {
    it('should return true when time matches within 1 minute window', () => {
      const config = { timeLocal: '09:00' };
      const now = new Date('2024-01-08T09:00:30Z'); // 30 seconds past 9:00

      // Access private method for testing
      const result = (
        job as unknown as {
          isTimeForStandup: (config: unknown, now: Date, timezone: string) => boolean;
        }
      ).isTimeForStandup(config, now, 'UTC');

      expect(result).toBe(true);
    });

    it('should return false when time is outside 1 minute window', () => {
      const config = { timeLocal: '09:00' };
      const now = new Date('2024-01-08T09:02:00Z'); // 2 minutes past 9:00

      const result = (
        job as unknown as {
          isTimeForStandup: (config: unknown, now: Date, timezone: string) => boolean;
        }
      ).isTimeForStandup(config, now, 'UTC');

      expect(result).toBe(false);
    });
  });
});
