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
  createdAt: Date;
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
  addedAt: Date;
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
  channel: {
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
  createdAt: Date;
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

export interface ChannelValidationResponse {
  valid: boolean;
  channelName?: string;
  error?: string;
}
