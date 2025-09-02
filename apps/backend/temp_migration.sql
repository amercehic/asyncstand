-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."OrgRole" AS ENUM ('owner', 'admin', 'member');

-- CreateEnum
CREATE TYPE "public"."OrgMemberStatus" AS ENUM ('invited', 'active', 'suspended');

-- CreateEnum
CREATE TYPE "public"."IntegrationPlatform" AS ENUM ('slack', 'teams');

-- CreateEnum
CREATE TYPE "public"."TokenStatus" AS ENUM ('ok', 'expired', 'revoked');

-- CreateEnum
CREATE TYPE "public"."StandupDeliveryType" AS ENUM ('channel', 'direct_message');

-- CreateEnum
CREATE TYPE "public"."StandupInstanceState" AS ENUM ('pending', 'collecting', 'posted');

-- CreateEnum
CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'canceled');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "twofaSecret" TEXT,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PasswordResetToken" (
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenIp" TEXT,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "fingerprint" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrgMember" (
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "public"."OrgRole" NOT NULL,
    "status" "public"."OrgMemberStatus" NOT NULL,
    "inviteToken" TEXT,
    "invitedAt" TIMESTAMP(3),
    "invitedById" TEXT,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "OrgMember_pkey" PRIMARY KEY ("orgId","userId")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorPlatformUserId" TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'user',
    "action" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "requestData" JSONB,
    "responseData" JSONB,
    "resources" JSONB,
    "sessionId" TEXT,
    "correlationId" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "executionTime" INTEGER,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Integration" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "platform" "public"."IntegrationPlatform" NOT NULL,
    "externalTeamId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "tokenStatus" "public"."TokenStatus" NOT NULL,
    "scopes" TEXT[],
    "userScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "installedByUserId" TEXT,
    "botToken" TEXT,
    "botUserId" TEXT,
    "appId" TEXT,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IntegrationSyncState" (
    "integrationId" TEXT NOT NULL,
    "lastUsersSyncAt" TIMESTAMP(3),
    "lastChannelsSyncAt" TIMESTAMP(3),
    "errorMsg" TEXT,

    CONSTRAINT "IntegrationSyncState_pkey" PRIMARY KEY ("integrationId")
);

-- CreateTable
CREATE TABLE "public"."Channel" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "topic" TEXT,
    "purpose" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "memberCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncAt" TIMESTAMP(3),

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IntegrationUser" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "name" TEXT,
    "displayName" TEXT,
    "email" TEXT,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "profileImage" TEXT,
    "timezone" TEXT,
    "platformData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncAt" TIMESTAMP(3),

    CONSTRAINT "IntegrationUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Team" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "platformUserId" TEXT,
    "integrationUserId" TEXT,
    "userId" TEXT,
    "name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "addedByUserId" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StandupConfig" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deliveryType" "public"."StandupDeliveryType" NOT NULL DEFAULT 'channel',
    "targetChannelId" TEXT,
    "questions" TEXT[],
    "weekdays" INTEGER[],
    "timeLocal" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "reminderMinutesBefore" INTEGER NOT NULL DEFAULT 10,
    "responseTimeoutHours" INTEGER NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StandupConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StandupConfigMember" (
    "standupConfigId" TEXT NOT NULL,
    "teamMemberId" TEXT NOT NULL,
    "include" BOOLEAN NOT NULL,
    "role" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StandupConfigMember_pkey" PRIMARY KEY ("standupConfigId","teamMemberId")
);

-- CreateTable
CREATE TABLE "public"."StandupInstance" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "configSnapshot" JSONB NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "state" "public"."StandupInstanceState" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reminderMessageTs" TEXT,
    "summaryMessageTs" TEXT,

    CONSTRAINT "StandupInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StandupDigestPost" (
    "standupInstanceId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageTs" TEXT NOT NULL,

    CONSTRAINT "StandupDigestPost_pkey" PRIMARY KEY ("standupInstanceId")
);

-- CreateTable
CREATE TABLE "public"."Answer" (
    "standupInstanceId" TEXT NOT NULL,
    "teamMemberId" TEXT NOT NULL,
    "questionIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("standupInstanceId","teamMemberId","questionIndex")
);

