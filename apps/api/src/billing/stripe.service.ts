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
   * Create a Stripe Checkout Session for a subscription.
   * Returns the session URL the user should be redirected to.
   */
  async createCheckoutSession(params: {
    customerEmail: string;
    tenantId: string;
    priceId: string;
    planCode: string;
    trialPeriodDays?: number;
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
      line_items: [{ price: params.priceId, quantity: 1 }],
      metadata: { tenantId: params.tenantId, planCode: params.planCode },
      subscription_data: subscriptionData,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });

    return { url: session.url!, sessionId: session.id };
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
