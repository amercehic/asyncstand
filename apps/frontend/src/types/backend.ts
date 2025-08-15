// Backend response types

export enum StandupDeliveryType {
  channel = 'channel',
  direct_message = 'direct_message',
}
export interface StandupConfigResponse {
  id: string;
  teamId: string;
  name: string;
  deliveryType: StandupDeliveryType;
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
    channelName: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TeamListItem {
  id: string;
  name: string;
  channelName: string;
  channel: {
    id: string;
    name: string;
  } | null;
  memberCount: number;
  hasStandupConfig: boolean;
  createdAt: string;
  createdBy: {
    name: string;
  };
}

export interface TeamListResponse {
  teams: TeamListItem[];
}

export interface TeamMemberDetails {
  id: string;
  name: string;
  platformUserId: string;
  addedAt: string;
  addedBy: {
    name: string;
  } | null;
}

export interface TeamDetailsResponse {
  id: string;
  name: string;
  description?: string;
  timezone: string;
  integration: {
    teamName: string;
  };
  channel?: {
    id: string;
    name: string;
  };
  members: TeamMemberDetails[];
  standupConfig?: {
    id: string;
    questions: string[];
    weekdays: number[];
    timeLocal: string;
    reminderMinutesBefore: number;
  };
  createdAt: string;
  createdBy: {
    name: string;
  } | null;
}

export interface AvailableChannel {
  id: string;
  name: string;
  isAssigned: boolean;
  assignedTeamName?: string;
}

export interface AvailableChannelsResponse {
  channels: AvailableChannel[];
}

export interface AvailableMemberDetails {
  id: string;
  name: string;
  platformUserId: string;
  inTeamCount: number;
}

export interface AvailableMembersResponse {
  members: AvailableMemberDetails[];
}

// Standup instance response types
export interface StandupInstanceResponse {
  id: string;
  teamId: string;
  targetDate: string;
  state: 'collecting' | 'completed';
  createdAt: string;
}
