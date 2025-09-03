// API-specific types

export enum StandupDeliveryType {
  channel = 'channel',
  direct_message = 'direct_message',
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'owner' | 'admin' | 'member';
  isSuperAdmin?: boolean;
  orgId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  members: User[];
  memberCount?: number; // Used when members array is not populated
  channel?: {
    id: string;
    name: string;
  };
  standupConfigs?: Array<{
    id: string;
    name: string;
    deliveryType: StandupDeliveryType;
    questions: string[];
    weekdays: number[];
    timeLocal: string;
    timezone: string;
    reminderMinutesBefore: number;
    responseTimeoutHours: number;
    isActive: boolean;
    targetChannelId?: string;
    targetChannel?: {
      id: string;
      channelId: string;
      name: string;
    };
  }>;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Standup {
  id: string;
  teamId: string;
  name: string;
  deliveryType: StandupDeliveryType;
  questions: string[];
  schedule: {
    time: string;
    days: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[];
    timezone: string;
  };
  targetChannelId?: string;
  targetChannel?: {
    id: string;
    channelId: string;
    name: string;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Alias for backward compatibility
export type StandupConfig = Standup;

export interface StandupInstance {
  id: string;
  configId: string;
  date: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  participants: string[]; // User IDs
  responses: StandupResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface StandupResponse {
  id: string;
  instanceId: string;
  userId: string;
  answers: Record<string, string>;
  submittedAt: string;
}

export interface StandupMember {
  id: string;
  name: string;
  email?: string;
  platformUserId: string;
  avatar?: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'overdue';
  response?: StandupResponse;
  lastReminderSent?: string;
  reminderCount: number;
  responseTime?: number; // minutes taken to respond
  isLate: boolean;
  completionPercentage?: number; // percentage of questions answered
}

export interface ReminderHistory {
  id: string;
  instanceId: string;
  userId: string;
  type: 'broadcast' | 'individual' | 'escalation';
  message: string;
  sentAt: string;
  deliveryMethod: 'channel_mention' | 'direct_message';
  responded: boolean;
  responseTime?: number; // minutes until response
}

export interface DetailedStandupResponse extends StandupResponse {
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  isLate: boolean;
  responseTimeMinutes: number;
  lastUpdated?: string;
}

export interface ActiveStandup {
  id: string;
  teamId: string;
  teamName: string;
  configName?: string; // Name of the standup configuration
  targetDate: string;
  state: 'pending' | 'collecting' | 'completed' | 'cancelled';
  totalMembers: number;
  respondedMembers: number;
  responseRate: number;
  createdAt: string;
  questions: string[];
  timezone: string;
  timeLocal: string;
  deliveryType: StandupDeliveryType;
  targetChannelId?: string;
  targetChannel?: {
    id: string;
    channelId: string;
    name: string;
  };
  members: StandupMember[];
  reminderHistory: ReminderHistory[];
  responseTimeoutAt?: string;
  avgResponseTime?: number;
  participationStreak?: number;
}

// API Request types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignUpRequest {
  name: string;
  email: string;
  password: string;
}

export interface CreateTeamRequest {
  name: string;
  integrationId: string;
  channelId?: string;
  timezone: string;
  description?: string;
}

export interface UpdateTeamRequest {
  name?: string;
  description?: string;
  integrationId?: string;
  channelId?: string;
  timezone?: string;
}

export interface CreateStandupConfigRequest {
  teamId: string;
  name: string;
  deliveryType: StandupDeliveryType;
  questions: string[];
  schedule: StandupConfig['schedule'];
  targetChannelId?: string;
  memberIds?: string[];
  reminderMinutesBefore?: number;
  responseTimeoutHours?: number;
}

export interface SendReminderRequest {
  instanceId: string;
  userIds?: string[]; // If not provided, send to all non-responders
  message?: string; // Custom message, fallback to default
  type: 'individual' | 'broadcast' | 'escalation';
  deliveryMethod?: 'channel_mention' | 'direct_message'; // Auto-determined if not provided
}

export interface StandupAnalytics {
  teamId: string;
  dateRange: {
    start: string;
    end: string;
  };
  totalStandups: number;
  avgResponseRate: number;
  avgResponseTime: number; // in minutes
  memberStats: Array<{
    userId: string;
    name: string;
    participationRate: number;
    avgResponseTime: number;
    streak: number; // consecutive responses
    lastResponseDate?: string;
  }>;
  trends: {
    responseRateByDay: Array<{ date: string; rate: number }>;
    responseTimeByDay: Array<{ date: string; avgTime: number }>;
  };
  topQuestions: Array<{
    question: string;
    avgLength: number;
    engagementScore: number;
  }>;
}

// API Response types
export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    isSuperAdmin: boolean;
  };
  organizations: Array<{
    id: string;
    name: string;
    role: string;
    isPrimary: boolean;
  }>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// API Error types
export interface ValidationError {
  field: string;
  message: string;
}

export interface ApiErrorResponse {
  message: string;
  code: string;
  statusCode: number;
  timestamp: string;
  path: string;
  errors?: ValidationError[];
}
