import type { Standup, StandupInstance, StandupResponse, ActiveStandup } from '@/types';
import type { StandupConfigResponse, StandupInstanceResponse } from '@/types/backend';
import { api } from '@/lib/api-client/client';

export const standupsApi = {
  async getTeamStandups(teamId: string): Promise<Standup[]> {
    // Backend provides standup config per team under standups/config
    const response = await api.get(`/standups/config/${teamId}`);
    const data = response.data as StandupConfigResponse | null;
    if (!data) return [];

    const weekdayNumToName = (
      n: number
    ): 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' => {
      const dayNames = [
        'sunday',
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
      ] as const;
      return dayNames[n] as (typeof dayNames)[number];
    };

    const standup: Standup = {
      id: String(data.id || teamId),
      teamId: String(data.team?.id || teamId),
      name: data.team?.name || 'Daily Standup',
      questions: Array.isArray(data.questions) ? data.questions : [],
      schedule: {
        time: String(data.timeLocal || '09:00'),
        days: Array.isArray(data.weekdays)
          ? data.weekdays.map((d: number) => weekdayNumToName(d))
          : [],
        timezone: String(data.timezone || 'UTC'),
      },
      slackChannelId: data.team?.channelName ? String(data.team.channelName) : undefined,
      isActive: Boolean(data.isActive ?? true),
      createdAt: new Date(data.createdAt || Date.now()).toISOString(),
      updatedAt: new Date(data.updatedAt || Date.now()).toISOString(),
    };

    return [standup];
  },

  async getStandupsByTeam(teamId: string): Promise<Standup[]> {
    return this.getTeamStandups(teamId);
  },

  async getStandup(standupId: string): Promise<Standup> {
    const response = await api.get<Standup>(`/standups/${standupId}`);
    return response.data;
  },

  async createStandup(teamId: string, data: Partial<Standup>): Promise<Standup> {
    // Map frontend Standup type to backend CreateStandupConfigDto
    const createData = {
      teamId,
      name: data.name || 'Daily Standup',
      questions: data.questions || [],
      timeLocal: data.schedule?.time || '09:00',
      timezone: data.schedule?.timezone || 'UTC',
      weekdays:
        data.schedule?.days?.map(day => {
          const dayMap = {
            sunday: 0,
            monday: 1,
            tuesday: 2,
            wednesday: 3,
            thursday: 4,
            friday: 5,
            saturday: 6,
          };
          return dayMap[day as keyof typeof dayMap];
        }) || [],
      channelName: data.slackChannelId || undefined,
    };

    const response = await api.post(`/standups/config`, createData);
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
    // Interpret standupId as teamId and fetch active instances via query param
    const response = await api.get(`/standups/instances`, { params: { teamId: standupId } });
    const items = (response.data as StandupInstanceResponse[]) || [];
    return items.map(item => ({
      id: String(item.id),
      configId: String(item.teamId),
      date: String(item.targetDate),
      status: (item.state === 'completed'
        ? 'completed'
        : item.state === 'collecting'
          ? 'active'
          : 'pending') as StandupInstance['status'],
      participants: [],
      responses: [],
      createdAt: new Date(item.createdAt || Date.now()).toISOString(),
      updatedAt: new Date(item.createdAt || Date.now()).toISOString(),
    }));
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

  async getActiveStandups(params?: {
    teamId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ActiveStandup[]> {
    const response = await api.get('/standups/instances', { params });
    const data = response.data || [];
    return data.map(
      (item: {
        id: string;
        teamId: string;
        teamName: string;
        targetDate: string;
        state: string;
        totalMembers: number;
        respondedMembers: number;
        responseRate: number;
        createdAt: string;
        configSnapshot?: {
          questions: string[];
          timezone: string;
          timeLocal: string;
        };
      }) => ({
        id: String(item.id),
        teamId: String(item.teamId),
        teamName: String(item.teamName),
        targetDate: String(item.targetDate),
        state: item.state as ActiveStandup['state'],
        totalMembers: Number(item.totalMembers || 0),
        respondedMembers: Number(item.respondedMembers || 0),
        responseRate: Number(item.responseRate || 0),
        createdAt: String(item.createdAt),
        questions: item.configSnapshot?.questions || [],
        timezone: item.configSnapshot?.timezone || 'UTC',
        timeLocal: item.configSnapshot?.timeLocal || '09:00',
      })
    );
  },
};
