import { Bureau } from "@prisma/client";
import type { ParseOutcome } from "../parser";

/**
 * A credit report pull provider (SmartCredit / IdentityIQ / simulated).
 *
 * Providers receive a consumer share code (the authorization a client gets
 * from their monitoring account) plus the client's details, and return a
 * normalized report in the same shape the file parser produces, so the rest
 * of the pipeline (persistence, AI analysis) is provider-agnostic.
 */
export interface PullContext {
  client: { id: string; name: string; email: string; phone: string | null };
  bureau?: Bureau;
  shareCode: string;
}

export interface PullResult {
  bureau: Bureau;
  filename: string;
  /** Provider-side reference id (e.g. their pull id) for reconciliation. */
  providerRef?: string;
  outcome: ParseOutcome;
}

export interface CreditPullProvider {
  readonly name: string;
  pull(ctx: PullContext): Promise<PullResult>;
}
