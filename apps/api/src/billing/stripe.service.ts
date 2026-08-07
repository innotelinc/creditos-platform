import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";

@Injectable()
export class StripeService implements OnModuleInit {
  private readonly logger = new Logger(StripeService.name);
  private _client: Stripe | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const key = this.config.get<string>("STRIPE_SECRET_KEY");
    if (key && key.length > 0) {
      // Use the SDK's default API version — pinning a hardcoded version string
      // throws "Invalid Stripe API version" when the SDK build changes.
      this._client = new Stripe(key);
      this.logger.log("Stripe client initialized");
    } else {
      this.logger.warn("STRIPE_SECRET_KEY not set — billing will use local/simulated mode");
    }
  }

  /** The Stripe SDK client, or null when Stripe is not configured. */
  get client(): Stripe | null {
    return this._client;
  }

  get isConfigured(): boolean {
    return this._client !== null;
  }

  /**
   * Resolve (reusing when possible) the Stripe Price ID for a plan, creating
   * the product + recurring/one-time price on demand. Mirrors the seed's
   * wiring so plans that weren't pre-seeded (e.g. the consumer Credit
   * Monitoring plan) can still be sold through real Stripe Checkout.
   */
  async ensurePriceForPlan(params: {
    code: string;
    name: string;
    priceCents: number;
    interval: "MONTH" | "YEAR" | "ONE_TIME";
  }): Promise<string> {
    if (!this._client) throw new Error("Stripe is not configured");

    const products = await this._client.products.list({ active: true, limit: 100 });
    const existing = products.data.find((prod) => prod.metadata?.creditos_plan_code === params.code);
    if (existing) {
      const prices = await this._client.prices.list({ product: existing.id, active: true, limit: 20 });
      // Stripe prices are immutable — reuse only when the amount and interval match.
      const match = prices.data.find((price) => {
        if (price.unit_amount !== params.priceCents) return false;
        if (params.interval === "ONE_TIME") return !price.recurring;
        return price.recurring?.interval === params.interval.toLowerCase();
      });
      if (match) return match.id;
    }

    const product =
      existing ??
      (await this._client.products.create({
        name: params.name,
        description: `CreditOS ${params.code} plan`,
        metadata: { creditos_plan_code: params.code },
      }));

    const price = await this._client.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: params.priceCents,
      recurring: params.interval === "MONTH" ? { interval: "month" } : undefined,
      metadata: { creditos_plan_code: params.code },
    });
    return price.id;
  }

  /**
   * Create a Stripe Checkout Session for a subscription.
   * Returns the session URL the user should be redirected to.
   */
  async createCheckoutSession(params: {
    customerEmail: string;
    tenantId: string;
    priceId: string;
    planCode: string;
    trialPeriodDays?: number;
    /** Optional metered price attached as a second subscription item — bills pull overages. */
    meteredPriceId?: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string; sessionId: string }> {
    if (!this._client) throw new Error("Stripe is not configured");

    // When trialPeriodDays > 0 the subscription is created with a Stripe trial
    // (trial runs through Stripe billing — no charge until it ends).
    const subscriptionData =
      params.trialPeriodDays && params.trialPeriodDays > 0
        ? { trial_period_days: params.trialPeriodDays }
        : undefined;

    const session = await this._client.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: params.customerEmail,
      line_items: [
        { price: params.priceId, quantity: 1 },
        // Usage-based (metered) items ignore quantity — usage is reported via
        // usage records as overage pulls happen.
        ...(params.meteredPriceId ? [{ price: params.meteredPriceId }] : []),
      ],
      metadata: { tenantId: params.tenantId, planCode: params.planCode },
      subscription_data: subscriptionData,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });

    return { url: session.url!, sessionId: session.id };
  }

  /** Meter event name used for credit-pull overage usage (Stripe Meter Events API). */
  private readonly overageEventName = "credit_pull_overage";

  /**
   * Resolve (creating when needed) the metering setup used to bill pull
   * overages: a billing Meter (event_name=credit_pull_overage) plus the shared
   * metered price that references it. The price is attached to subscriptions at
   * checkout; per-pull usage is attributed via reportUsage(customerId).
   */
  async ensureMeteredPrice(unitCents: number): Promise<string> {
    if (!this._client) throw new Error("Stripe is not configured");

    // Billing meter — aggregates usage per customer per period.
    const meters = await this._client.billing.meters.list({ limit: 100 });
    const meter =
      meters.data.find((m) => m.event_name === this.overageEventName) ??
      (await this._client.billing.meters.create({
        display_name: "Credit pull overage",
        event_name: this.overageEventName,
        default_aggregation: { formula: "sum" },
        customer_mapping: { event_payload_key: "stripe_customer_id", type: "by_id" },
        value_settings: { event_payload_key: "value" },
      }));

    // Metered price referencing the meter (one shared product).
    const products = await this._client.products.list({ active: true, limit: 100 });
    const product =
      products.data.find((p) => p.metadata?.creditos_plan_code === "PULL_OVERAGE") ??
      (await this._client.products.create({
        name: "Credit pull overage",
        description: "Per-pull charge beyond the plan's bundled pull allowance",
        metadata: { creditos_plan_code: "PULL_OVERAGE" },
      }));

    const prices = await this._client.prices.list({ product: product.id, active: true, limit: 20 });
    const existing = prices.data.find(
      (price) =>
        price.unit_amount === unitCents &&
        price.recurring?.interval === "month" &&
        price.recurring.usage_type === "metered" &&
        price.recurring.meter === meter.id,
    );
    if (existing) return existing.id;

    const price = await this._client.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: unitCents,
      recurring: { interval: "month", usage_type: "metered", meter: meter.id },
      metadata: { creditos_plan_code: "PULL_OVERAGE" },
    });
    return price.id;
  }

  /**
   * Report metered usage for one overage pull, attributed to the tenant's
   * Stripe customer. The metered price must be attached to the subscription
   * (checked by the caller via the subscription's usageItemId).
   */
  async reportUsage(customerId: string, quantity = 1): Promise<void> {
    if (!this._client) throw new Error("Stripe is not configured");
    await this._client.billing.meterEvents.create({
      event_name: this.overageEventName,
      payload: { stripe_customer_id: customerId, value: String(quantity) },
      timestamp: Math.floor(Date.now() / 1000),
    });
  }

  /**
   * Create a Stripe Customer Portal session so users can manage their
   * payment method, view invoices, and cancel/reactivate.
   */
  async createPortalSession(params: {
    customerId: string;
    returnUrl: string;
  }): Promise<{ url: string }> {
    if (!this._client) throw new Error("Stripe is not configured");

    const session = await this._client.billingPortal.sessions.create({
      customer: params.customerId,
      return_url: params.returnUrl,
    });

    return { url: session.url };
  }

  /** Verify a Stripe webhook signature and return the typed event. */
  constructWebhookEvent(rawBody: Buffer, signature: string, secret: string): Stripe.Event {
    if (!this._client) throw new Error("Stripe is not configured");
    return this._client.webhooks.constructEvent(rawBody, signature, secret);
  }
}
