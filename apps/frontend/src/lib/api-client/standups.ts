import type {
  Standup,
  StandupInstance,
  StandupResponse,
  ActiveStandup,
  DetailedStandupResponse,
  StandupMember,
  SendReminderRequest,
  StandupAnalytics,
} from '@/types';
import type { StandupConfigResponse, StandupInstanceResponse } from '@/types/backend';
import { StandupDeliveryType } from '@/types/backend';
import { api } from '@/lib/api-client/client';

export const standupsApi = {
  async getTeamStandups(teamId: string): Promise<Standup[]> {
    try {
      // First try the new endpoint for multiple standups
      const response = await api.get(`/standups/config/teams/${teamId}/standups`);
      const dataArray = response.data as StandupConfigResponse[];
      if (Array.isArray(dataArray) && dataArray.length > 0) {
        return this.mapStandupConfigsToStandups(dataArray, teamId);
      }
    } catch {
      // Fall back to single standup endpoint for backward compatibility
    }

    try {
      const response = await api.get(`/standups/config/${teamId}`);
      const data = response.data as StandupConfigResponse | null;
      if (!data) return [];

      return this.mapStandupConfigsToStandups([data], teamId);
    } catch (error) {
      console.error('Error fetching standups:', error);
      return [];
    }
  },

  mapStandupConfigsToStandups(configs: StandupConfigResponse[], teamId: string): Standup[] {
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

    return configs.map(data => ({
      id: String(data.id || teamId),
      teamId: String(data.team?.id || teamId),
      name: String(data.name || 'Daily Standup'),
      deliveryType: data.deliveryType || StandupDeliveryType.channel,
      questions: Array.isArray(data.questions) ? data.questions : [],
      schedule: {
        time: String(data.timeLocal || '09:00'),
        days: Array.isArray(data.weekdays)
          ? data.weekdays.map((d: number) => weekdayNumToName(d))
          : [],
        timezone: String(data.timezone || 'UTC'),
      },
      targetChannelId: data.targetChannelId,
      targetChannel: data.targetChannel,
      isActive: Boolean(data.isActive ?? true),
      createdAt: new Date(data.createdAt || Date.now()).toISOString(),
      updatedAt: new Date(data.updatedAt || Date.now()).toISOString(),
    }));
  },

  async getStandupsByTeam(teamId: string): Promise<Standup[]> {
    return this.getTeamStandups(teamId);
  },

  async getStandup(standupId: string): Promise<Standup> {
    const response = await api.get<Standup>(`/standups/instances/${standupId}`);
    return response.data;
  },

  async getStandupConfig(configId: string): Promise<Standup> {
    const response = await api.get(`/standups/config/${configId}`);
    const configData = response.data as StandupConfigResponse;
    // Map the response to match frontend Standup type
    return this.mapStandupConfigsToStandups([configData], configData.teamId)[0];
  },

  async getAllTeamStandupConfigs(teamId: string): Promise<Standup[]> {
    const response = await api.get(`/standups/config/teams/${teamId}/standups`);
    const configs = response.data as StandupConfigResponse[];
    return this.mapStandupConfigsToStandups(configs, teamId);
  },

  async createStandup(teamId: string, data: Partial<Standup>): Promise<Standup> {
    // Map frontend Standup type to backend CreateStandupConfigDto
    const createData = {
      teamId,
      name: data.name || 'Daily Standup',
      deliveryType: data.deliveryType || StandupDeliveryType.direct_message,
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
      targetChannelId: data.targetChannelId,
      reminderMinutesBefore: 10,
      responseTimeoutHours: 2,
      isActive: true,
    };

    const response = await api.post(`/standups/config`, createData);

    // Map response back to frontend Standup type
    const configData = response.data as StandupConfigResponse;
    return this.mapStandupConfigsToStandups([configData], teamId)[0];
  },

  async updateStandup(standupId: string, data: Partial<Standup>): Promise<Standup> {
    // Map frontend Standup type to backend UpdateStandupConfigDto
    const updateData = {
      ...(data.name && { name: data.name }),
      ...(data.deliveryType && { deliveryType: data.deliveryType }),
      ...(data.questions && { questions: data.questions }),
      ...(data.schedule?.time && { timeLocal: data.schedule.time }),
      ...(data.schedule?.timezone && { timezone: data.schedule.timezone }),
      ...(data.schedule?.days && {
        weekdays: data.schedule.days.map(day => {
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
        }),
      }),
      ...(data.targetChannelId !== undefined && { targetChannelId: data.targetChannelId }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    };

    const response = await api.put(`/standups/config/${standupId}`, updateData);

    // The PUT response should contain the updated standup config
    const configData = response.data as StandupConfigResponse;
    return this.mapStandupConfigsToStandups([configData], data.teamId || '')[0];
  },

  async deleteStandup(standupId: string): Promise<void> {
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
    const response = await api.get<StandupInstance>(`/standups/instances/${instanceId}`);
    return response.data;
  },

  async shouldCreateStandupToday(teamId: string): Promise<{ shouldCreate: boolean; date: string }> {
    const response = await api.get(`/standups/instances/team/${teamId}/should-create-today`);
    return response.data;
  },

  async triggerStandupForToday(): Promise<{
    created: string[];
    skipped: string[];
    skipReasons?: Record<string, string>;
  }> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const response = await api.post('/standups/instances/create-for-date', {
      targetDate: today,
    });
    return response.data;
  },

  async triggerStandupAndSend(): Promise<{
    created: string[];
    skipped: string[];
    skipReasons?: Record<string, string>;
    messages: { instanceId: string; success: boolean; error?: string }[];
  }> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const response = await api.post('/standups/instances/create-and-trigger', {
      targetDate: today,
    });
    return response.data;
  },

  async triggerStandupForConfig(configId: string): Promise<{
    instanceId?: string;
    success: boolean;
    message: string;
    messageResult?: { success: boolean; error?: string };
  }> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const response = await api.post(`/standups/instances/config/${configId}/create-and-trigger`, {
      targetDate: today,
    });
    return response.data;
  },

  async triggerReminderForInstance(instanceId: string): Promise<{
    success: boolean;
    messageTs?: string;
    error?: string;
  }> {
    const response = await api.post(`/standups/instances/${instanceId}/trigger-reminder`);
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
        members?: Array<{
          id: string;
          name: string;
          platformUserId: string;
          status: string;
          lastReminderSent?: string;
          reminderCount: number;
          responseTime?: string;
          isLate: boolean;
        }>;
        configSnapshot?: {
          questions: string[];
          timezone: string;
          timeLocal: string;
          deliveryType?: string;
          targetChannelId?: string;
          targetChannel?: {
            id: string;
            channelId: string;
            name: string;
          };
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
        deliveryType:
          (item.configSnapshot?.deliveryType as StandupDeliveryType) || 'direct_message',
        targetChannelId: item.configSnapshot?.targetChannelId,
        targetChannel: item.configSnapshot?.targetChannel,
        members: (item.members || []).map(member => ({
          id: member.id,
          name: member.name,
          platformUserId: member.platformUserId,
          status: member.status as 'not_started' | 'in_progress' | 'completed' | 'overdue',
          lastReminderSent: member.lastReminderSent,
          reminderCount: member.reminderCount,
          responseTime: member.responseTime,
          isLate: member.isLate,
        })),
        reminderHistory: [],
        avgResponseTime: 0,
        participationStreak: 0,
      })
    );
  },

  // Enhanced API methods for improved StandupsPage functionality
  /* eslint-disable @typescript-eslint/no-explicit-any */

  async getInstanceMembers(instanceId: string): Promise<StandupMember[]> {
    try {
      const response = await api.get(`/standups/instances/${instanceId}/members`);
      return response.data.map((member: any) => ({
        id: member.id,
        name: member.name,
        platformUserId: member.platformUserId,
        avatar: member.avatar,
        status: member.status || 'not_started',
        response: member.response,
        lastReminderSent: member.lastReminderSent,
        reminderCount: member.reminderCount || 0,
        responseTime: member.responseTime,
        isLate: member.isLate || false,
      }));
    } catch (error) {
      console.error('Failed to fetch instance members:', error);
      return [];
    }
  },

  async getDetailedResponses(instanceId: string): Promise<DetailedStandupResponse[]> {
    try {
      const response = await api.get(`/standups/instances/${instanceId}/responses/detailed`);
      return response.data.map((item: any) => ({
        id: item.id,
        instanceId: item.instanceId,
        userId: item.userId,
        answers: item.answers,
        submittedAt: item.submittedAt,
        user: {
          id: item.user.id,
          name: item.user.name,
          avatar: item.user.avatar,
        },
        isLate: item.isLate || false,
        responseTimeMinutes: item.responseTimeMinutes || 0,
        lastUpdated: item.lastUpdated,
      }));
    } catch (error) {
      console.error('Failed to fetch detailed responses:', error);
      return [];
    }
  },

  async sendIndividualReminder(request: SendReminderRequest): Promise<{
    success: boolean;
    sent: number;
    failed: number;
    errors?: string[];
  }> {
    try {
      const response = await api.post('/standups/instances/reminders/individual', request);
      return response.data;
    } catch (error) {
      console.error('Failed to send individual reminder:', error);
      throw error;
    }
  },

  async updateMemberResponse(
    instanceId: string,
    userId: string,
    answers: Record<string, string>
  ): Promise<StandupResponse> {
    try {
      const response = await api.put(`/standups/instances/${instanceId}/responses/${userId}`, {
        answers,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to update member response:', error);
      throw error;
    }
  },

  async getTeamAnalytics(
    teamId: string,
    dateRange: { start: string; end: string }
  ): Promise<StandupAnalytics> {
    try {
      const response = await api.get(`/standups/analytics/team/${teamId}`, {
        params: {
          startDate: dateRange.start,
          endDate: dateRange.end,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch team analytics:', error);
      throw error;
    }
  },

  async getReminderHistory(instanceId: string): Promise<any[]> {
    try {
      const response = await api.get(`/standups/instances/${instanceId}/reminders/history`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch reminder history:', error);
      return [];
    }
  },

  // New methods for StandupResponsesPage
  async getStandupInstance(instanceId: string): Promise<ActiveStandup> {
    try {
      const response = await api.get(`/standups/instances/${instanceId}`);
      const item = response.data;
      return {
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
        deliveryType: item.configSnapshot?.deliveryType || 'direct_message',
        targetChannelId: item.configSnapshot?.targetChannelId,
        targetChannel: item.configSnapshot?.targetChannel,
        members: [], // Will be fetched separately if needed
        reminderHistory: [],
        avgResponseTime: item.avgResponseTime,
        participationStreak: item.participationStreak,
      };
    } catch (error) {
      console.error('Failed to fetch standup instance:', error);
      throw error;
    }
  },

  async getStandupMembers(instanceId: string): Promise<StandupMember[]> {
    return this.getInstanceMembers(instanceId);
  },

  async getMemberResponse(
    instanceId: string,
    memberId: string
  ): Promise<DetailedStandupResponse | null> {
    try {
      const response = await api.get(`/standups/instances/${instanceId}/responses/${memberId}`);
      const item = response.data;
      if (!item) return null;

      return {
        id: item.id,
        instanceId: item.instanceId,
        userId: item.userId,
        answers: item.answers,
        submittedAt: item.submittedAt,
        user: {
          id: item.user?.id || memberId,
          name: item.user?.name || 'Unknown',
          avatar: item.user?.avatar,
        },
        isLate: item.isLate || false,
        responseTimeMinutes: item.responseTimeMinutes || 0,
        lastUpdated: item.lastUpdated,
      };
    } catch (error) {
      console.error('Failed to fetch member response:', error);
      return null;
    }
  },

  async sendReminders(
    instanceId: string,
    params: { memberIds: string[] }
  ): Promise<{
    success: boolean;
    sent: number;
    failed: number;
  }> {
    try {
      const response = await api.post(`/standups/instances/${instanceId}/reminders`, params);
      return response.data;
    } catch (error) {
      console.error('Failed to send reminders:', error);
      throw error;
    }
  },

  // Enhanced getActiveStandups with full member details
  async getActiveStandupsDetailed(params?: {
    teamId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ActiveStandup[]> {
    try {
      const response = await api.get('/standups/instances/detailed', { params });
      const data = response.data || [];

      return data.map((item: any) => ({
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
        deliveryType: item.configSnapshot?.deliveryType || 'direct_message',
        targetChannelId: item.configSnapshot?.targetChannelId,
        targetChannel: item.configSnapshot?.targetChannel,
        members: (item.members || []).map((member: any) => ({
          id: member.id,
          name: member.name,
          platformUserId: member.platformUserId,
          avatar: member.avatar,
          status: member.status || 'not_started',
          response: member.response,
          lastReminderSent: member.lastReminderSent,
          reminderCount: member.reminderCount || 0,
          responseTime: member.responseTime,
          isLate: member.isLate || false,
        })),
        reminderHistory: item.reminderHistory || [],
        responseTimeoutAt: item.responseTimeoutAt,
        avgResponseTime: item.avgResponseTime,
        participationStreak: item.participationStreak,
      }));
    } catch (error) {
      console.error('Failed to fetch detailed active standups:', error);
      // Fallback to basic version
      return this.getActiveStandups(params);
    }
  },
};
