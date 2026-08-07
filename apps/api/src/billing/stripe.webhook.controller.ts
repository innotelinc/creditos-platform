import { BadRequestException, Controller, HttpCode, HttpStatus, Logger, Post, RawBodyRequest, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import { SubscriptionStatus, TenantPlan } from "@prisma/client";
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

  /** Normalize a plan code from Stripe metadata to a valid TenantPlan, or null. */
  private validPlanCode(code: string | undefined | null): TenantPlan | null {
    if (!code) return null;
    const plan = code.toUpperCase() as TenantPlan;
    return Object.values(TenantPlan).includes(plan) ? plan : null;
  }

  /** Keep the tenant plan in sync with the subscribed plan so entitlements
   *  and gating reflect what was actually purchased (valid TenantPlan codes only). */
  private async syncTenantPlan(tenantId: string, plan: TenantPlan) {
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { plan } });
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const { tenantId, planCode } = session.metadata ?? {};
    if (!tenantId || !planCode) {
      this.logger.warn(`checkout.session.completed missing metadata: ${session.id}`);
      return;
    }
    // planCode may be a consumer code (e.g. MONITORING) that isn't a TenantPlan
    // enum value — it is stored verbatim on the subscription row. Only the
    // tenant plan (entitlements/gating) is synced for valid business codes.
    const tenantPlan = this.validPlanCode(planCode);

    // session.subscription is an id string in real webhook payloads, but can be
    // the expanded object when the session was retrieved with expand — accept both.
    const sub = session.subscription as string | Stripe.Subscription | null;
    const subId = typeof sub === "string" ? sub : (sub?.id ?? null);
    const customerId = typeof session.customer === "string" ? session.customer : null;

    // The subscription may still be in its Stripe trial (trialing) when the
    // checkout completes — carry over the Stripe trial period so the billing
    // page shows the correct status and trial end date. Also capture the
    // metered overage subscription item (pull-allowance billing) and the
    // current usage period start.
    let status: SubscriptionStatus = SubscriptionStatus.ACTIVE;
    let trialEndsAt: Date | null = null;
    let usagePeriodStart: Date | null = null;
    let usageItemId: string | null = null;
    if (subId && this.stripe.client) {
      try {
        const stripeSub = await this.stripe.client.subscriptions.retrieve(subId);
        if (stripeSub.status === "trialing") {
          status = SubscriptionStatus.TRIALING;
          trialEndsAt = stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : null;
        }
        const periodStartRaw = (stripeSub as Stripe.Subscription & { current_period_start?: number | null })
          .current_period_start;
        usagePeriodStart = periodStartRaw ? new Date(periodStartRaw * 1000) : null;
        usageItemId =
          stripeSub.items?.data?.find(
            (it) => it.price?.active !== false && it.price?.metadata?.creditos_plan_code === "PULL_OVERAGE",
          )?.id ?? null;
      } catch (err: any) {
        this.logger.warn(`Could not retrieve Stripe subscription ${subId}: ${err?.message}`);
      }
    }

    // usagePeriodStart/usageItemId are written unconditionally (null clears a
    // stale value) so a removed metered item stops billing overages instead of
    // reporting usage Stripe will never invoice.
    await this.prisma.subscription.upsert({
      where: { tenantId },
      update: {
        planCode,
        status,
        provider: "stripe",
        providerRef: subId,
        trialEndsAt,
        usagePeriodStart,
        usageItemId,
      },
      create: {
        tenantId,
        planCode,
        status,
        provider: "stripe",
        providerRef: subId,
        trialEndsAt,
        usagePeriodStart,
        usageItemId,
      },
    });

    // Store the Stripe customer ID on the tenant for future reference,
    // preserving existing settings (e.g. isConsumer on self-signup tenants).
    if (customerId) {
      const current = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { settings: true },
      });
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          settings: { ...((current?.settings as Record<string, unknown>) ?? {}), stripeCustomerId: customerId },
        },
      });
    }

    if (tenantPlan) await this.syncTenantPlan(tenantId, tenantPlan);

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
    // The current Stripe API surfaces the period end via billing_schedules
    // (bill_until.computed_timestamp) rather than current_period_end; older API
    // shapes may still send current_period_end, and it can be null while a
    // subscription is trialing — accept any of them, never a Date(NaN).
    const periodEndRaw =
      (sub as Stripe.Subscription & { current_period_end?: number | null }).current_period_end ??
      sub.billing_schedules?.[0]?.bill_until?.computed_timestamp ??
      sub.trial_end;
    const currentPeriodEnd = periodEndRaw ? new Date(periodEndRaw * 1000) : null;
    const periodStartRaw = (sub as Stripe.Subscription & { current_period_start?: number | null })
      .current_period_start;
    const usagePeriodStart = periodStartRaw ? new Date(periodStartRaw * 1000) : null;
    // Plan changes made in the Stripe portal surface here — derive the plan code
    // from the subscription item's price metadata when available. Consumer codes
    // (e.g. MONITORING) are stored verbatim; only business codes sync tenant.plan.
    const rawPriceCode = sub.items?.data?.[0]?.price?.metadata?.creditos_plan_code;
    const pricePlan = this.validPlanCode(rawPriceCode);
    // Keep the metered overage item in sync (portal plan changes / item changes).
    // Written unconditionally so a removed item clears the id and stops billing.
    const usageItemId =
      sub.items?.data?.find(
        (it) => it.price?.active !== false && it.price?.metadata?.creditos_plan_code === "PULL_OVERAGE",
      )?.id ?? null;

    await this.prisma.subscription.update({
      where: { id: existing.id },
      data: {
        status: newStatus,
        currentPeriodEnd,
        trialEndsAt: newStatus === SubscriptionStatus.TRIALING ? trialEndsAt : null,
        ...(rawPriceCode ? { planCode: rawPriceCode } : {}),
        usagePeriodStart,
        usageItemId,
      },
    });
    if (pricePlan) await this.syncTenantPlan(existing.tenantId, pricePlan);

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
