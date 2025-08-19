import { StandupDeliveryType } from '@prisma/client';

export interface StandupConfigResponse {
  id: string;
  teamId: string;
  name: string;
  deliveryType: StandupDeliveryType;
  targetChannelId?: string;
  questions: string[];
  weekdays: number[];
  timeLocal: string;
  timezone: string;
  reminderMinutesBefore: number;
  responseTimeoutHours: number;
  isActive: boolean;
  team: {
    id: string;
    name: string;
  };
  memberParticipation: MemberParticipationResponse[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MemberParticipationResponse {
  teamMember: {
    id: string;
    name: string;
    platformUserId: string;
  };
  include: boolean;
  role?: string;
}

export interface PreviewResponse {
  schedule: {
    weekdays: string[];
    timeLocal: string;
    timezone: string;
    nextStandup: Date;
  };
  questions: string[];
  participatingMembers: number;
  totalMembers: number;
  reminderSettings: {
    minutesBefore: number;
    timeoutHours: number;
  };
}

export interface QuestionTemplate {
  name: string;
  questions: string[];
}

export const QUESTION_TEMPLATES: QuestionTemplate[] = [
  {
    name: 'Classic Scrum',
    questions: [
      'What did you accomplish yesterday?',
      'What will you work on today?',
      'Are there any blockers or impediments?',
    ],
  },
  {
    name: 'Async Friendly',
    questions: [
      'What did you complete since the last standup?',
      'What are you focusing on next?',
      'What support do you need from the team?',
      'Any wins or learnings to share?',
    ],
  },
  {
    name: 'Goal Oriented',
    questions: [
      'What progress did you make toward your goals?',
      "What's your main focus for today?",
      'What obstacles are blocking your progress?',
      'How can the team help you succeed?',
    ],
  },
  {
    name: 'Retrospective Style',
    questions: [
      'What went well since the last standup?',
      'What could have gone better?',
      'What will you do differently today?',
      'What do you need from teammates?',
    ],
  },
];

export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export interface TimezoneInfo {
  value: string;
  label: string;
  offset: string;
}