-- CreateTable
CREATE TABLE "public"."ParticipationSnapshot" (
    "id" TEXT NOT NULL,
    "standupInstanceId" TEXT NOT NULL,
    "answersCount" INTEGER NOT NULL,
    "membersMissing" INTEGER NOT NULL,

    CONSTRAINT "ParticipationSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BillingAccount" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "billingEmail" TEXT,
    "defaultPaymentMethod" TEXT,
    "taxId" TEXT,
    "country" TEXT,

    CONSTRAINT "BillingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Plan" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(65,30) NOT NULL,
    "interval" TEXT NOT NULL DEFAULT 'month',
    "stripePriceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "memberLimit" INTEGER,
    "teamLimit" INTEGER,
    "standupLimit" INTEGER,
    "storageLimit" INTEGER,
    "integrationLimit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PlanFeature" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "value" TEXT,

    CONSTRAINT "PlanFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Feature" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "environment" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rolloutType" TEXT NOT NULL DEFAULT 'boolean',
    "rolloutValue" JSONB,
    "category" TEXT,
    "isPlanBased" BOOLEAN NOT NULL DEFAULT false,
    "requiresAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feature_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."FeatureOverride" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "value" TEXT,
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Subscription" (
    "id" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "planId" TEXT NOT NULL,
    "status" "public"."SubscriptionStatus" NOT NULL,
    "renewsAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SubscriptionEvent" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PlanHistory" (
    "subscriptionId" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "planId" TEXT NOT NULL,

    CONSTRAINT "PlanHistory_pkey" PRIMARY KEY ("subscriptionId","validFrom")
);

