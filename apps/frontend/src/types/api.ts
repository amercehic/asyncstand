// API-specific types

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
  role: 'user' | 'admin';
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  members: User[];
  createdAt: string;
  updatedAt: string;
}

export interface StandupConfig {
  id: string;
  teamId: string;
  name: string;
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
}

export interface CreateStandupConfigRequest {
  teamId: string;
  name: string;
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
