import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BillingController } from '@/billing/controllers/billing.controller';
import { StripeWebhookController } from '@/billing/controllers/stripe-webhook.controller';
import { UsageController } from '@/billing/controllers/usage.controller';
import { BillingService } from '@/billing/services/billing.service';
import { StripeService } from '@/billing/services/stripe.service';
import { UsageTrackingService } from '@/billing/services/usage-tracking.service';
import { PlanEnforcementService } from '@/billing/services/plan-enforcement.service';
import { DowngradeValidationService } from '@/billing/services/downgrade-validation.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { LoggerService } from '@/common/logger.service';
import { AuditModule } from '@/common/audit/audit.module';

@Module({
  imports: [ConfigModule, PrismaModule, AuditModule],
  controllers: [BillingController, StripeWebhookController, UsageController],
  providers: [
    BillingService,
    StripeService,
    UsageTrackingService,
    PlanEnforcementService,
    DowngradeValidationService,
    LoggerService,
  ],
  exports: [
    BillingService,
    StripeService,
    UsageTrackingService,
    PlanEnforcementService,
    DowngradeValidationService,
  ],
})
export class BillingModule {}
