import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SubscriptionStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { StripeService } from "./stripe.service";

export type PullAllowanceMode = "included" | "metered" | "blocked";

export interface PullAllowance {
  planCode: string | null;
  /** Bundled pulls per billing period on the active plan. */
  included: number;
  /** Successful pulls already used in the current period. */
  used: number;
  remaining: number;
  overage: boolean;
  /** Decision for the next pull in this period. */
  mode: PullAllowanceMode;
  /** Per-pull overage price in cents (used when mode === "metered"). */
  overageCents: number;
}

/**
 * Monthly pull-allowance enforcement.
 *
 * Every plan bundles a number of automatic credit pulls per billing period
 * (`Plan.pullsIncluded`). Usage is measured by counting successful ReportPull
 * rows since the current usage period started (Subscription.usagePeriodStart,
 * lazily rolled forward once currentPeriodEnd passes).
 *
 * When the allowance is exhausted:
 *   - metered — Stripe metered billing: each overage pull is reported via a
 *     usage record on the subscription's metered item and charged on the next
 *     Stripe invoice (only possible when Stripe is configured, the subscription
 *     carries the metered item, and CREDIT_PULL_OVERAGE_POLICY=metered).
 *   - blocked — pulls are rejected with 402 Payment Required (local mode or no
 *     metered item attached).
 */
@Injectable()
export class PullAllowanceService {
  private readonly logger = new Logger(PullAllowanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly stripe: StripeService,
  ) {}

  async evaluate(tenantId: string): Promise<PullAllowance> {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    const zero = (): PullAllowance => ({
      planCode: sub?.planCode ?? null,
      included: 0,
      used: 0,
      remaining: 0,
      overage: false,
      mode: "blocked",
      overageCents: this.overageCents(),
    });
    // No subscription / not active — the subscription gate already blocks the
    // workspace; report a blocked allowance so callers behave consistently.
    if (!sub || sub.status !== SubscriptionStatus.ACTIVE) return zero();

    const now = new Date();
    let periodStart = sub.usagePeriodStart ?? sub.createdAt;
    if (sub.currentPeriodEnd && sub.currentPeriodEnd <= now) {
      // The billing period has rolled — usage resets at the previous period end.
      // Local-mode subscriptions don't auto-renew, so also advance the period
      // end by a month to keep the allowance window rolling monthly. Stripe
      // subscriptions are corrected by the renewal webhook (current_period_start).
      periodStart = sub.currentPeriodEnd;
      const roll: { usagePeriodStart: Date; currentPeriodEnd?: Date } = { usagePeriodStart: periodStart };
      if (sub.provider === "local") {
        const nextEnd = new Date(sub.currentPeriodEnd);
        nextEnd.setMonth(nextEnd.getMonth() + 1);
        roll.currentPeriodEnd = nextEnd;
      }
      await this.prisma.subscription
        .update({ where: { tenantId }, data: roll })
        .catch(() => undefined);
    }

    // Note: the allowance check is read-then-act with no lock — two concurrent
    // pulls at the boundary could both take the last bundled pull (one free pull
    // leak, never double-billing). Accepted risk for manually-triggered pulls.

    const plan = await this.prisma.plan.findFirst({
      where: { code: sub.planCode, isActive: true },
    });
    const included = plan?.pullsIncluded ?? 0;
    const used = await this.prisma.reportPull.count({
      where: { tenantId, status: "SUCCESS", createdAt: { gte: periodStart } },
    });
    const overage = used >= included;

    let mode: PullAllowanceMode = "included";
    if (overage) {
      const metered =
        this.policy() === "metered" && this.stripe.isConfigured && !!sub.usageItemId;
      mode = metered ? "metered" : "blocked";
    }

    return {
      planCode: sub.planCode,
      included,
      used,
      remaining: Math.max(0, included - used),
      overage,
      mode,
      overageCents: this.overageCents(),
    };
  }

  /** Report one metered overage pull to Stripe (best-effort — never fails the pull). */
  async recordMeteredUsage(tenantId: string): Promise<void> {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub?.usageItemId) return; // metered price not attached to this subscription
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const customerId = ((tenant?.settings as Record<string, unknown> | null)?.stripeCustomerId as
      | string
      | undefined);
    if (!customerId) {
      // Flag for review rather than failing the pull — the ReportPull row still
      // records the overage cost so nothing is lost.
      this.logger.error(`Metered usage record skipped for ${tenantId}: no Stripe customer id on tenant`);
      return;
    }
    try {
      await this.stripe.reportUsage(customerId, 1);
    } catch (err) {
      this.logger.error(`Metered usage record failed for ${tenantId}: ${(err as Error).message}`);
    }
  }

  private policy(): "metered" | "block" {
    return (this.config.get<string>("CREDIT_PULL_OVERAGE_POLICY") ?? "metered") === "block"
      ? "block"
      : "metered";
  }

  private overageCents(): number {
    return this.config.get<number>("CREDIT_PULL_OVERAGE_CENTS") ?? 1500;
  }
}
