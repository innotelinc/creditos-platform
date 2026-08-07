import { Module } from "@nestjs/common";
import { BillingService } from "./billing.service";
import { BillingController } from "./billing.controller";
import { StripeService } from "./stripe.service";
import { StripeWebhookController } from "./stripe.webhook.controller";
import { PullAllowanceService } from "./pulls-allowance.service";
import { PricingModule } from "../pricing/pricing.module";

@Module({
  imports: [PricingModule],
  controllers: [BillingController, StripeWebhookController],
  providers: [BillingService, StripeService, PullAllowanceService],
  exports: [BillingService, PullAllowanceService],
})
export class BillingModule {}
