import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InvoiceStatus, SubscriptionStatus, TenantPlan } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TenancyService } from "../common/tenancy";
import { PricingService } from "../pricing/pricing.service";
import { AuditService } from "../audit/audit.service";
import { StripeService } from "./stripe.service";

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyService,
    private readonly pricing: PricingService,
    private readonly audit: AuditService,
    private readonly stripe: StripeService,
    private readonly config: ConfigService,
  ) {}

  async summary() {
    const tenantId = this.tenancy.getTenantId();
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const subscription = await this.prisma.subscription.findUnique({ where: { tenantId } });
    const invoices = await this.prisma.invoice.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 12,
    });
    const [clients, reports, lettersSent] = await Promise.all([
      this.prisma.user.count({ where: { tenantId, role: "CLIENT" } }),
      this.prisma.creditReport.count({ where: { tenantId } }),
      this.prisma.letter.count({ where: { tenantId } }),
    ]);
    return {
      tenant: { id: tenant?.id, name: tenant?.name, plan: tenant?.plan },
      subscription,
      invoices,
      usage: { clients, reports, lettersSent },
      entitlements: tenant ? this.pricing.entitlements(tenant.plan as TenantPlan) : [],
    };
  }

  /** Start a 3-day trial for a newly registered tenant. */
  async startTrial(tenantId: string): Promise<void> {
    const trialEnds = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    await this.prisma.subscription.upsert({
      where: { tenantId },
      update: {
        planCode: "TRIAL",
        status: SubscriptionStatus.TRIALING,
        provider: "local",
        trialEndsAt: trialEnds,
      },
      create: {
        tenantId,
        planCode: "TRIAL",
        status: SubscriptionStatus.TRIALING,
        provider: "local",
        trialEndsAt: trialEnds,
      },
    });
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { plan: TenantPlan.TRIAL },
    });
  }

  /**
   * Start / switch a subscription. When Stripe is configured, creates a
   * Checkout Session and returns the URL for the frontend to redirect to.
   * Falls back to local/simulated mode when STRIPE_SECRET_KEY is not set.
   */
  async checkout(input: { planCode: string; interval?: string; seats?: number }) {
    const tenantId = this.tenancy.getTenantId();
    const plan = await this.prisma.plan.findFirst({
      where: { model: "BUSINESS", code: input.planCode, isActive: true },
    });
    if (!plan) throw new NotFoundException(`Business plan "${input.planCode}" not found`);

    // ── Stripe mode ──────────────────────────────────────────────────
    if (this.stripe.isConfigured && plan.stripePriceId) {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
      const adminUser = await this.prisma.user.findFirst({
        where: { tenantId, role: "ADMIN" },
      });
      const appUrl = this.config.get<string>("APP_URL") ?? "http://localhost:3000";

      const session = await this.stripe.createCheckoutSession({
        customerEmail: adminUser?.email ?? "",
        tenantId,
        priceId: plan.stripePriceId,
        planCode: plan.code,
        successUrl: `${appUrl}/billing?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${appUrl}/billing?canceled=true`,
      });

      return { url: session.url, provider: "stripe" };
    }

    // ── Local / simulated mode ───────────────────────────────────────
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const subscription = await this.prisma.subscription.upsert({
      where: { tenantId },
      update: {
        planCode: plan.code,
        status: SubscriptionStatus.ACTIVE,
        seats: input.seats ?? 1,
        provider: "local",
        currentPeriodEnd: periodEnd,
        trialEndsAt: null,
      },
      create: {
        tenantId,
        planCode: plan.code,
        status: SubscriptionStatus.ACTIVE,
        seats: input.seats ?? 1,
        provider: "local",
        currentPeriodEnd: periodEnd,
        trialEndsAt: null,
      },
    });

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { plan: plan.code as TenantPlan },
    });

    const count = await this.prisma.invoice.count({ where: { tenantId } });
    const invoice = await this.prisma.invoice.create({
      data: {
        tenantId,
        number: `INV-${now.getFullYear()}-${String(count + 1).padStart(4, "0")}`,
        description: `${plan.name} — monthly subscription`,
        amountCents: plan.priceCents,
        status: InvoiceStatus.PAID,
        periodStart: now,
        periodEnd,
        paidAt: now,
        lineItems: [
          { label: `${plan.name} plan`, amountCents: plan.priceCents },
          { label: "Tax (0%)", amountCents: 0 },
        ],
      },
    });

    await this.audit.log({
      action: "billing.checkout",
      entity: "Subscription",
      entityId: subscription.id,
      meta: { planCode: plan.code, priceCents: plan.priceCents, provider: "local" },
    });

    return { success: true, subscription, invoice, plan: { name: plan.name, priceCents: plan.priceCents } };
  }

  async cancel() {
    const tenantId = this.tenancy.getTenantId();
    const subscription = await this.prisma.subscription.updateMany({
      where: { tenantId, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING, SubscriptionStatus.PAST_DUE] } },
      data: { status: SubscriptionStatus.CANCELED },
    });
    await this.audit.log({ action: "billing.canceled", entity: "Subscription", entityId: tenantId });
    return { success: subscription.count > 0 };
  }

  /** Create a Stripe Customer Portal session so the user can manage their subscription. */
  async portal() {
    const tenantId = this.tenancy.getTenantId();

    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub || sub.provider !== "stripe" || !sub.providerRef) {
      throw new NotFoundException("No active Stripe subscription found. Switch to a paid plan first.");
    }

    // Look up the Stripe customer ID: stored on the tenant during checkout.session.completed
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const settings = (tenant?.settings ?? {}) as Record<string, unknown>;
    let customerId = settings.stripeCustomerId as string | undefined;

    // Fallback: fetch the subscription from Stripe to get the customer ID
    if (!customerId && this.stripe.client) {
      const stripeSub = await this.stripe.client.subscriptions.retrieve(sub.providerRef);
      customerId = stripeSub.customer as string;
    }

    if (!customerId) {
      throw new NotFoundException("Stripe customer not found. Please contact support.");
    }

    const appUrl = this.config.get<string>("APP_URL") ?? "http://localhost:3000";
    return this.stripe.createPortalSession({ customerId, returnUrl: `${appUrl}/billing` });
  }
}