-- CreateTable
CREATE TABLE "public"."TokenRefreshJob" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "lastAttemptAt" TIMESTAMP(3),
    "errorMsg" TEXT,

    CONSTRAINT "TokenRefreshJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebhookFailure" (
    "id" TEXT NOT NULL,
    "webhookType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastErrorMsg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookFailure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "User_email_createdAt_idx" ON "public"."User"("email", "createdAt");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "public"."User"("createdAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_token_idx" ON "public"."PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "Session_userId_issuedAt_idx" ON "public"."Session"("userId", "issuedAt");

-- CreateIndex
CREATE INDEX "Session_revokedAt_idx" ON "public"."Session"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "public"."RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_createdAt_idx" ON "public"."RefreshToken"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrgMember_inviteToken_key" ON "public"."OrgMember"("inviteToken");

-- CreateIndex
CREATE INDEX "OrgMember_inviteToken_idx" ON "public"."OrgMember"("inviteToken");

-- CreateIndex
CREATE UNIQUE INDEX "OrgMember_orgId_userId_key" ON "public"."OrgMember"("orgId", "userId");

-- CreateIndex
CREATE INDEX "AuditLog_orgId_createdAt_idx" ON "public"."AuditLog"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_orgId_category_createdAt_idx" ON "public"."AuditLog"("orgId", "category", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_orgId_severity_createdAt_idx" ON "public"."AuditLog"("orgId", "severity", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_orgId_actorUserId_createdAt_idx" ON "public"."AuditLog"("orgId", "actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_correlationId_idx" ON "public"."AuditLog"("correlationId");

-- CreateIndex
CREATE INDEX "AuditLog_sessionId_idx" ON "public"."AuditLog"("sessionId");

-- CreateIndex
CREATE INDEX "Integration_tokenStatus_idx" ON "public"."Integration"("tokenStatus");

-- CreateIndex
CREATE INDEX "Integration_orgId_platform_idx" ON "public"."Integration"("orgId", "platform");

-- CreateIndex
CREATE INDEX "Integration_orgId_tokenStatus_idx" ON "public"."Integration"("orgId", "tokenStatus");

-- CreateIndex
CREATE INDEX "Integration_expiresAt_idx" ON "public"."Integration"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_orgId_platform_externalTeamId_key" ON "public"."Integration"("orgId", "platform", "externalTeamId");

-- CreateIndex
CREATE INDEX "Channel_integrationId_isArchived_idx" ON "public"."Channel"("integrationId", "isArchived");

-- CreateIndex
CREATE INDEX "Channel_name_idx" ON "public"."Channel"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_integrationId_channelId_key" ON "public"."Channel"("integrationId", "channelId");

-- CreateIndex
CREATE INDEX "IntegrationUser_integrationId_isDeleted_idx" ON "public"."IntegrationUser"("integrationId", "isDeleted");

-- CreateIndex
CREATE INDEX "IntegrationUser_integrationId_externalUserId_idx" ON "public"."IntegrationUser"("integrationId", "externalUserId");

-- CreateIndex
CREATE INDEX "IntegrationUser_email_idx" ON "public"."IntegrationUser"("email");

-- CreateIndex
CREATE INDEX "IntegrationUser_isDeleted_isBot_idx" ON "public"."IntegrationUser"("isDeleted", "isBot");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationUser_integrationId_externalUserId_key" ON "public"."IntegrationUser"("integrationId", "externalUserId");

-- CreateIndex
CREATE INDEX "Team_integrationId_idx" ON "public"."Team"("integrationId");

-- CreateIndex
CREATE INDEX "Team_orgId_createdAt_idx" ON "public"."Team"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Team_orgId_name_key" ON "public"."Team"("orgId", "name");

-- CreateIndex
CREATE INDEX "TeamMember_teamId_addedAt_idx" ON "public"."TeamMember"("teamId", "addedAt");

-- CreateIndex
CREATE INDEX "TeamMember_integrationUserId_idx" ON "public"."TeamMember"("integrationUserId");

-- CreateIndex
CREATE INDEX "TeamMember_platformUserId_idx" ON "public"."TeamMember"("platformUserId");

-- CreateIndex
CREATE INDEX "TeamMember_userId_teamId_idx" ON "public"."TeamMember"("userId", "teamId");

-- CreateIndex
CREATE INDEX "TeamMember_active_teamId_idx" ON "public"."TeamMember"("active", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_platformUserId_key" ON "public"."TeamMember"("teamId", "platformUserId");

-- CreateIndex
CREATE UNIQUE INDEX "unique_team_user" ON "public"."TeamMember"("teamId", "userId");

-- CreateIndex
CREATE INDEX "StandupConfig_targetChannelId_idx" ON "public"."StandupConfig"("targetChannelId");

-- CreateIndex
CREATE INDEX "StandupConfig_teamId_isActive_idx" ON "public"."StandupConfig"("teamId", "isActive");

-- CreateIndex
CREATE INDEX "StandupConfig_deliveryType_isActive_idx" ON "public"."StandupConfig"("deliveryType", "isActive");

-- CreateIndex
CREATE INDEX "StandupConfig_timezone_isActive_idx" ON "public"."StandupConfig"("timezone", "isActive");

-- CreateIndex
CREATE INDEX "StandupConfig_teamId_createdAt_idx" ON "public"."StandupConfig"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "StandupInstance_teamId_targetDate_idx" ON "public"."StandupInstance"("teamId", "targetDate");

-- CreateIndex
CREATE INDEX "StandupInstance_state_targetDate_idx" ON "public"."StandupInstance"("state", "targetDate");

-- CreateIndex
CREATE INDEX "StandupInstance_teamId_state_idx" ON "public"."StandupInstance"("teamId", "state");

-- CreateIndex
CREATE INDEX "StandupInstance_targetDate_state_idx" ON "public"."StandupInstance"("targetDate", "state");

-- CreateIndex
CREATE UNIQUE INDEX "StandupDigestPost_standupInstanceId_key" ON "public"."StandupDigestPost"("standupInstanceId");

-- CreateIndex
CREATE INDEX "Answer_teamMemberId_idx" ON "public"."Answer"("teamMemberId");

-- CreateIndex
CREATE INDEX "Answer_standupInstanceId_submittedAt_idx" ON "public"."Answer"("standupInstanceId", "submittedAt");

-- CreateIndex
CREATE INDEX "Answer_teamMemberId_submittedAt_idx" ON "public"."Answer"("teamMemberId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingAccount_orgId_key" ON "public"."BillingAccount"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_key_key" ON "public"."Plan"("key");

-- CreateIndex
CREATE INDEX "Plan_isActive_sortOrder_idx" ON "public"."Plan"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "PlanFeature_featureKey_idx" ON "public"."PlanFeature"("featureKey");

-- CreateIndex
CREATE UNIQUE INDEX "PlanFeature_planId_featureKey_key" ON "public"."PlanFeature"("planId", "featureKey");

-- CreateIndex
CREATE INDEX "Feature_isEnabled_environment_idx" ON "public"."Feature"("isEnabled", "environment");

-- CreateIndex
CREATE INDEX "Feature_category_idx" ON "public"."Feature"("category");

-- CreateIndex
CREATE INDEX "FeatureOverride_orgId_idx" ON "public"."FeatureOverride"("orgId");

-- CreateIndex
CREATE INDEX "FeatureOverride_featureKey_idx" ON "public"."FeatureOverride"("featureKey");

-- CreateIndex
CREATE INDEX "FeatureOverride_expiresAt_idx" ON "public"."FeatureOverride"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureOverride_orgId_featureKey_key" ON "public"."FeatureOverride"("orgId", "featureKey");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_billingAccountId_key" ON "public"."Subscription"("billingAccountId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "public"."Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_renewsAt_idx" ON "public"."Subscription"("renewsAt");

-- CreateIndex
CREATE INDEX "Subscription_planId_idx" ON "public"."Subscription"("planId");

-- CreateIndex
CREATE INDEX "PlanHistory_planId_idx" ON "public"."PlanHistory"("planId");

-- CreateIndex
CREATE INDEX "TokenRefreshJob_integrationId_idx" ON "public"."TokenRefreshJob"("integrationId");

-- AddForeignKey
ALTER TABLE "public"."PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrgMember" ADD CONSTRAINT "OrgMember_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrgMember" ADD CONSTRAINT "OrgMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrgMember" ADD CONSTRAINT "OrgMember_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Integration" ADD CONSTRAINT "Integration_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Integration" ADD CONSTRAINT "Integration_installedByUserId_fkey" FOREIGN KEY ("installedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IntegrationSyncState" ADD CONSTRAINT "IntegrationSyncState_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "public"."Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Channel" ADD CONSTRAINT "Channel_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "public"."Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IntegrationUser" ADD CONSTRAINT "IntegrationUser_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "public"."Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Team" ADD CONSTRAINT "Team_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Team" ADD CONSTRAINT "Team_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "public"."Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Team" ADD CONSTRAINT "Team_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeamMember" ADD CONSTRAINT "TeamMember_integrationUserId_fkey" FOREIGN KEY ("integrationUserId") REFERENCES "public"."IntegrationUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeamMember" ADD CONSTRAINT "TeamMember_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StandupConfig" ADD CONSTRAINT "StandupConfig_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StandupConfig" ADD CONSTRAINT "StandupConfig_targetChannelId_fkey" FOREIGN KEY ("targetChannelId") REFERENCES "public"."Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StandupConfig" ADD CONSTRAINT "StandupConfig_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StandupConfigMember" ADD CONSTRAINT "StandupConfigMember_standupConfigId_fkey" FOREIGN KEY ("standupConfigId") REFERENCES "public"."StandupConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StandupConfigMember" ADD CONSTRAINT "StandupConfigMember_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "public"."TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StandupInstance" ADD CONSTRAINT "StandupInstance_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StandupDigestPost" ADD CONSTRAINT "StandupDigestPost_standupInstanceId_fkey" FOREIGN KEY ("standupInstanceId") REFERENCES "public"."StandupInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StandupDigestPost" ADD CONSTRAINT "StandupDigestPost_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "public"."Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Answer" ADD CONSTRAINT "Answer_standupInstanceId_fkey" FOREIGN KEY ("standupInstanceId") REFERENCES "public"."StandupInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Answer" ADD CONSTRAINT "Answer_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "public"."TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParticipationSnapshot" ADD CONSTRAINT "ParticipationSnapshot_standupInstanceId_fkey" FOREIGN KEY ("standupInstanceId") REFERENCES "public"."StandupInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BillingAccount" ADD CONSTRAINT "BillingAccount_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlanFeature" ADD CONSTRAINT "PlanFeature_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlanFeature" ADD CONSTRAINT "PlanFeature_featureKey_fkey" FOREIGN KEY ("featureKey") REFERENCES "public"."Feature"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FeatureOverride" ADD CONSTRAINT "FeatureOverride_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FeatureOverride" ADD CONSTRAINT "FeatureOverride_featureKey_fkey" FOREIGN KEY ("featureKey") REFERENCES "public"."Feature"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Subscription" ADD CONSTRAINT "Subscription_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "public"."BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubscriptionEvent" ADD CONSTRAINT "SubscriptionEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "public"."Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlanHistory" ADD CONSTRAINT "PlanHistory_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "public"."Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlanHistory" ADD CONSTRAINT "PlanHistory_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TokenRefreshJob" ADD CONSTRAINT "TokenRefreshJob_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "public"."Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

