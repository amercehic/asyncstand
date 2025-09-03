import type { CreateTeamRequest, Team, UpdateTeamRequest } from '@/types';
import type {
  TeamListResponse,
  TeamDetailsResponse,
  AvailableChannelsResponse,
  AvailableMembersResponse,
} from '@/types/backend';
import { api } from '@/lib/api-client/client';

// Helpers to adapt backend responses to frontend Team shape
function mapListItemToTeam(item: TeamListResponse['teams'][0]): Team {
  return {
    id: String(item.id),
    name: String(item.name),
    description: undefined,
    members: [],
    memberCount: item.memberCount,
    createdAt: new Date(item.createdAt).toISOString(),
    updatedAt: new Date(item.createdAt).toISOString(),
  };
}

function mapDetailsToTeam(details: TeamDetailsResponse): Team {
  return {
    id: String(details.id),
    name: String(details.name),
    description: details.description ?? undefined,
    members: Array.isArray(details.members)
      ? details.members.map(m => ({
          id: String(m.id),
          email: m.platformUserId ? `@${m.platformUserId}` : '',
          name: String(m.name),
          role: 'member' as const,
          createdAt: new Date(details.createdAt).toISOString(),
          updatedAt: new Date(details.createdAt).toISOString(),
        }))
      : [],
    standupConfigs: Array.isArray(details.standupConfigs)
      ? details.standupConfigs.map(config => ({
          id: String(config.id),
          name: String(config.name),
          deliveryType: config.deliveryType,
          questions: config.questions,
          weekdays: config.weekdays,
          timeLocal: config.timeLocal,
          timezone: config.timezone,
          reminderMinutesBefore: config.reminderMinutesBefore,
          responseTimeoutHours: config.responseTimeoutHours,
          isActive: config.isActive,
          targetChannelId: config.targetChannelId,
          targetChannel: config.targetChannel,
        }))
      : [],
    createdAt: new Date(details.createdAt).toISOString(),
    updatedAt: new Date(details.createdAt).toISOString(),
  };
}

export const teamsApi = {
  async getTeams(): Promise<Team[]> {
    const response = await api.get('/teams');
    const data = response.data as TeamListResponse | Team[] | unknown;
    if (Array.isArray(data)) {
      return data as Team[];
    }
    if (data && typeof data === 'object' && 'teams' in data) {
      return (data as TeamListResponse).teams.map(mapListItemToTeam);
    }
    return [];
  },

  async getTeam(teamId: string): Promise<Team> {
    const response = await api.get(`/teams/${teamId}`);
    const data = response.data as TeamDetailsResponse;
    return mapDetailsToTeam(data);
  },

  async createTeam(data: CreateTeamRequest): Promise<Team> {
    const response = await api.post<{ id: string }>('/teams', data);
    const created = response.data;
    // Fetch full details to align with Team shape
    return this.getTeam(created.id);
  },

  async updateTeam(teamId: string, data: UpdateTeamRequest): Promise<Team> {
    await api.put(`/teams/${teamId}`, data);
    // Return fresh details after update
    return this.getTeam(teamId);
  },

  async deleteTeam(teamId: string): Promise<void> {
    await api.delete(`/teams/${teamId}`);
  },

  async inviteUser(teamId: string, email: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post(`/teams/${teamId}/invite`, { email });
    return response.data;
  },

  async removeUser(teamId: string, userId: string): Promise<void> {
    await api.delete(`/teams/${teamId}/members/${userId}`);
  },

  async getAvailableChannels(): Promise<AvailableChannelsResponse> {
    const response = await api.get('/teams/slack/channels');
    return response.data as AvailableChannelsResponse;
  },

  async getAvailableMembers(): Promise<AvailableMembersResponse> {
    const response = await api.get('/teams/slack/members');
    return response.data as AvailableMembersResponse;
  },

  async assignPlatformMembers(teamId: string, platformUserIds: string[]): Promise<void> {
    if (platformUserIds.length === 0) return;

    if (platformUserIds.length === 1) {
      // Use single member endpoint for single additions
      await api.post(`/teams/${teamId}/members`, { slackUserId: platformUserIds[0] });
    } else {
      // Use bulk endpoint for multiple additions
      await api.post(`/teams/${teamId}/members/bulk`, { slackUserIds: platformUserIds });
    }
  },

  async removePlatformMembers(teamId: string, teamMemberIds: string[]): Promise<void> {
    // Use existing single member endpoint in parallel
    const removePromises = teamMemberIds.map(teamMemberId =>
      api.delete(`/teams/${teamId}/members/${teamMemberId}`)
    );
    await Promise.all(removePromises);
  },

  async syncTeamMembers(teamId: string): Promise<{ success: boolean; syncedCount: number }> {
    const response = await api.post(`/teams/${teamId}/sync-members`);
    return response.data;
  },
};
