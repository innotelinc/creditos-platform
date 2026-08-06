import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TenancyService } from "../common/tenancy";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyService,
    private readonly audit: AuditService,
  ) {}

  async mine() {
    const tenantId = this.tenancy.getTenantId();
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException("Tenant not found");
    const [users, reports, disputes, activeDisputes] = await Promise.all([
      this.prisma.user.count({ where: { tenantId } }),
      this.prisma.creditReport.count({ where: { tenantId } }),
      this.prisma.dispute.count({ where: { tenantId } }),
      this.prisma.dispute.count({ where: { tenantId, status: { in: ["ACTIVE", "PENDING_CLIENT", "PENDING_ATTORNEY", "ESCALATED"] } } }),
    ]);
    return { ...tenant, stats: { users, reports, disputes, activeDisputes } };
  }

  async updateBranding(input: { name?: string; brandColor?: string; logoUrl?: string; timezone?: string; settings?: Record<string, unknown> }) {
    const tenantId = this.tenancy.getTenantId();
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: input.name,
        brandColor: input.brandColor,
        logoUrl: input.logoUrl,
        timezone: input.timezone,
        settings: input.settings as Prisma.InputJsonValue | undefined,
      },
    });
    await this.audit.log({ action: "tenant.branding.updated", entity: "Tenant", entityId: tenantId });
    return tenant;
  }

  async featureFlags() {
    const tenantId = this.tenancy.getTenantId();
    const flags = await this.prisma.featureFlag.findMany({
      where: { OR: [{ tenantId }, { tenantId: null }] },
    });
    return { items: flags };
  }

  async allTenants() {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { users: true, reports: true, disputes: true } } },
    });
    return { items: tenants };
  }

  async globalStats() {
    const [tenants, users, reports, disputes, letters] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.user.count(),
      this.prisma.creditReport.count(),
      this.prisma.dispute.count(),
      this.prisma.letter.count(),
    ]);
    return { tenants, users, reports, disputes, letters };
  }
}
