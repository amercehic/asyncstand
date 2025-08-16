export interface TeamListItem {
  id: string;
  name: string;
  memberCount: number;
  standupConfigCount: number;
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
  members: TeamMemberDetails[];
  standupConfigs: Array<{
    id: string;
    name: string;
    deliveryType: string;
    targetChannel?: {
      id: string;
      name: string;
      channelId: string;
    };
    isActive: boolean;
    memberCount: number;
  }>;
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
