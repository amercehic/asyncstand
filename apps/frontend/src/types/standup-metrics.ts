// Frontend types matching the backend DTOs
export interface StandupMetrics {
  averageResponseRate: number;
  averageResponseTime: number;
  completionStreak: number;
  totalInstances: number;
  completedInstances: number;
  bestDay: string;
  worstDay: string;
  trend: 'up' | 'down' | 'stable';
  cancelledInstances: number;
  successRate: number;
}

export interface MemberStats {
  id: string;
  name: string;
  email?: string;
  responseRate: number;
  averageResponseTime: number;
  lastResponseDate?: string;
  streak: number;
  totalResponses: number;
  skippedCount: number;
}

export interface RecentInstance {
  id: string;
  date: string;
  status: 'completed' | 'collecting' | 'cancelled';
  responseRate: number;
  respondedCount: number;
  totalCount: number;
  averageResponseTime?: number;
}

export interface StandupDetailsResponse {
  metrics: StandupMetrics;
  memberStats: MemberStats[];
  recentInstances: RecentInstance[];
}
