import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InvoiceStatus, Role, SubscriptionStatus, TenantPlan } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TenancyService } from "../common/tenancy";
import { PricingService } from "../pricing/pricing.service";
import { AuditService } from "../audit/audit.service";
import { StripeService } from "./stripe.service";
import { PullAllowanceService } from "./pulls-allowance.service";

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyService,
    private readonly pricing: PricingService,
    private readonly audit: AuditService,
    private readonly stripe: StripeService,
    private readonly config: ConfigService,
    private readonly allowance: PullAllowanceService,
  ) {}

  /**
   * Access control for the workspace billing endpoints. Historically admin-only;
   * CLIENT users are now allowed when they belong to a self-signup consumer
   * tenant (registered with model=CONSUMER, `settings.isConsumer`) so they can
   * buy the Credit Monitoring plan straight from the Billing page. Agency-managed
   * clients and non-admin staff stay blocked.
   */
  private async billingAccess() {
    const tenantId = this.tenancy.getTenantId();
    const user = this.tenancy.getUser();
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException("Tenant not found");

    let isConsumer = (tenant.settings as Record<string, unknown> | null)?.isConsumer === true;
    if (user.role === Role.CLIENT && !isConsumer) {
      // Legacy self-signup consumers (created before the flag existed) are a
      // single-user tenant — treat them as consumers and persist it. The
      // "exactly one user" check also keeps this from ever opening billing up
      // to clients of an agency that happens to have no staff left.
      const totalUsers = await this.prisma.user.count({ where: { tenantId } });
      if (totalUsers === 1) {
        isConsumer = true;
        await this.prisma.tenant.update({
          where: { id: tenantId },
          data: {
            settings: { ...((tenant.settings as Record<string, unknown>) ?? {}), isConsumer: true },
          },
        });
      }
    }

    if (user.role === Role.CLIENT) {
      if (!isConsumer) throw new ForbiddenException("Client accounts can't manage workspace billing.");
    } else if (user.role !== Role.ADMIN && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException("Only workspace admins can manage billing.");
    }

    return { tenant, isConsumer, user };
  }

  async summary() {
    const { tenant } = await this.billingAccess();
    const tenantId = tenant.id;
    const subscription = await this.prisma.subscription.findUnique({ where: { tenantId } });
    const invoices = await this.prisma.invoice.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 12,
    });
    const [clients, reports, lettersSent, pulls] = await Promise.all([
      this.prisma.user.count({ where: { tenantId, role: "CLIENT" } }),
      this.prisma.creditReport.count({ where: { tenantId } }),
      this.prisma.letter.count({ where: { tenantId } }),
      this.prisma.reportPull.count({ where: { tenantId, status: "SUCCESS" } }),
    ]);
    return {
      tenant: { id: tenant?.id, name: tenant?.name, plan: tenant?.plan },
      subscription,
      invoices,
      usage: { clients, reports, lettersSent, pulls },
      // Current pull-allowance usage vs the plan's bundled allowance.
      allowance: await this.allowance.evaluate(tenantId),
      entitlements: tenant ? this.pricing.entitlements(tenant.plan as TenantPlan) : [],
    };
  }

  /** Lightweight subscription status for the current tenant — no admin
   *  permission required, so any authenticated user can render the paywall. */
  async status() {
    const tenantId = this.tenancy.getTenantId();
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    // No free trials: only an ACTIVE subscription unlocks the workspace.
    const blocked = !sub || sub.status !== SubscriptionStatus.ACTIVE;
    return {
      status: sub?.status ?? null,
      planCode: sub?.planCode ?? null,
      trialEndsAt: null,
      blocked,
    };
  }

  /**
   * Start / switch a subscription. When Stripe is configured, creates a
   * Checkout Session and returns the URL for the frontend to redirect to.
   * Falls back to local/simulated mode when STRIPE_SECRET_KEY is not set.
   *
   * Self-service consumers (CLIENT role on a consumer tenant) may only buy the
   * Credit Monitoring plan — the only service priced for direct consumer sale.
   */
  async checkout(input: { planCode: string; interval?: string; seats?: number; model?: "BUSINESS" | "CONSUMER" }) {
    const { tenant, isConsumer, user } = await this.billingAccess();
    const tenantId = tenant.id;
    const model = input.model ?? (isConsumer ? "CONSUMER" : "BUSINESS");
    const plan = await this.prisma.plan.findFirst({
      where: { model, code: input.planCode, isActive: true },
    });
    if (!plan) throw new NotFoundException(`Plan "${input.planCode}" not found`);

    // Self-service consumers may only subscribe to Credit Monitoring.
    if (user.role === Role.CLIENT) {
      if (plan.model !== "CONSUMER" || plan.code !== "MONITORING") {
        throw new ForbiddenException("Consumer accounts can only subscribe to Credit Monitoring.");
      }
    }

    const appUrl = this.config.get<string>("APP_URL") ?? "http://localhost:3000";

    // ── Stripe mode ──────────────────────────────────────────────────
    // When Stripe is configured we must never silently grant an unpaid local
    // subscription — a price-creation failure throws (502/500) rather than
    // falling back, so billing state can't diverge from Stripe.
    if (this.stripe.isConfigured) {
      let priceId = plan.stripePriceId;
      if (!priceId) {
        // Consumer plans (e.g. MONITORING) aren't pre-wired to Stripe — create
        // a recurring price on demand and cache it on the plan row.
        priceId = await this.stripe.ensurePriceForPlan({
          code: plan.code,
          name: plan.name,
          priceCents: plan.priceCents,
          interval: plan.interval,
        });
        await this.prisma.plan.update({ where: { id: plan.id }, data: { stripePriceId: priceId } });
      }

      // Attach the metered overage price so excess pulls are billed via usage
      // records. If it can't be created, checkout still proceeds — overage
      // pulls will simply be blocked (no metered item on the subscription).
      let meteredPriceId: string | undefined;
      try {
        meteredPriceId = await this.stripe.ensureMeteredPrice(
          this.config.get<number>("CREDIT_PULL_OVERAGE_CENTS") ?? 1500,
        );
      } catch (err) {
        this.logger.warn(
          `Could not create metered overage price: ${(err as Error).message} — overage pulls will be blocked`,
        );
      }

      // No free trials — the first checkout charges immediately.
      const session = await this.stripe.createCheckoutSession({
        customerEmail: user.email,
        tenantId,
        priceId,
        planCode: plan.code,
        trialPeriodDays: 0,
        meteredPriceId,
        successUrl: `${appUrl}/billing?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${appUrl}/billing?canceled=true`,
      });

      return { url: session.url, provider: "stripe" };
    }

    // ── Local / simulated mode ───────────────────────────────────────
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    // Consumers subscribe per-tenant, so seat counts don't apply — force 1.
    const seats = isConsumer ? 1 : (input.seats ?? 1);
    const subscription = await this.prisma.subscription.upsert({
      where: { tenantId },
      update: {
        planCode: plan.code,
        status: SubscriptionStatus.ACTIVE,
        seats,
        provider: "local",
        currentPeriodEnd: periodEnd,
        trialEndsAt: null,
        usagePeriodStart: now,
      },
      create: {
        tenantId,
        planCode: plan.code,
        status: SubscriptionStatus.ACTIVE,
        seats,
        provider: "local",
        currentPeriodEnd: periodEnd,
        trialEndsAt: null,
        usagePeriodStart: now,
      },
    });

    // Consumer plan codes (MONITORING) aren't TenantPlan enum values — the
    // subscription row carries the code; only business plans sync tenant.plan.
    if (plan.model === "BUSINESS") {
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { plan: plan.code as TenantPlan },
      });
    }

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
    const { tenant } = await this.billingAccess();
    const tenantId = tenant.id;
    const subscription = await this.prisma.subscription.updateMany({
      where: { tenantId, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING, SubscriptionStatus.PAST_DUE] } },
      data: { status: SubscriptionStatus.CANCELED },
    });
    await this.audit.log({ action: "billing.canceled", entity: "Subscription", entityId: tenantId });
    return { success: subscription.count > 0 };
  }

  /** Create a Stripe Customer Portal session so the user can manage their subscription. */
  async portal() {
    const { tenant } = await this.billingAccess();
    const tenantId = tenant.id;

    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub || sub.provider !== "stripe" || !sub.providerRef) {
      throw new NotFoundException("No active Stripe subscription found. Switch to a paid plan first.");
    }

    // Look up the Stripe customer ID: stored on the tenant during checkout.session.completed
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
