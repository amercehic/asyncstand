/*
  Warnings:

  - The values [owner,admin,member] on the enum `OrgRole` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[inviteToken]` on the table `OrgMember` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[orgId,userId]` on the table `OrgMember` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "OrgRole_new" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'SUSPENDED');
ALTER TABLE "OrgMember" ALTER COLUMN "role" TYPE "OrgRole_new" USING ("role"::text::"OrgRole_new");
ALTER TYPE "OrgRole" RENAME TO "OrgRole_old";
ALTER TYPE "OrgRole_new" RENAME TO "OrgRole";
DROP TYPE "OrgRole_old";
COMMIT;

-- AlterTable
ALTER TABLE "OrgMember" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "inviteToken" TEXT,
ADD COLUMN     "invitedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "OrgMember_inviteToken_key" ON "OrgMember"("inviteToken");

-- CreateIndex
CREATE INDEX "OrgMember_inviteToken_idx" ON "OrgMember"("inviteToken");

-- CreateIndex
CREATE UNIQUE INDEX "OrgMember_orgId_userId_key" ON "OrgMember"("orgId", "userId");
