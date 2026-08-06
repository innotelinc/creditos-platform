import { Injectable } from "@nestjs/common";
import { TenantPlan } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Feature entitlements per tenant plan (business model). Used for plan gating
 * (e.g. CRM requires BUSINESS) and surfaced to the Billing page.
 */
const ENTITLEMENTS: Record<TenantPlan, string[]> = {
  FREE: ["reports", "analysis", "letters", "disputes"],
  TRIAL: ["reports", "analysis", "letters", "disputes", "client_portal", "bureau_reader", "automation", "crm", "api", "white_label"],
  STARTER: ["reports", "analysis", "letters", "disputes", "client_portal"],
  PROFESSIONAL: ["reports", "analysis", "letters", "disputes", "client_portal", "bureau_reader", "automation"],
  BUSINESS: ["reports", "analysis", "letters", "disputes", "client_portal", "bureau_reader", "automation", "crm", "api", "white_label"],
  ENTERPRISE: ["reports", "analysis", "letters", "disputes", "client_portal", "bureau_reader", "automation", "crm", "api", "white_label", "sso", "custom_ai"],
};

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Feature set granted by a tenant plan. */
  entitlements(plan: TenantPlan): string[] {
    return ENTITLEMENTS[plan] ?? ENTITLEMENTS.FREE;
  }

  /** True when the tenant's plan grants the given feature. */
  isEntitled(plan: TenantPlan, feature: string): boolean {
    return this.entitlements(plan).includes(feature);
  }

  /** Public catalog: active plans grouped by model, ordered for display.
   *  Excludes legacy FREE plans — all plans are paid with a 3-day trial. */
  async catalog() {
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true, code: { not: "FREE" } },
      orderBy: [{ model: "asc" }, { sortOrder: "asc" }],
    });
    return {
      business: plans.filter((p) => p.model === "BUSINESS"),
      consumer: plans.filter((p) => p.model === "CONSUMER"),
    };
  }

  async listAll() {
    return this.prisma.plan.findMany({ orderBy: [{ model: "asc" }, { sortOrder: "asc" }] });
  }

  async create(input: {
    model: "BUSINESS" | "CONSUMER";
    code: string;
    name: string;
    description?: string;
    priceCents: number;
    interval?: "MONTH" | "YEAR" | "ONE_TIME";
    popular?: boolean;
    isActive?: boolean;
    sortOrder?: number;
    features?: string[];
  }) {
    return this.prisma.plan.create({ data: { ...input, features: input.features ?? [] } });
  }

  async update(
    id: string,
    input: Partial<{
      name: string;
      description: string;
      priceCents: number;
      interval: "MONTH" | "YEAR" | "ONE_TIME";
      popular: boolean;
      isActive: boolean;
      sortOrder: number;
      features: string[];
    }>,
  ) {
    return this.prisma.plan.update({ where: { id }, data: input });
  }

  async remove(id: string) {
    await this.prisma.plan.delete({ where: { id } });
    return { success: true };
  }
}
