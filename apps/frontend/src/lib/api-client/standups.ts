import type { Standup, StandupInstance, StandupResponse } from '@/types';
import { api } from '@/lib/api-client/client';

export const standupsApi = {
  async getStandupsByTeam(teamId: string): Promise<Standup[]> {
    const response = await api.get<Standup[]>(`/teams/${teamId}/standups`);
    return response.data;
  },

  async getStandup(standupId: string): Promise<Standup> {
    const response = await api.get<Standup>(`/standups/${standupId}`);
    return response.data;
  },

  async createStandup(teamId: string, data: Partial<Standup>): Promise<Standup> {
    const response = await api.post<Standup>(`/teams/${teamId}/standups`, data);
    return response.data;
  },

  async updateStandup(standupId: string, data: Partial<Standup>): Promise<Standup> {
    const response = await api.put<Standup>(`/standups/${standupId}`, data);
    return response.data;
  },

  async deleteStandup(standupId: string): Promise<void> {
    await api.delete(`/standups/${standupId}`);
  },

  async getStandupInstances(standupId: string): Promise<StandupInstance[]> {
    const response = await api.get<StandupInstance[]>(`/standups/${standupId}/instances`);
    return response.data;
  },

  async getInstance(instanceId: string): Promise<StandupInstance> {
    const response = await api.get<StandupInstance>(`/instances/${instanceId}`);
    return response.data;
  },

  async triggerStandup(standupId: string): Promise<StandupInstance> {
    const response = await api.post<StandupInstance>(`/standups/${standupId}/trigger`);
    return response.data;
  },

  async getInstanceResponses(instanceId: string): Promise<StandupResponse[]> {
    const response = await api.get<StandupResponse[]>(`/instances/${instanceId}/responses`);
    return response.data;
  },

  async submitResponse(
    instanceId: string,
    answers: Record<string, string>
  ): Promise<StandupResponse> {
    const response = await api.post<StandupResponse>(`/instances/${instanceId}/responses`, {
      answers,
    });
    return response.data;
  },

  async updateResponse(
    responseId: string,
    answers: Record<string, string>
  ): Promise<StandupResponse> {
    const response = await api.put<StandupResponse>(`/responses/${responseId}`, { answers });
    return response.data;
  },
};
