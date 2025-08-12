-- Remove unique constraint on teamId to allow multiple configs per team
ALTER TABLE "StandupConfig" DROP CONSTRAINT IF EXISTS "StandupConfig_teamId_key";

-- Add purpose column for different types of standups
ALTER TABLE "StandupConfig" ADD COLUMN "purpose" VARCHAR(20);