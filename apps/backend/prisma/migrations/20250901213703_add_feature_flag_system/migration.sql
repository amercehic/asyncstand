/*
  Warnings:

  - You are about to drop the column `memberQuota` on the `PlanHistory` table. All the data in the column will be lost.
  - You are about to drop the column `plan` on the `PlanHistory` table. All the data in the column will be lost.
  - You are about to drop the column `memberQuota` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `plan` on the `Subscription` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Organization` table without a default value. This is not possible if the table is not empty.
  - Added the required column `planId` to the `PlanHistory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `planId` to the `Subscription` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."OrgMember" ADD COLUMN     "invitedById" TEXT;

-- AlterTable
ALTER TABLE "public"."Organization" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."PlanHistory" DROP COLUMN "memberQuota",
DROP COLUMN "plan",
ADD COLUMN     "planId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."Subscription" DROP COLUMN "memberQuota",
DROP COLUMN "plan",
ADD COLUMN     "planId" TEXT NOT NULL,
ALTER COLUMN "stripeSubscriptionId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

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
CREATE INDEX "PlanHistory_planId_idx" ON "public"."PlanHistory"("planId");

-- CreateIndex
CREATE INDEX "Subscription_planId_idx" ON "public"."Subscription"("planId");

-- AddForeignKey
ALTER TABLE "public"."OrgMember" ADD CONSTRAINT "OrgMember_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlanFeature" ADD CONSTRAINT "PlanFeature_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlanFeature" ADD CONSTRAINT "PlanFeature_featureKey_fkey" FOREIGN KEY ("featureKey") REFERENCES "public"."Feature"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FeatureOverride" ADD CONSTRAINT "FeatureOverride_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FeatureOverride" ADD CONSTRAINT "FeatureOverride_featureKey_fkey" FOREIGN KEY ("featureKey") REFERENCES "public"."Feature"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlanHistory" ADD CONSTRAINT "PlanHistory_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
