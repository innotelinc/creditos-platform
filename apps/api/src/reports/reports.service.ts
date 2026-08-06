import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Bureau, ReportStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TenancyService } from "../common/tenancy";
import { S3Service } from "./s3.service";
import { parseReportFile, type ParseOutcome } from "./parser";
import { QueueService } from "../queue/queue.service";
import { AuditService } from "../audit/audit.service";

export interface UploadReportInput {
  clientId: string;
  bureau?: Bureau;
  filename: string;
  mimeType: string;
  buffer: Buffer;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyService,
    private readonly s3: S3Service,
    private readonly queue: QueueService,
    private readonly audit: AuditService,
  ) {}

  async upload(input: UploadReportInput) {
    const tenantId = this.tenancy.getTenantId();
    const client = await this.prisma.user.findFirst({
      where: { id: input.clientId, tenantId, role: "CLIENT" },
    });
    if (!client) throw new NotFoundException("Client not found in this tenant");

    const key = `reports/${tenantId}/${input.clientId}/${Date.now()}-${input.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    await this.s3.putObject(key, input.buffer, input.mimeType || "application/octet-stream");

    const report = await this.prisma.creditReport.create({
      data: {
        tenantId,
        clientId: input.clientId,
        bureau: input.bureau ?? Bureau.OTHER,
        filename: input.filename,
        fileKey: key,
        mimeType: input.mimeType,
        sizeBytes: input.buffer.length,
        status: ReportStatus.PARSING,
      },
    });

    try {
      const outcome = await parseReportFile(input.buffer, input.filename, input.mimeType);
      await this.persistParsed(report.id, input.bureau ?? outcome.bureau ?? Bureau.OTHER, outcome);
      await this.prisma.creditReport.update({
        where: { id: report.id },
        data: { status: ReportStatus.PARSED },
      });
      // Queue AI analysis (processed by BullMQ worker)
      await this.queue.enqueueAnalysis(report.id);
    } catch (err) {
      this.logger.error(`Report ${report.id} parse failed: ${(err as Error).message}`);
      await this.prisma.creditReport.update({
        where: { id: report.id },
        data: { status: ReportStatus.FAILED, parseErrors: { message: (err as Error).message } },
      });
    }

    await this.audit.log({
      action: "report.uploaded",
      entity: "CreditReport",
      entityId: report.id,
      meta: { filename: input.filename, clientId: input.clientId },
    });

    return this.get(report.id);
  }

  private async persistParsed(reportId: string, bureau: Bureau, outcome: ParseOutcome) {
    await this.prisma.$transaction(async (tx) => {
      for (const a of outcome.accounts) {
        await tx.creditAccount.create({
          data: {
            reportId,
            accountName: a.accountName,
            accountType: a.accountType,
            bureau: a.bureau,
            accountNumber: a.accountNumber,
            status: a.status,
            balance: a.balance,
            creditLimit: a.creditLimit,
            highBalance: a.highBalance,
            paymentHistory: a.paymentHistory,
            openedDate: a.openedDate ? new Date(a.openedDate) : undefined,
            closedDate: a.closedDate ? new Date(a.closedDate) : undefined,
            lastReportedDate: a.lastReportedDate ? new Date(a.lastReportedDate) : undefined,
            dateFirstDelinquent: a.dateFirstDelinquent ? new Date(a.dateFirstDelinquent) : undefined,
            monthsNegative: a.monthsNegative,
            isNegative: a.isNegative,
            negativeFlags: a.negativeFlags,
          },
        });
      }
      for (const i of outcome.inquiries) {
        if (!i.company || !i.date) continue;
        const d = new Date(i.date);
        if (Number.isNaN(d.getTime())) continue;
        await tx.creditInquiry.create({ data: { reportId, company: i.company, type: i.type, date: d } });
      }
      for (const p of outcome.publicRecords) {
        await tx.publicRecord.create({
          data: {
            reportId,
            type: p.type,
            court: p.court,
            filingDate: p.filingDate ? new Date(p.filingDate) : undefined,
            amount: p.amount,
            status: p.status,
          },
        });
      }
      for (const s of outcome.scores) {
        await tx.scoreSnapshot.create({
          data: { reportId, bureau: s.bureau, score: s.score, reasonCodes: s.reasonCodes },
        });
      }
      await tx.creditReport.update({
        where: { id: reportId },
        data: { parseErrors: outcome.errors.length ? outcome.errors : undefined, summary: outcome.summary },
      });
    });
  }

  async list(query: { clientId?: string; bureau?: Bureau; status?: ReportStatus; limit?: number; offset?: number }) {
    const tenantId = this.tenancy.getTenantId();
    const where: Record<string, unknown> = { tenantId };
    // Clients can only ever see their own reports; staff may filter by client.
    const clientScope = this.tenancy.getClientScope();
    const clientId = clientScope?.clientId ?? query.clientId;
    if (clientId) where.clientId = clientId;
    if (query.bureau) where.bureau = query.bureau;
    if (query.status) where.status = query.status;

    const [items, total] = await Promise.all([
      this.prisma.creditReport.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: query.limit ?? 50,
        skip: query.offset ?? 0,
        include: {
          client: { select: { id: true, name: true, email: true } },
          scoreSnapshots: { orderBy: { scoreDate: "desc" }, take: 1 },
          _count: { select: { accounts: true, disputes: true } },
        },
      }),
      this.prisma.creditReport.count({ where }),
    ]);
    return { items, total };
  }

  async get(id: string) {
    const tenantId = this.tenancy.getTenantId();
    const report = await this.prisma.creditReport.findFirst({
      where: { id, tenantId, ...this.tenancy.getClientScope() },
      include: {
        client: { select: { id: true, name: true, email: true } },
        accounts: { orderBy: { isNegative: "desc" } },
        inquiries: { orderBy: { date: "desc" } },
        publicRecords: true,
        scoreSnapshots: { orderBy: { scoreDate: "desc" } },
        disputes: { select: { id: true, title: true, status: true, currentRound: true } },
      },
    });
    if (!report) throw new NotFoundException("Report not found");
    return report;
  }

  async remove(id: string) {
    const tenantId = this.tenancy.getTenantId();
    const report = await this.prisma.creditReport.findFirst({ where: { id, tenantId, ...this.tenancy.getClientScope() } });
    if (!report) throw new NotFoundException("Report not found");
    if (report.fileKey) await this.s3.deleteObject(report.fileKey);
    await this.prisma.creditReport.delete({ where: { id } });
    await this.audit.log({ action: "report.deleted", entity: "CreditReport", entityId: id });
    return { success: true };
  }

  async download(id: string) {
    const tenantId = this.tenancy.getTenantId();
    const report = await this.prisma.creditReport.findFirst({ where: { id, tenantId, ...this.tenancy.getClientScope() } });
    if (!report || !report.fileKey) throw new NotFoundException("File not available");
    const buffer = await this.s3.getObject(report.fileKey);
    return { buffer, filename: report.filename, mimeType: report.mimeType ?? "application/octet-stream" };
  }
}
