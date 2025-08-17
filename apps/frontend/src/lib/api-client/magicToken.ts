import axios from 'axios';
import { env } from '@/config/env';

// Create a separate axios instance for magic token operations
// This instance doesn't include auth interceptors since magic tokens provide their own auth
export const magicTokenApi = axios.create({
  baseURL: env.apiUrl,
  timeout: env.apiTimeout,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface MagicTokenPayload {
  standupInstanceId: string;
  teamMemberId: string;
  platformUserId: string;
  orgId: string;
  exp: number;
  iat: number;
}

export interface BackendStandupInfoResponse {
  instance: {
    id: string;
    targetDate: string;
    createdAt: string;
    state: string;
    timeoutAt: string;
  };
  team: {
    id: string;
    name: string;
  };
  member: {
    id: string;
    name: string;
    platformUserId: string;
  };
  questions: string[];
  hasExistingResponses: boolean;
}

export interface MagicTokenStandupInfo {
  instanceId: string;
  teamName: string;
  questions: string[];
  targetDate: string;
  memberName: string;
  timeRemaining?: string;
  hasExistingResponses: boolean;
}

export interface MagicTokenSubmissionResponse {
  success: boolean;
  message: string;
  answersSubmitted: number;
}

export const magicTokenApiClient = {
  /**
   * Validate a magic token and get standup information
   */
  async validateTokenAndGetInfo(token: string): Promise<MagicTokenStandupInfo> {
    const response = await magicTokenApi.get<BackendStandupInfoResponse>(
      '/magic-token/standup-info',
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    // Transform backend response to frontend format
    const backendData = response.data;
    return {
      instanceId: backendData.instance.id,
      teamName: backendData.team.name,
      questions: backendData.questions,
      targetDate: backendData.instance.targetDate,
      memberName: backendData.member.name,
      hasExistingResponses: backendData.hasExistingResponses,
      // Calculate time remaining if needed
      timeRemaining: this.calculateTimeRemaining(backendData.instance.timeoutAt),
    };
  },

  /**
   * Submit standup responses using magic token
   */
  async submitWithMagicToken(
    token: string,
    answers: Array<{ questionIndex: number; answer: string }>
  ): Promise<MagicTokenSubmissionResponse> {
    const response = await magicTokenApi.post<MagicTokenSubmissionResponse>(
      '/magic-token/submit',
      { answers },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  },

  /**
   * Calculate time remaining from timeout date
   */
  calculateTimeRemaining(timeoutAt: string): string | undefined {
    try {
      const timeout = new Date(timeoutAt);
      const now = new Date();
      const diffMs = timeout.getTime() - now.getTime();

      if (diffMs <= 0) {
        return 'Time expired';
      }

      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      } else if (minutes > 0) {
        return `${minutes}m`;
      } else {
        return 'Less than 1 minute';
      }
    } catch {
      return undefined;
    }
  },
};
