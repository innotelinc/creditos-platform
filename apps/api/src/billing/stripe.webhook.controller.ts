import { BadRequestException, Controller, HttpCode, HttpStatus, Logger, Post, RawBodyRequest, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import { SubscriptionStatus } from "@prisma/client";
import { StripeService } from "./stripe.service";
import { PrismaService } from "../prisma/prisma.service";
import { Public } from "../common/decorators";
import Stripe from "stripe";

@ApiTags("billing")
@Controller("billing/webhook")
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly stripe: StripeService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Stripe webhook endpoint — receives subscription lifecycle events" })
  async handle(@Req() req: RawBodyRequest<Request>) {
    if (!this.stripe.isConfigured) {
      throw new BadRequestException("Stripe is not configured");
    }

    const sig = req.headers["stripe-signature"] as string;
    const secret = this.config.get<string>("STRIPE_WEBHOOK_SECRET");
    if (!secret) throw new BadRequestException("STRIPE_WEBHOOK_SECRET not set");

    let event: Stripe.Event;
    try {
      event = this.stripe.constructWebhookEvent(req.rawBody!, sig, secret);
    } catch (err: any) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    this.logger.log(`Stripe webhook received: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await this.handleCheckoutCompleted(session);
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await this.handleSubscriptionUpdated(sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await this.handleSubscriptionDeleted(sub);
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await this.handleInvoicePaid(invoice);
        break;
      }
      default:
        this.logger.debug(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const { tenantId, planCode } = session.metadata ?? {};
    if (!tenantId || !planCode) {
      this.logger.warn(`checkout.session.completed missing metadata: ${session.id}`);
      return;
    }

    const subId = session.subscription as string;
    const customerId = session.customer as string;

    // The subscription may still be in its Stripe trial (trialing) when the
    // checkout completes — carry over the Stripe trial period so the billing
    // page shows the correct status and trial end date.
    let status: SubscriptionStatus = SubscriptionStatus.ACTIVE;
    let trialEndsAt: Date | null = null;
    if (subId && this.stripe.client) {
      try {
        const stripeSub = await this.stripe.client.subscriptions.retrieve(subId);
        if (stripeSub.status === "trialing") {
          status = SubscriptionStatus.TRIALING;
          trialEndsAt = stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : null;
        }
      } catch (err: any) {
        this.logger.warn(`Could not retrieve Stripe subscription ${subId}: ${err?.message}`);
      }
    }

    await this.prisma.subscription.upsert({
      where: { tenantId },
      update: {
        planCode,
        status,
        provider: "stripe",
        providerRef: subId,
        trialEndsAt,
      },
      create: {
        tenantId,
        planCode,
        status,
        provider: "stripe",
        providerRef: subId,
        trialEndsAt,
      },
    });

    // Store the Stripe customer ID on the tenant for future reference
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: { stripeCustomerId: customerId } },
    });

    this.logger.log(`Checkout completed: tenant=${tenantId} plan=${planCode} sub=${subId}`);
  }

  private async handleSubscriptionUpdated(sub: Stripe.Subscription) {
    // Find the subscription by Stripe providerRef
    const existing = await this.prisma.subscription.findFirst({
      where: { providerRef: sub.id, provider: "stripe" },
    });
    if (!existing) {
      this.logger.warn(`No local subscription found for Stripe sub ${sub.id}`);
      return;
    }

    const statusMap: Record<string, SubscriptionStatus> = {
      active: SubscriptionStatus.ACTIVE,
      past_due: SubscriptionStatus.PAST_DUE,
      unpaid: SubscriptionStatus.PAST_DUE,
      canceled: SubscriptionStatus.CANCELED,
      incomplete: SubscriptionStatus.TRIALING,
      incomplete_expired: SubscriptionStatus.CANCELED,
      trialing: SubscriptionStatus.TRIALING,
    };

    const newStatus = statusMap[sub.status] ?? SubscriptionStatus.ACTIVE;
    const trialEndsAt = sub.trial_end ? new Date(sub.trial_end * 1000) : null;

    await this.prisma.subscription.update({
      where: { id: existing.id },
      data: {
        status: newStatus,
        currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
        trialEndsAt: newStatus === SubscriptionStatus.TRIALING ? trialEndsAt : null,
      },
    });

    this.logger.log(`Subscription updated: ${existing.tenantId} → ${sub.status}`);
  }

  private async handleSubscriptionDeleted(sub: Stripe.Subscription) {
    await this.prisma.subscription.updateMany({
      where: { providerRef: sub.id, provider: "stripe" },
      data: { status: SubscriptionStatus.CANCELED },
    });
    this.logger.log(`Subscription deleted: Stripe sub ${sub.id}`);
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice) {
    const subId = (invoice as any).subscription as string;
    if (!subId) return;

    const existing = await this.prisma.subscription.findFirst({
      where: { providerRef: subId, provider: "stripe" },
    });
    if (!existing) return;

    const count = await this.prisma.invoice.count({ where: { tenantId: existing.tenantId } });
    await this.prisma.invoice.create({
      data: {
        tenantId: existing.tenantId,
        number: `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`,
        description: invoice.description ?? "Stripe subscription payment",
        amountCents: invoice.amount_paid,
        status: "PAID",
        periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : undefined,
        periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : undefined,
        paidAt: new Date(),
        providerRef: invoice.id,
        lineItems: invoice.lines?.data.map((li: any) => ({
          label: li.description ?? li.price?.nickname ?? "Subscription",
          amountCents: li.amount,
        })) ?? [],
      },
    });

    this.logger.log(`Invoice paid: tenant=${existing.tenantId} invoice=${invoice.id}`);
  }
}
