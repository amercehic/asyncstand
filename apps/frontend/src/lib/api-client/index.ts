export { api, setAuthToken, getAuthToken, clearCsrfToken } from '@/lib/api-client/client';
export { authApi } from '@/lib/api-client/auth';
export { teamsApi } from '@/lib/api-client/teams';
export { standupsApi } from '@/lib/api-client/standups';
export { integrationsApi } from '@/lib/api-client/integrations/slack';
export { organizationApi } from '@/lib/api-client/organization';
export { featuresApi } from '@/lib/api-client/features';
export type { SlackIntegration, SlackSyncResponse } from '@/lib/api-client/integrations/slack';
export type { Organization, OrgMember, OrgRole } from '@/lib/api-client/organization';
export type {
  FeatureCheckResult,
  QuotaCheckResult,
  Feature,
  Plan,
} from '@/lib/api-client/features';

// Export types from the types module
export type {
  User,
  Team,
  Standup,
  StandupConfig,
  StandupInstance,
  StandupResponse,
  ActiveStandup,
  CreateTeamRequest,
  UpdateTeamRequest,
  CreateStandupConfigRequest,
} from '@/types';
