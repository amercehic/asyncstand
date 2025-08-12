import type { Standup, StandupInstance, StandupResponse, ActiveStandup } from '@/types';
import type { StandupConfigResponse, StandupInstanceResponse } from '@/types/backend';
import { api } from '@/lib/api-client/client';

export const standupsApi = {
  async getTeamStandups(teamId: string): Promise<Standup[]> {
    // Use new backend endpoint that supports multiple configs per team
    const response = await api.get(`/standups/config/team/${teamId}`);
    const dataArray = response.data as StandupConfigResponse[] | null;
    if (!dataArray || !Array.isArray(dataArray)) return [];

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

    return dataArray.map(
      (data): Standup => ({
        id: String(data.id || teamId),
        teamId: String(data.team?.id || teamId),
        name: data.purpose
          ? `${data.purpose.charAt(0).toUpperCase()}${data.purpose.slice(1)} Standup`
          : data.team?.name || 'Daily Standup',
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
      })
    );
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
      purpose: data.name?.toLowerCase().includes('daily')
        ? 'daily'
        : data.name?.toLowerCase().includes('weekly')
          ? 'weekly'
          : data.name?.toLowerCase().includes('retrospective')
            ? 'retrospective'
            : data.name?.toLowerCase().includes('planning')
              ? 'planning'
              : 'custom',
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
    // Map frontend Standup type to backend UpdateStandupConfigDto
    // Only include defined properties to avoid backend validation errors
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) {
      updateData.purpose = data.name?.toLowerCase().includes('daily')
        ? 'daily'
        : data.name?.toLowerCase().includes('weekly')
          ? 'weekly'
          : data.name?.toLowerCase().includes('retrospective')
            ? 'retrospective'
            : data.name?.toLowerCase().includes('planning')
              ? 'planning'
              : 'custom';
    }
    if (data.questions !== undefined) {
      updateData.questions = data.questions;
    }
    if (data.schedule?.time !== undefined) {
      updateData.timeLocal = data.schedule.time;
    }
    if (data.schedule?.timezone !== undefined) {
      updateData.timezone = data.schedule.timezone;
    }
    if (data.schedule?.days !== undefined) {
      updateData.weekdays = data.schedule.days.map(day => {
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
      });
    }

    // Use the correct backend endpoint for updating standup config
    const updateResponse = await api.put(`/standups/config/${standupId}`, updateData);

    // Return the updated data directly from the PUT response if available
    if (updateResponse.data) {
      const updatedData = updateResponse.data;

      // Transform backend response back to frontend Standup type
      const weekdayNumToName = (n: number) => {
        const dayNames = [
          'sunday',
          'monday',
          'tuesday',
          'wednesday',
          'thursday',
          'friday',
          'saturday',
        ] as const;
        return dayNames[n];
      };

      return {
        id: String(updatedData.id || standupId),
        teamId: String(updatedData.team?.id || standupId),
        name: updatedData.team?.name || data.name || 'Daily Standup',
        questions: Array.isArray(updatedData.questions) ? updatedData.questions : [],
        schedule: {
          time: String(updatedData.timeLocal || '09:00'),
          days: Array.isArray(updatedData.weekdays)
            ? updatedData.weekdays.map((d: number) => weekdayNumToName(d))
            : [],
          timezone: String(updatedData.timezone || 'UTC'),
        },
        slackChannelId: updatedData.team?.channelName || data.slackChannelId,
        isActive: Boolean(updatedData.isActive ?? true),
        createdAt: new Date(updatedData.createdAt || Date.now()).toISOString(),
        updatedAt: new Date(updatedData.updatedAt || Date.now()).toISOString(),
      };
    }

    // Fallback: try to fetch the updated standup if PUT didn't return data
    try {
      const updatedResponse = await api.get(`/standups/config/${standupId}`);
      const updatedData = updatedResponse.data;

      // Transform backend response back to frontend Standup type
      const weekdayNumToName = (n: number) => {
        const dayNames = [
          'sunday',
          'monday',
          'tuesday',
          'wednesday',
          'thursday',
          'friday',
          'saturday',
        ] as const;
        return dayNames[n];
      };

      return {
        id: String(updatedData.id || standupId),
        teamId: String(updatedData.team?.id || standupId),
        name: updatedData.team?.name || data.name || 'Daily Standup',
        questions: Array.isArray(updatedData.questions) ? updatedData.questions : [],
        schedule: {
          time: String(updatedData.timeLocal || '09:00'),
          days: Array.isArray(updatedData.weekdays)
            ? updatedData.weekdays.map((d: number) => weekdayNumToName(d))
            : [],
          timezone: String(updatedData.timezone || 'UTC'),
        },
        slackChannelId: updatedData.team?.channelName || data.slackChannelId,
        isActive: Boolean(updatedData.isActive ?? true),
        createdAt: new Date(updatedData.createdAt || Date.now()).toISOString(),
        updatedAt: new Date(updatedData.updatedAt || Date.now()).toISOString(),
      };
    } catch {
      // If we can't fetch the updated config, return a constructed response
      // based on the input data, since the PUT was successful
      return {
        id: standupId,
        teamId: standupId, // Assuming standupId is actually teamId based on the API usage
        name: data.name || 'Daily Standup',
        questions: data.questions || [],
        schedule: {
          time: data.schedule?.time || '09:00',
          days: data.schedule?.days || [],
          timezone: data.schedule?.timezone || 'UTC',
        },
        slackChannelId: data.slackChannelId,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
  },

  async deleteStandup(standupId: string): Promise<void> {
    // Use the correct backend endpoint for deleting standup config
    await api.delete(`/standups/config/${standupId}`);
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
