-- AlterTable
ALTER TABLE "public"."TeamMember" ADD COLUMN     "integrationUserId" TEXT;

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

-- CreateIndex
CREATE INDEX "IntegrationUser_integrationId_isDeleted_idx" ON "public"."IntegrationUser"("integrationId", "isDeleted");

-- CreateIndex
CREATE INDEX "IntegrationUser_integrationId_externalUserId_idx" ON "public"."IntegrationUser"("integrationId", "externalUserId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationUser_integrationId_externalUserId_key" ON "public"."IntegrationUser"("integrationId", "externalUserId");

-- AddForeignKey
ALTER TABLE "public"."IntegrationUser" ADD CONSTRAINT "IntegrationUser_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "public"."Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeamMember" ADD CONSTRAINT "TeamMember_integrationUserId_fkey" FOREIGN KEY ("integrationUserId") REFERENCES "public"."IntegrationUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
