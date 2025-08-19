/*
  Warnings:

  - A unique constraint covering the columns `[orgId,name]` on the table `Team` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Team_orgId_name_key" ON "public"."Team"("orgId", "name");
