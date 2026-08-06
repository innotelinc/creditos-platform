import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { NotificationType, ReportStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TenancyService } from "../common/tenancy";
import { AiProviderFactory } from "./ai-provider.factory";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { LocalEngine } from "./local-engine";
import type { ReportContext } from "./types";

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyService,
    private readonly factory: AiProviderFactory,
    private readonly local: LocalEngine,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Runs (or re-runs) analysis on a report. Called by the BullMQ worker. */
  async run(reportId: string): Promise<void> {
    const report = await this.prisma.creditReport.findUnique({
      where: { id: reportId },
      include: {
        client: true,
        accounts: true,
        inquiries: true,
        publicRecords: true,
        scoreSnapshots: { orderBy: { scoreDate: "desc" } },
      },
    });
    if (!report) {
      this.logger.warn(`Analysis skipped: report ${reportId} not found`);
      return;
    }

    await this.prisma.creditReport.update({
      where: { id: reportId },
      data: { status: ReportStatus.ANALYZING },
    });

    const context: ReportContext = {
      reportId,
      bureau: report.bureau,
      clientName: report.client.name,
      pulledAt: report.pulledAt,
      accounts: report.accounts.map((a) => ({
        id: a.id,
        accountName: a.accountName,
        accountType: a.accountType,
        status: a.status,
        balance: a.balance === null ? null : Number(a.balance),
        creditLimit: a.creditLimit === null ? null : Number(a.creditLimit),
        highBalance: a.highBalance === null ? null : Number(a.highBalance),
        paymentHistory: a.paymentHistory,
        openedDate: a.openedDate,
        closedDate: a.closedDate,
        lastReportedDate: a.lastReportedDate,
        dateFirstDelinquent: a.dateFirstDelinquent,
        monthsNegative: a.monthsNegative,
        isNegative: a.isNegative,
        negativeFlags: (a.negativeFlags as string[]) ?? [],
      })),
      inquiryCount: report.inquiries.length,
      publicRecordCount: report.publicRecords.length,
      latestScore: report.scoreSnapshots[0]?.score ?? null,
    };

    try {
      const provider = this.factory.getProvider();
      const result = await provider.analyzeReport(context);
      await this.prisma.creditReport.update({
        where: { id: reportId },
        data: {
          status: ReportStatus.ANALYZED,
          analyzedAt: new Date(),
          analysisJson: JSON.parse(JSON.stringify(result)),
        },
      });

      const highCount = result.findings.filter((f) => f.severity === "high").length;
      await this.notifications.create({
        tenantId: report.tenantId,
        userId: report.clientId,
        type: highCount > 0 ? NotificationType.ALERT : NotificationType.SUCCESS,
        title: `Credit analysis complete — ${report.bureau}`,
        body: highCount > 0
          ? `${highCount} high-priority finding(s) on your ${report.bureau} report. Estimated gain: +${result.potentialGain} pts.`
          : `No high-priority issues found. Estimated score: ${result.estimatedScore}.`,
        link: `/reports/${reportId}`,
      });

      await this.audit.log({
        action: "report.analyzed",
        entity: "CreditReport",
        entityId: reportId,
        meta: { findings: result.findings.length, engine: result.generatedBy },
      });
      this.logger.log(`Report ${reportId} analyzed by ${result.generatedBy} (${result.findings.length} findings)`);
    } catch (err) {
      this.logger.error(`Analysis failed for ${reportId}: ${(err as Error).message}`);
      await this.prisma.creditReport.update({
        where: { id: reportId },
        data: { status: ReportStatus.FAILED, parseErrors: { analysisError: (err as Error).message } },
      });
    }
  }

  async getResult(reportId: string) {
    const tenantId = this.tenancy.getTenantId();
    const report = await this.prisma.creditReport.findFirst({
      where: { id: reportId, tenantId, ...this.tenancy.getClientScope() },
      select: {
        id: true,
        status: true,
        analyzedAt: true,
        analysisJson: true,
        summary: true,
        parseErrors: true,
        scoreSnapshots: { orderBy: { scoreDate: "desc" }, take: 1 },
      },
    });
    if (!report) throw new NotFoundException("Report not found");
    return report;
  }

  /** Drafts a letter for one account using the configured provider. */
  async generateDraft(input: {
    clientName: string;
    clientId: string;
    bureau: string;
    accountId: string;
    letterType: string;
    reason?: string;
  }) {
    const tenantId = this.tenancy.getTenantId();
    const account = await this.prisma.creditAccount.findFirst({
      where: { id: input.accountId, report: { tenantId, clientId: input.clientId } },
      include: { report: { include: { client: true } } },
    });
    if (!account) throw new NotFoundException("Account not found in this tenant");

    const provider = this.factory.getProvider();
    const reason =
      input.reason ??
      (account.negativeFlags as string[]).join(", ") ??
      "This account is reported inaccurately on my credit report.";
    const body = await provider.generateLetter({
      clientName: input.clientName,
      bureau: input.bureau,
      creditorName: account.accountName,
      accountName: account.accountName,
      accountNumber: account.accountNumber ?? undefined,
      balance: account.balance === null ? undefined : Number(account.balance),
      openedDate: account.openedDate?.toISOString().slice(0, 10),
      lastReportedDate: account.lastReportedDate?.toISOString().slice(0, 10),
      reason,
      letterType: input.letterType,
    });
    return { body, account, reason };
  }

  /** Re-runs analysis using the local engine immediately (diagnostics/testing). */
  async runLocal(reportId: string) {
    const tenantId = this.tenancy.getTenantId();
    const report = await this.prisma.creditReport.findFirst({
      where: { id: reportId, tenantId, ...this.tenancy.getClientScope() },
      include: { client: true, accounts: true, inquiries: true, publicRecords: true, scoreSnapshots: true },
    });
    if (!report) throw new NotFoundException("Report not found");
    const context: ReportContext = {
      reportId,
      bureau: report.bureau,
      clientName: report.client.name,
      accounts: report.accounts.map((a) => ({
        id: a.id,
        accountName: a.accountName,
        accountType: a.accountType,
        status: a.status,
        balance: a.balance === null ? null : Number(a.balance),
        creditLimit: a.creditLimit === null ? null : Number(a.creditLimit),
        highBalance: a.highBalance === null ? null : Number(a.highBalance),
        paymentHistory: a.paymentHistory,
        openedDate: a.openedDate,
        closedDate: a.closedDate,
        lastReportedDate: a.lastReportedDate,
        dateFirstDelinquent: a.dateFirstDelinquent,
        monthsNegative: a.monthsNegative,
        isNegative: a.isNegative,
        negativeFlags: (a.negativeFlags as string[]) ?? [],
      })),
      inquiryCount: report.inquiries.length,
      publicRecordCount: report.publicRecords.length,
      latestScore: report.scoreSnapshots[0]?.score ?? null,
    };
    return this.local.analyzeReport(context);
  }
}
