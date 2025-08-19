-- Add performance indexes for critical queries

-- Team management indexes
CREATE INDEX IF NOT EXISTS idx_team_org_created ON "Team"("orgId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_team_org_name ON "Team"("orgId", "name");

-- Organization member indexes
CREATE INDEX IF NOT EXISTS idx_orgmember_org_status_joined ON "OrgMember"("orgId", "status", "joinedAt" DESC);
CREATE INDEX IF NOT EXISTS idx_orgmember_user_org ON "OrgMember"("userId", "orgId");

-- Channel indexes for performance
CREATE INDEX IF NOT EXISTS idx_channel_integration_archived ON "Channel"("integrationId", "isArchived");
CREATE INDEX IF NOT EXISTS idx_channel_org_platform_status ON "Channel"("integrationId") WHERE "isArchived" = false;

-- Integration indexes
CREATE INDEX IF NOT EXISTS idx_integration_org_platform_status ON "Integration"("orgId", "platform", "tokenStatus");

-- Standup config indexes
CREATE INDEX IF NOT EXISTS idx_standupconfig_team_active ON "StandupConfig"("teamId", "isActive");
CREATE INDEX IF NOT EXISTS idx_standupconfig_channel_active ON "StandupConfig"("channelId", "isActive") WHERE "isActive" = true;

-- Team member indexes
CREATE INDEX IF NOT EXISTS idx_teammember_team_active ON "TeamMember"("teamId", "active");

-- CSRF session indexes for cache performance
CREATE INDEX IF NOT EXISTS idx_session_tokens ON "Session"("id", "expiresAt") WHERE "expiresAt" > NOW();

-- Audit log performance indexes
CREATE INDEX IF NOT EXISTS idx_auditlog_org_timestamp ON "AuditLog"("orgId", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_auditlog_user_timestamp ON "AuditLog"("actorUserId", "timestamp" DESC) WHERE "actorUserId" IS NOT NULL;