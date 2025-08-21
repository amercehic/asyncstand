-- CreateIndex
CREATE INDEX "Answer_standupInstanceId_submittedAt_idx" ON "public"."Answer"("standupInstanceId", "submittedAt");

-- CreateIndex
CREATE INDEX "Answer_teamMemberId_submittedAt_idx" ON "public"."Answer"("teamMemberId", "submittedAt");

-- CreateIndex
CREATE INDEX "Integration_orgId_platform_idx" ON "public"."Integration"("orgId", "platform");

-- CreateIndex
CREATE INDEX "Integration_orgId_tokenStatus_idx" ON "public"."Integration"("orgId", "tokenStatus");

-- CreateIndex
CREATE INDEX "Integration_expiresAt_idx" ON "public"."Integration"("expiresAt");

-- CreateIndex
CREATE INDEX "Session_userId_issuedAt_idx" ON "public"."Session"("userId", "issuedAt");

-- CreateIndex
CREATE INDEX "Session_revokedAt_idx" ON "public"."Session"("revokedAt");

-- CreateIndex
CREATE INDEX "StandupConfig_teamId_isActive_idx" ON "public"."StandupConfig"("teamId", "isActive");

-- CreateIndex
CREATE INDEX "StandupConfig_deliveryType_isActive_idx" ON "public"."StandupConfig"("deliveryType", "isActive");

-- CreateIndex
CREATE INDEX "StandupConfig_timezone_isActive_idx" ON "public"."StandupConfig"("timezone", "isActive");

-- CreateIndex
CREATE INDEX "StandupConfig_teamId_createdAt_idx" ON "public"."StandupConfig"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "StandupInstance_state_targetDate_idx" ON "public"."StandupInstance"("state", "targetDate");

-- CreateIndex
CREATE INDEX "StandupInstance_teamId_state_idx" ON "public"."StandupInstance"("teamId", "state");

-- CreateIndex
CREATE INDEX "StandupInstance_targetDate_state_idx" ON "public"."StandupInstance"("targetDate", "state");

-- CreateIndex
CREATE INDEX "User_email_createdAt_idx" ON "public"."User"("email", "createdAt");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "public"."User"("createdAt");
