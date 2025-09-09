-- AlterTable
ALTER TABLE "public"."Plan" ADD COLUMN     "standupConfigLimit" INTEGER;

-- CreateIndex
CREATE INDEX "Subscription_stripeSubscriptionId_idx" ON "public"."Subscription"("stripeSubscriptionId");
