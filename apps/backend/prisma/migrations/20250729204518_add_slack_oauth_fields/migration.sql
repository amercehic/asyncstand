-- AlterTable
ALTER TABLE "Integration" ADD COLUMN     "appId" TEXT,
ADD COLUMN     "botToken" TEXT,
ADD COLUMN     "botUserId" TEXT,
ALTER COLUMN "refreshToken" DROP NOT NULL;
