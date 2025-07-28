-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('owner', 'admin', 'member');

-- CreateEnum
CREATE TYPE "OrgMemberStatus" AS ENUM ('invited', 'active', 'suspended');

-- CreateEnum
CREATE TYPE "IntegrationPlatform" AS ENUM ('slack', 'teams');

-- CreateEnum
CREATE TYPE "TokenStatus" AS ENUM ('ok', 'expired', 'revoked');

-- CreateEnum
CREATE TYPE "StandupInstanceState" AS ENUM ('pending', 'collecting', 'posted');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'canceled');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "twofaSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenIp" TEXT,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
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
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgMember" (
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL,
    "status" "OrgMemberStatus" NOT NULL,

    CONSTRAINT "OrgMember_pkey" PRIMARY KEY ("orgId","userId")
);

-- CreateTable
CREATE TABLE "AuditLog" (
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
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "platform" "IntegrationPlatform" NOT NULL,
    "externalTeamId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "tokenStatus" "TokenStatus" NOT NULL,
    "scopes" TEXT[],
    "installedByUserId" TEXT,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationSyncState" (
    "integrationId" TEXT NOT NULL,
    "lastUsersSyncAt" TIMESTAMP(3),
    "lastChannelsSyncAt" TIMESTAMP(3),
    "errorMsg" TEXT,

    CONSTRAINT "IntegrationSyncState_pkey" PRIMARY KEY ("integrationId")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "integrationId" TEXT,
    "channelId" TEXT,
    "name" TEXT,
    "timezone" TEXT NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "platformUserId" TEXT,
    "userId" TEXT,
    "name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandupConfig" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "questions" TEXT[],
    "weekdays" INTEGER[],
    "timeLocal" TEXT NOT NULL,
    "reminderMinutesBefore" INTEGER NOT NULL DEFAULT 10,

    CONSTRAINT "StandupConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandupConfigMember" (
    "standupConfigId" TEXT NOT NULL,
    "teamMemberId" TEXT NOT NULL,
    "include" BOOLEAN NOT NULL,

    CONSTRAINT "StandupConfigMember_pkey" PRIMARY KEY ("standupConfigId","teamMemberId")
);

-- CreateTable
CREATE TABLE "StandupInstance" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "configSnapshot" JSONB NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "state" "StandupInstanceState" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StandupInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandupDigestPost" (
    "standupInstanceId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageTs" TEXT NOT NULL,

    CONSTRAINT "StandupDigestPost_pkey" PRIMARY KEY ("standupInstanceId")
);

-- CreateTable
CREATE TABLE "Answer" (
    "standupInstanceId" TEXT NOT NULL,
    "teamMemberId" TEXT NOT NULL,
    "questionIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("standupInstanceId","teamMemberId","questionIndex")
);

-- CreateTable
CREATE TABLE "ParticipationSnapshot" (
    "id" TEXT NOT NULL,
    "standupInstanceId" TEXT NOT NULL,
    "answersCount" INTEGER NOT NULL,
    "membersMissing" INTEGER NOT NULL,

    CONSTRAINT "ParticipationSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingAccount" (
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
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "memberQuota" INTEGER NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "renewsAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionEvent" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanHistory" (
    "subscriptionId" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "plan" TEXT NOT NULL,
    "memberQuota" INTEGER NOT NULL,

    CONSTRAINT "PlanHistory_pkey" PRIMARY KEY ("subscriptionId","validFrom")
);

-- CreateTable
CREATE TABLE "TokenRefreshJob" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "lastAttemptAt" TIMESTAMP(3),
    "errorMsg" TEXT,

    CONSTRAINT "TokenRefreshJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookFailure" (
    "id" TEXT NOT NULL,
    "webhookType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastErrorMsg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookFailure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_createdAt_idx" ON "RefreshToken"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_orgId_createdAt_idx" ON "AuditLog"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_orgId_category_createdAt_idx" ON "AuditLog"("orgId", "category", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_orgId_severity_createdAt_idx" ON "AuditLog"("orgId", "severity", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_orgId_actorUserId_createdAt_idx" ON "AuditLog"("orgId", "actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_correlationId_idx" ON "AuditLog"("correlationId");

-- CreateIndex
CREATE INDEX "AuditLog_sessionId_idx" ON "AuditLog"("sessionId");

-- CreateIndex
CREATE INDEX "Integration_tokenStatus_idx" ON "Integration"("tokenStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_orgId_platform_externalTeamId_key" ON "Integration"("orgId", "platform", "externalTeamId");

-- CreateIndex
CREATE INDEX "Team_integrationId_channelId_idx" ON "Team"("integrationId", "channelId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_platformUserId_key" ON "TeamMember"("teamId", "platformUserId");

-- CreateIndex
CREATE UNIQUE INDEX "unique_team_user" ON "TeamMember"("teamId", "userId");

-- CreateIndex
CREATE INDEX "StandupInstance_teamId_targetDate_idx" ON "StandupInstance"("teamId", "targetDate");

-- CreateIndex
CREATE UNIQUE INDEX "StandupDigestPost_standupInstanceId_key" ON "StandupDigestPost"("standupInstanceId");

-- CreateIndex
CREATE INDEX "Answer_teamMemberId_idx" ON "Answer"("teamMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingAccount_orgId_key" ON "BillingAccount"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_billingAccountId_key" ON "Subscription"("billingAccountId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_renewsAt_idx" ON "Subscription"("renewsAt");

-- CreateIndex
CREATE INDEX "TokenRefreshJob_integrationId_idx" ON "TokenRefreshJob"("integrationId");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_installedByUserId_fkey" FOREIGN KEY ("installedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSyncState" ADD CONSTRAINT "IntegrationSyncState_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandupConfig" ADD CONSTRAINT "StandupConfig_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandupConfigMember" ADD CONSTRAINT "StandupConfigMember_standupConfigId_fkey" FOREIGN KEY ("standupConfigId") REFERENCES "StandupConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandupConfigMember" ADD CONSTRAINT "StandupConfigMember_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandupInstance" ADD CONSTRAINT "StandupInstance_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandupDigestPost" ADD CONSTRAINT "StandupDigestPost_standupInstanceId_fkey" FOREIGN KEY ("standupInstanceId") REFERENCES "StandupInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandupDigestPost" ADD CONSTRAINT "StandupDigestPost_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_standupInstanceId_fkey" FOREIGN KEY ("standupInstanceId") REFERENCES "StandupInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipationSnapshot" ADD CONSTRAINT "ParticipationSnapshot_standupInstanceId_fkey" FOREIGN KEY ("standupInstanceId") REFERENCES "StandupInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingAccount" ADD CONSTRAINT "BillingAccount_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionEvent" ADD CONSTRAINT "SubscriptionEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanHistory" ADD CONSTRAINT "PlanHistory_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenRefreshJob" ADD CONSTRAINT "TokenRefreshJob_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
