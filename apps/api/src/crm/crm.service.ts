import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { CrmStage, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TenancyService } from "../common/tenancy";
import { PricingService } from "../pricing/pricing.service";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class CrmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyService,
    private readonly pricing: PricingService,
    private readonly audit: AuditService,
  ) {}

  /** CRM is a BUSINESS/ENTERPRISE entitlement (feature gating, spec §4.11). */
  private async ensureEntitled() {
    const tenantId = this.tenancy.getTenantId();
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || !this.pricing.isEntitled(tenant.plan, "crm")) {
      throw new ForbiddenException("The CRM module requires the Business or Enterprise plan");
    }
  }

  async pipeline() {
    await this.ensureEntitled();
    const tenantId = this.tenancy.getTenantId();
    const grouped = await this.prisma.crmLead.groupBy({
      by: ["stage"],
      where: { tenantId },
      _count: { _all: true },
      _sum: { value: true },
    });
    const totals = await this.prisma.crmLead.aggregate({
      where: { tenantId },
      _count: { _all: true },
      _sum: { value: true },
    });
    return {
      stages: Object.fromEntries(
        grouped.map((g) => [g.stage, { count: g._count._all, value: g._sum.value ?? 0 }]),
      ),
      totals: { leads: totals._count._all, value: totals._sum.value ?? 0 },
    };
  }

  async list(query: { stage?: CrmStage; search?: string; ownerId?: string; limit?: number; offset?: number }) {
    await this.ensureEntitled();
    const tenantId = this.tenancy.getTenantId();
    const where: Prisma.CrmLeadWhereInput = { tenantId };
    if (query.stage) where.stage = query.stage;
    if (query.ownerId) where.ownerId = query.ownerId;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
        { company: { contains: query.search, mode: "insensitive" } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.crmLead.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: query.limit ?? 100,
        skip: query.offset ?? 0,
        include: { owner: { select: { id: true, name: true } } },
      }),
      this.prisma.crmLead.count({ where }),
    ]);
    return { items, total };
  }

  async get(id: string) {
    await this.ensureEntitled();
    const tenantId = this.tenancy.getTenantId();
    const lead = await this.prisma.crmLead.findFirst({
      where: { id, tenantId },
      include: {
        owner: { select: { id: true, name: true } },
        activities: { orderBy: { createdAt: "desc" }, include: { createdBy: { select: { id: true, name: true } } } },
      },
    });
    if (!lead) throw new NotFoundException("Lead not found");
    return lead;
  }

  async create(input: {
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    source?: string;
    stage?: CrmStage;
    value?: number;
    ownerId?: string;
    tags?: string[];
    notes?: string;
    score?: number;
    nextFollowUpAt?: Date;
  }) {
    await this.ensureEntitled();
    const tenantId = this.tenancy.getTenantId();
    const lead = await this.prisma.crmLead.create({
      data: { ...input, tenantId, stage: input.stage ?? CrmStage.NEW, score: input.score ?? 0, tags: input.tags ?? [] },
    });
    await this.audit.log({ action: "crm.lead.created", entity: "CrmLead", entityId: lead.id, meta: { name: input.name } });
    return this.get(lead.id);
  }

  async update(
    id: string,
    input: Partial<{
      name: string;
      email: string;
      phone: string;
      company: string;
      source: string;
      stage: CrmStage;
      value: number;
      ownerId: string;
      tags: string[];
      notes: string;
      score: number;
      nextFollowUpAt: Date;
    }>,
  ) {
    await this.ensureEntitled();
    const tenantId = this.tenancy.getTenantId();
    const lead = await this.prisma.crmLead.findFirst({ where: { id, tenantId } });
    if (!lead) throw new NotFoundException("Lead not found");
    const data: Prisma.CrmLeadUpdateInput = { ...input };
    if (input.stage === "WON" && lead.stage !== "WON") data.wonAt = new Date();
    const updated = await this.prisma.crmLead.update({ where: { id }, data });
    if (input.stage) {
      await this.audit.log({ action: "crm.lead.stage.updated", entity: "CrmLead", entityId: id, meta: { stage: input.stage } });
    }
    return this.get(updated.id);
  }

  async addActivity(leadId: string, input: { type: string; subject: string; body?: string }, userId: string) {
    await this.ensureEntitled();
    const tenantId = this.tenancy.getTenantId();
    const lead = await this.prisma.crmLead.findFirst({ where: { id: leadId, tenantId } });
    if (!lead) throw new NotFoundException("Lead not found");
    const activity = await this.prisma.crmActivity.create({
      data: { tenantId, leadId, type: input.type as never, subject: input.subject, body: input.body, createdById: userId },
    });
    await this.audit.log({ action: "crm.activity.created", entity: "CrmLead", entityId: leadId, meta: { type: input.type } });
    return this.get(leadId).then(() => activity);
  }
}
