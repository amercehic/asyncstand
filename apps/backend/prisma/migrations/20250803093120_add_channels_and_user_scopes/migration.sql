/*
  Warnings:

  - A unique constraint covering the columns `[integrationId,slackChannelId]` on the table `Team` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slackChannelId` to the `Team` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."Team_integrationId_channelId_idx";

-- DropIndex
DROP INDEX "public"."Team_integrationId_channelId_key";

-- AlterTable
ALTER TABLE "public"."Integration" ADD COLUMN     "userScopes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "public"."Team" ADD COLUMN     "slackChannelId" TEXT NOT NULL,
ALTER COLUMN "channelId" DROP NOT NULL;

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

-- CreateIndex
CREATE INDEX "Channel_integrationId_isArchived_idx" ON "public"."Channel"("integrationId", "isArchived");

-- CreateIndex
CREATE INDEX "Channel_name_idx" ON "public"."Channel"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_integrationId_channelId_key" ON "public"."Channel"("integrationId", "channelId");

-- CreateIndex
CREATE INDEX "Team_integrationId_slackChannelId_idx" ON "public"."Team"("integrationId", "slackChannelId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_integrationId_slackChannelId_key" ON "public"."Team"("integrationId", "slackChannelId");

-- AddForeignKey
ALTER TABLE "public"."Channel" ADD CONSTRAINT "Channel_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "public"."Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Team" ADD CONSTRAINT "Team_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "public"."Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
