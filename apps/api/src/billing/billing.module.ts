import { Module } from "@nestjs/common";
import { BillingService } from "./billing.service";
import { BillingController } from "./billing.controller";
import { StripeService } from "./stripe.service";
import { StripeWebhookController } from "./stripe.webhook.controller";
import { TrialExpiryService } from "./trial-expiry.service";
import { PricingModule } from "../pricing/pricing.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [PricingModule, NotificationsModule],
  controllers: [BillingController, StripeWebhookController],
  providers: [BillingService, StripeService, TrialExpiryService],
  exports: [BillingService],
})
export class BillingModule {}
