import type { CreateTeamRequest, Team, UpdateTeamRequest } from '@/types';
import { api } from '@/lib/api-client/client';

export const teamsApi = {
  async getTeams(): Promise<Team[]> {
    const response = await api.get<Team[]>('/teams');
    return response.data;
  },

  async getTeam(teamId: string): Promise<Team> {
    const response = await api.get<Team>(`/teams/${teamId}`);
    return response.data;
  },

  async createTeam(data: CreateTeamRequest): Promise<{ id: string }> {
    const response = await api.post<{ id: string }>('/teams', data);
    return response.data;
  },

  async updateTeam(teamId: string, data: UpdateTeamRequest): Promise<Team> {
    const response = await api.put<Team>(`/teams/${teamId}`, data);
    return response.data;
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

  async getAvailableChannels(): Promise<{
    channels: Array<{ id: string; name: string; isAssigned: boolean }>;
  }> {
    const response = await api.get('/teams/slack/channels');
    return response.data;
  },

  async getAvailableMembers(): Promise<{
    members: Array<{ id: string; name: string; platformUserId: string }>;
  }> {
    const response = await api.get('/teams/slack/members');
    return response.data;
  },
};
