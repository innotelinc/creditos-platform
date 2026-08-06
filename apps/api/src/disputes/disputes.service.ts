import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { DisputeStatus, Prisma, RoundStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TenancyService } from "../common/tenancy";
import { AuditService } from "../audit/audit.service";

export interface CreateDisputeInput {
  clientId: string;
  reportId?: string;
  title: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  notes?: string;
  letterId?: string;
}

const ACTIVE_STATUSES: DisputeStatus[] = ["ACTIVE", "PENDING_CLIENT", "PENDING_ATTORNEY", "ESCALATED"];

@Injectable()
export class DisputesService {
  private readonly logger = new Logger(DisputesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyService,
    private readonly audit: AuditService,
  ) {}

  async create(input: CreateDisputeInput) {
    const tenantId = this.tenancy.getTenantId();
    const client = await this.prisma.user.findFirst({ where: { id: input.clientId, tenantId, role: "CLIENT" } });
    if (!client) throw new NotFoundException("Client not found");

    const dispute = await this.prisma.dispute.create({
      data: {
        tenantId,
        clientId: input.clientId,
        reportId: input.reportId,
        title: input.title,
        priority: input.priority ?? "MEDIUM",
        notes: input.notes,
        status: DisputeStatus.DRAFT,
      },
    });

    // Round 1 starts when the first letter is attached.
    if (input.letterId) {
      await this.startRound(dispute.id, input.letterId);
    }

    await this.audit.log({ action: "dispute.created", entity: "Dispute", entityId: dispute.id, meta: { title: input.title } });
    return this.get(dispute.id);
  }

  async list(query: { status?: DisputeStatus; clientId?: string; search?: string; limit?: number; offset?: number }) {
    const tenantId = this.tenancy.getTenantId();
    const where: Prisma.DisputeWhereInput = { tenantId };
    // Clients only ever see their own disputes; staff may filter by client.
    const clientScope = this.tenancy.getClientScope();
    const clientId = clientScope?.clientId ?? query.clientId;
    if (clientId) where.clientId = clientId;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: "insensitive" } },
        { client: { name: { contains: query.search, mode: "insensitive" } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: query.limit ?? 50,
        skip: query.offset ?? 0,
        include: {
          client: { select: { id: true, name: true, email: true } },
          report: { select: { id: true, bureau: true, filename: true } },
          rounds: { orderBy: { roundNumber: "desc" }, take: 1 },
          _count: { select: { rounds: true, letters: true } },
        },
      }),
      this.prisma.dispute.count({ where }),
    ]);
    return { items, total };
  }

  async get(id: string) {
    const tenantId = this.tenancy.getTenantId();
    const dispute = await this.prisma.dispute.findFirst({
      where: { id, tenantId, ...this.tenancy.getClientScope() },
      include: {
        client: { select: { id: true, name: true, email: true } },
        report: { include: { accounts: { where: { isNegative: true } } } },
        rounds: { orderBy: { roundNumber: "asc" }, include: { letter: true } },
        letters: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!dispute) throw new NotFoundException("Dispute not found");
    return dispute;
  }

  async update(id: string, input: { status?: DisputeStatus; title?: string; notes?: string; priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT" }) {
    const tenantId = this.tenancy.getTenantId();
    await this.ensureExists(id, tenantId);
    const dispute = await this.prisma.dispute.update({ where: { id }, data: input });
    if (input.status) {
      await this.audit.log({ action: "dispute.status.updated", entity: "Dispute", entityId: id, meta: { status: input.status } });
    }
    return this.get(dispute.id);
  }

  /** Starts the next round (1-based). Optionally attaches a letter. */
  async startRound(disputeId: string, letterId?: string) {
    const tenantId = this.tenancy.getTenantId();
    const dispute = await this.ensureExists(disputeId, tenantId);
    const roundNumber = dispute.currentRound + 1;
    if (roundNumber > 5) throw new Error("Maximum dispute rounds reached");

    if (letterId) {
      const letter = await this.prisma.letter.findFirst({ where: { id: letterId, tenantId } });
      if (!letter) throw new NotFoundException("Letter not found");
    }

    await this.prisma.disputeRound.create({
      data: {
        disputeId,
        roundNumber,
        letterId: letterId,
        status: letterId ? RoundStatus.SENT : RoundStatus.PENDING,
        sentAt: letterId ? new Date() : undefined,
      },
    });
    await this.prisma.dispute.update({
      where: { id: disputeId },
      data: { currentRound: roundNumber, status: DisputeStatus.ACTIVE },
    });

    // Close the previous round's pending state
    if (dispute.currentRound > 0) {
      await this.prisma.disputeRound.updateMany({
        where: { disputeId, roundNumber: dispute.currentRound, status: RoundStatus.PENDING },
        data: { status: RoundStatus.RECEIVED },
      });
    }

    await this.audit.log({ action: "dispute.round.started", entity: "Dispute", entityId: disputeId, meta: { round: roundNumber } });
    return this.get(disputeId);
  }

  /** Records a bureau response on a round. */
  async recordResponse(disputeId: string, roundNumber: number, input: { responseSummary?: string; result?: string; status?: RoundStatus }) {
    const tenantId = this.tenancy.getTenantId();
    await this.ensureExists(disputeId, tenantId);
    await this.prisma.disputeRound.updateMany({
      where: { disputeId, roundNumber, dispute: { tenantId } },
      data: {
        responseSummary: input.responseSummary,
        result: input.result,
        status: input.status ?? RoundStatus.RESPONSE_RECEIVED,
        responseAt: new Date(),
      },
    });

    if (input.result === "resolved" || input.status === RoundStatus.RESOLVED) {
      await this.prisma.dispute.update({
        where: { id: disputeId },
        data: { status: DisputeStatus.RESOLVED },
      });
    } else if (input.result === "rejected" || input.status === RoundStatus.REJECTED) {
      await this.prisma.dispute.update({
        where: { id: disputeId },
        data: { status: DisputeStatus.REJECTED },
      });
    }
    await this.audit.log({
      action: "dispute.response.recorded",
      entity: "Dispute",
      entityId: disputeId,
      meta: { round: roundNumber, result: input.result },
    });
    return this.get(disputeId);
  }

  async escalate(disputeId: string, reason?: string) {
    const tenantId = this.tenancy.getTenantId();
    await this.ensureExists(disputeId, tenantId);
    await this.prisma.dispute.update({ where: { id: disputeId }, data: { status: DisputeStatus.ESCALATED, notes: reason ?? undefined } });
    await this.audit.log({ action: "dispute.escalated", entity: "Dispute", entityId: disputeId, meta: { reason } });
    return this.get(disputeId);
  }

  async stats() {
    const tenantId = this.tenancy.getTenantId();
    const clientScope = this.tenancy.getClientScope();
    const [total, active, resolved, rejected] = await Promise.all([
      this.prisma.dispute.count({ where: { tenantId, ...clientScope } }),
      this.prisma.dispute.count({ where: { tenantId, ...clientScope, status: { in: ACTIVE_STATUSES } } }),
      this.prisma.dispute.count({ where: { tenantId, ...clientScope, status: "RESOLVED" } }),
      this.prisma.dispute.count({ where: { tenantId, ...clientScope, status: "REJECTED" } }),
    ]);
    return { total, active, resolved, rejected };
  }

  private async ensureExists(id: string, tenantId: string) {
    const dispute = await this.prisma.dispute.findFirst({ where: { id, tenantId, ...this.tenancy.getClientScope() } });
    if (!dispute) throw new NotFoundException("Dispute not found");
    return dispute;
  }
}
