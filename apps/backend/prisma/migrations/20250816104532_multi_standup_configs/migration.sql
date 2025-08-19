/*
  Warnings:

  - You are about to drop the column `channelId` on the `Team` table. All the data in the column will be lost.
  - You are about to drop the column `slackChannelId` on the `Team` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Team" DROP CONSTRAINT "Team_channelId_fkey";

-- DropIndex
DROP INDEX "public"."Team_integrationId_slackChannelId_idx";

-- AlterTable
ALTER TABLE "public"."StandupConfig" ADD COLUMN     "targetChannelId" TEXT;

-- AlterTable
ALTER TABLE "public"."Team" DROP COLUMN "channelId",
DROP COLUMN "slackChannelId";

-- CreateIndex
CREATE INDEX "StandupConfig_targetChannelId_idx" ON "public"."StandupConfig"("targetChannelId");

-- CreateIndex
CREATE INDEX "Team_integrationId_idx" ON "public"."Team"("integrationId");

-- AddForeignKey
ALTER TABLE "public"."StandupConfig" ADD CONSTRAINT "StandupConfig_targetChannelId_fkey" FOREIGN KEY ("targetChannelId") REFERENCES "public"."Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
