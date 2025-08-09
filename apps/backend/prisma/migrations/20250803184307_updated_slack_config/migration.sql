/*
  Warnings:

  - A unique constraint covering the columns `[teamId]` on the table `StandupConfig` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `timezone` to the `StandupConfig` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `StandupConfig` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `StandupConfigMember` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."StandupConfig" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "responseTimeoutHours" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "timezone" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."StandupConfigMember" ADD COLUMN     "role" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "StandupConfig_teamId_key" ON "public"."StandupConfig"("teamId");

-- AddForeignKey
ALTER TABLE "public"."StandupConfig" ADD CONSTRAINT "StandupConfig_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
