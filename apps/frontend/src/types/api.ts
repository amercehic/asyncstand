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
  orgId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  members: User[];
  channel?: {
    id: string;
    name: string;
  };
  standupConfig?: {
    id: string;
    questions: string[];
    weekdays: number[];
    timeLocal: string;
    reminderMinutesBefore: number;
    isActive: boolean;
  };
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
  slackChannelId?: string;
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

export interface ActiveStandup {
  id: string;
  teamId: string;
  teamName: string;
  targetDate: string;
  state: 'pending' | 'collecting' | 'completed' | 'cancelled';
  totalMembers: number;
  respondedMembers: number;
  responseRate: number;
  createdAt: string;
  questions: string[];
  timezone: string;
  timeLocal: string;
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
  channelId: string;
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
  slackChannelId?: string;
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
