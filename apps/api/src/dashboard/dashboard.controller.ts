import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { DisputeStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TenancyService } from "../common/tenancy";
import { CurrentUser } from "../common/decorators";
import { AuthUser } from "../common/types";

const ACTIVE_DISPUTE_STATUSES: DisputeStatus[] = ["ACTIVE", "PENDING_CLIENT", "PENDING_ATTORNEY", "ESCALATED"];

@ApiTags("dashboard")
@ApiBearerAuth()
@Controller("dashboard")
export class DashboardController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyService,
  ) {}

  @Get("summary")
  @ApiOperation({ summary: "Aggregated dashboard metrics (role-aware)" })
  async summary(@CurrentUser() user: AuthUser) {
    const tenantId = this.tenancy.getTenantId();
    const isStaff = user.role !== "CLIENT";
    // Client-role users only see their own records; staff see the whole tenant.
    const clientScope = isStaff ? {} : { clientId: user.id };

    const [scores, negative, disputes, disputeStats, letters, tasks, notifications, reports] = await Promise.all([
      this.prisma.scoreSnapshot.findMany({
        orderBy: { scoreDate: "desc" },
        take: 1,
        include: { report: { select: { clientId: true, bureau: true } } },
        where: { report: isStaff ? { tenantId } : { clientId: user.id } },
      }),
      this.prisma.creditAccount.aggregate({
        _count: { _all: true },
        where: { isNegative: true, report: isStaff ? { tenantId } : { clientId: user.id } },
      }),
      this.prisma.dispute.findMany({
        where: { tenantId, ...clientScope, status: { in: ACTIVE_DISPUTE_STATUSES } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: { client: { select: { id: true, name: true } } },
      }),
      this.prisma.dispute.groupBy({ by: ["status"], where: { tenantId, ...clientScope }, _count: { _all: true } }),
      this.prisma.letter.aggregate({ _count: { _all: true }, where: { tenantId, ...clientScope } }),
      this.prisma.task.findMany({ where: { tenantId, ...clientScope, status: { in: ["TODO", "IN_PROGRESS"] } }, orderBy: { dueAt: "asc" }, take: 8 }),
      this.prisma.notification.count({ where: { userId: user.id, readAt: null } }),
      this.prisma.creditReport.count({ where: { tenantId, ...clientScope } }),
    ]);

    const latestScore = scores[0] ?? null;
    const negativeAccounts = await this.prisma.creditAccount.findMany({
      where: { isNegative: true, report: isStaff ? { tenantId } : { clientId: user.id } },
      select: { negativeFlags: true },
    });

    const negativeCounts = {
      collections: negativeAccounts.filter((a) => (a.negativeFlags as string[]).includes("collection")).length,
      latePayments: negativeAccounts.filter((a) => (a.negativeFlags as string[]).some((f) => f.includes("late"))).length,
      chargeOffs: negativeAccounts.filter((a) => (a.negativeFlags as string[]).includes("charge_off")).length,
      bankruptcies: negativeAccounts.filter((a) => (a.negativeFlags as string[]).includes("bankruptcy")).length,
    };

    return {
      user: { id: user.id, role: user.role, isStaff },
      latestScore,
      negativeAccounts: negative._count._all,
      negativeCounts,
      disputes: disputes,
      disputeStats: Object.fromEntries(disputeStats.map((d) => [d.status, d._count._all])),
      lettersSent: letters._count._all,
      tasks,
      unreadNotifications: notifications,
      reportsCount: reports,
      generatedAt: new Date().toISOString(),
    };
  }
}
