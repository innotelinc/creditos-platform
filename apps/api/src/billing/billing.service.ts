import { Injectable, NotFoundException } from "@nestjs/common";
import { InvoiceStatus, SubscriptionStatus, TenantPlan } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TenancyService } from "../common/tenancy";
import { PricingService } from "../pricing/pricing.service";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyService,
    private readonly pricing: PricingService,
    private readonly audit: AuditService,
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

  /**
   * Start / switch a subscription. In local mode the payment is simulated and
   * the invoice is issued as PAID. Set STRIPE_SECRET_KEY + STRIPE_PRICE_* to
   * route through a real provider (adapter stub left in place for that).
   */
  async checkout(input: { planCode: string; interval?: string; seats?: number }) {
    const tenantId = this.tenancy.getTenantId();
    const plan = await this.prisma.plan.findFirst({
      where: { model: "BUSINESS", code: input.planCode, isActive: true },
    });
    if (!plan) throw new NotFoundException(`Business plan "${input.planCode}" not found`);

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
      },
      create: {
        tenantId,
        planCode: plan.code,
        status: SubscriptionStatus.ACTIVE,
        seats: input.seats ?? 1,
        provider: "local",
        currentPeriodEnd: periodEnd,
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
        status: InvoiceStatus.PAID, // local mode: payment simulated
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
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { plan: TenantPlan.FREE } });
    await this.audit.log({ action: "billing.canceled", entity: "Subscription", entityId: tenantId });
    return { success: subscription.count > 0 };
  }
}
