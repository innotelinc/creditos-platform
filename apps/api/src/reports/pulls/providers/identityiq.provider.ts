import { BadGatewayException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Bureau } from "@prisma/client";
import type { CreditPullProvider, PullContext, PullResult } from "../pull-provider.interface";
import { buildOutcome } from "./payload-mapper";

/**
 * IdentityIQ partner API adapter.
 *
 * IdentityIQ (identityiq.com) is a consumer credit monitoring platform used
 * widely by credit repair agencies. The partner endpoint and payload contract
 * depend on your agreement with IdentityIQ — adjust the URL and field names
 * against your provider docs; the response is mapped tolerantly.
 */
@Injectable()
export class IdentityIqProvider implements CreditPullProvider {
  readonly name = "identityiq";

  constructor(private readonly config: ConfigService) {}

  async pull(ctx: PullContext): Promise<PullResult> {
    const baseUrl = this.config.get<string>("IDENTITYIQ_API_BASE_URL");
    const apiKey = this.config.get<string>("IDENTITYIQ_API_KEY");
    if (!baseUrl || !apiKey) {
      throw new Error(
        "IdentityIQ is not configured — set IDENTITYIQ_API_BASE_URL and IDENTITYIQ_API_KEY, or use CREDIT_PULL_PROVIDER=simulated.",
      );
    }

    let res: Response;
    try {
      res = await fetch(`${baseUrl.replace(/\/+$/, "")}/v1/reports/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          shareCode: ctx.shareCode,
          bureau: ctx.bureau ?? "all",
          consumer: { fullName: ctx.client.name, email: ctx.client.email, phone: ctx.client.phone ?? "" },
        }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (err) {
      throw new BadGatewayException(`IdentityIQ pull failed: ${(err as Error).message}`);
    }
    if (!res.ok) {
      throw new BadGatewayException(`IdentityIQ pull failed (${res.status})`);
    }
    const raw = (await res.json()) as {
      id?: string;
      bureau?: string;
      accounts?: unknown[];
      inquiries?: unknown[];
      publicRecords?: unknown[];
      scores?: unknown[];
    };
    const outcome = buildOutcome(raw, ctx.bureau ?? Bureau.OTHER);
    const today = new Date().toISOString().slice(0, 10);
    return {
      bureau: outcome.bureau,
      filename: `${outcome.bureau.toLowerCase()}-report-${today}.json`,
      providerRef: raw.id,
      outcome,
    };
  }
}
