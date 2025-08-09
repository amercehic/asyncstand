export interface DailyStandupJob {
  date: Date;
}

export interface CollectionStartJob {
  instanceId: string;
  teamId: string;
}

export interface CollectionTimeoutJob {
  instanceId: string;
  timeoutMinutes: number;
}

export interface CleanupJob {
  cutoffDate: Date;
}

export interface JobResult {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
}

export enum JobType {
  CREATE_DAILY_STANDUPS = 'create-daily-standups',
  START_COLLECTION = 'start-collection',
  COLLECTION_TIMEOUT = 'collection-timeout',
  CLEANUP_OLD_INSTANCES = 'cleanup-old-instances',
}

export interface ScheduledJob {
  id: string;
  type: JobType;
  data: unknown;
  scheduledFor: Date;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  lastAttemptAt?: Date;
  completedAt?: Date;
  error?: string;
}
