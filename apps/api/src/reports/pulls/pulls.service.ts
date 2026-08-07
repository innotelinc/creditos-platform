import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "crypto";
import { Bureau } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { TenancyService } from "../../common/tenancy";
import { PullAllowanceService } from "../../billing/pulls-allowance.service";
import { ReportsService } from "../reports.service";
import { PullsProviderFactory } from "./pulls.provider.factory";

@Injectable()
export class PullsService {
  private readonly logger = new Logger(PullsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyService,
    private readonly config: ConfigService,
    private readonly reports: ReportsService,
    private readonly factory: PullsProviderFactory,
    private readonly allowance: PullAllowanceService,
  ) {}

  /**
   * Pull a credit report for a client using their consumer share code.
   * The share code is never stored — only a salted sha256 hash is kept. Every
   * pull writes a ReportPull row up-front (PENDING) so the cost we incur is
   * always accounted for, even when persistence fails afterwards.
   */
  async pull(input: { clientId: string; bureau?: Bureau; shareCode: string }) {
    const tenantId = this.tenancy.getTenantId();
    const client = await this.prisma.user.findFirst({
      where: { id: input.clientId, tenantId, role: "CLIENT", status: "ACTIVE" },
    });
    if (!client) throw new NotFoundException("Active client not found in this tenant");

    const shareCode = input.shareCode.trim();
    if (shareCode.length < 4) {
      throw new BadRequestException("That share code looks too short to be valid.");
    }

    const provider = this.factory.get();
    const shareCodeHash = this.hashShareCode(shareCode);
    const baseCostCents = this.config.get<number>("CREDIT_PULL_COST_CENTS") ?? 1200;

    // Cost control: the same share code may not be re-pulled within 24h.
    const recent = await this.prisma.reportPull.findFirst({
      where: {
        tenantId,
        shareCodeHash,
        status: "SUCCESS",
        createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (recent) {
      throw new ConflictException("This share code was already pulled in the last 24 hours.");
    }

    // ── Pull-allowance enforcement ───────────────────────────────────
    // Within the bundled allowance the pull is free; beyond it, the pull is
    // either billed via Stripe metered usage (mode=metered) or blocked with
    // 402 Payment Required (mode=blocked — no Stripe / no metered item).
    const allowance = await this.allowance.evaluate(tenantId);
    if (allowance.mode === "blocked") {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          code: "PULL_ALLOWANCE_EXCEEDED",
          message:
            allowance.included > 0
              ? `Pull allowance reached — ${allowance.used}/${allowance.included} pulls used this period. Switch to a higher plan or contact support to enable metered overage billing.`
              : "Your plan includes no automatic pulls. Switch to a higher plan or contact support to enable metered overage billing.",
          allowance,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    const overage = allowance.mode === "metered";
    const costCents = overage ? allowance.overageCents : baseCostCents;

    const pullRow = await this.prisma.reportPull.create({
      data: {
        tenantId,
        provider: provider.name,
        bureau: input.bureau ?? Bureau.OTHER,
        shareCodeHash,
        costCents,
        overage,
        status: "PENDING",
      },
    });

    try {
      const result = await provider.pull({ client, bureau: input.bureau, shareCode });

      const report = await this.reports.ingestParsed({
        clientId: input.clientId,
        bureau: result.bureau ?? input.bureau,
        filename: result.filename,
        provider: provider.name,
        shareCodeHash,
        outcome: result.outcome,
      });

      await this.prisma.reportPull.update({
        where: { id: pullRow.id },
        data: {
          status: "SUCCESS",
          reportId: report.id,
          bureau: result.bureau ?? input.bureau ?? Bureau.OTHER,
          providerRef: result.providerRef,
        },
      });
      // Bill metered overage pulls against the subscription's usage item so the
      // next Stripe invoice includes them. Best-effort — never fails the pull.
      if (overage) {
        await this.allowance.recordMeteredUsage(tenantId);
      }
      this.logger.log(
        `Pulled ${result.bureau} report for ${client.email} via ${provider.name} (cost $${(costCents / 100).toFixed(2)}${overage ? " — overage, metered" : ""})`,
      );
      return report;
    } catch (err) {
      // A failed pull was never billed — clear the overage flag so the row
      // doesn't read as a charged overage (usage records only fire on success).
      await this.prisma.reportPull.update({
        where: { id: pullRow.id },
        data: { status: "FAILED", error: (err as Error).message.slice(0, 500), overage: false },
      });
      throw err;
    }
  }

  /** Salted sha256 of the share code — the only form we persist. */
  private hashShareCode(shareCode: string): string {
    const salt =
      this.config.get<string>("CREDIT_PULL_SHARE_SECRET") ||
      this.config.get<string>("JWT_ACCESS_SECRET") ||
      "credit-pull";
    return createHash("sha256").update(`${shareCode}:${salt}`).digest("hex");
  }
}
