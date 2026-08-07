import { createHash } from "crypto";
import { Bureau } from "@prisma/client";
import type { CreditPullProvider, PullContext, PullResult } from "../pull-provider.interface";
import type { ParseOutcome } from "../../parser";

/** Deterministic PRNG seeded by the share code + client email. */
function seededRand(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return () => {
    h = (Math.imul(1664525, h) + 1013904223) | 0;
    return (h >>> 0) / 4294967296;
  };
}

const ACCOUNT_TEMPLATES = [
  { accountName: "First National Collection", accountType: "Collection", status: "Collection Account", balance: 1240, isNegative: true, flags: ["collection"] },
  { accountName: "Capital One", accountType: "Revolving", status: "Charge Off", balance: 3850, creditLimit: 4000, isNegative: true, flags: ["charge_off"] },
  { accountName: "Verizon Wireless", accountType: "Collection", status: "Collection", balance: 312, isNegative: true, flags: ["collection"] },
  { accountName: "Chase Freedom", accountType: "Revolving", status: "Current", balance: 1200, creditLimit: 6500, isNegative: false, flags: [] },
  { accountName: "Student Loan Services", accountType: "Installment", status: "Current", balance: 18400, creditLimit: 21000, isNegative: false, flags: [] },
];

/**
 * Simulated provider — no third-party credentials required. Generates a
 * deterministic report (seeded by share code + client) so the full
 * share-code → report → analysis flow works locally and in CI.
 */
export class SimulatedProvider implements CreditPullProvider {
  readonly name = "simulated";

  async pull(ctx: PullContext): Promise<PullResult> {
    const bureau = ctx.bureau ?? Bureau.EXPERIAN;
    const rand = seededRand(`${ctx.shareCode}::${ctx.client.email}`);
    const score = 600 + Math.floor(rand() * 80); // 600–679
    const today = new Date().toISOString().slice(0, 10);
    const weeksAgo = (n: number) =>
      new Date(Date.now() - n * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const accounts = ACCOUNT_TEMPLATES.map((a, i) => ({
      accountName: a.accountName,
      accountType: a.accountType,
      bureau,
      accountNumber: `SIM-${i}${Math.floor(rand() * 9000 + 1000)}`,
      status: a.status,
      balance: a.balance,
      creditLimit: a.creditLimit,
      lastReportedDate: weeksAgo(i + 1),
      isNegative: a.isNegative,
      negativeFlags: a.flags,
    }));

    const negative = accounts.filter((a) => a.isNegative);
    const outcome: ParseOutcome = {
      bureau,
      accounts,
      inquiries: [
        { company: "Ally Financial", type: "hard", date: weeksAgo(12) },
        { company: "Discover Bank", type: "hard", date: weeksAgo(9) },
        { company: "Citi Card", type: "hard", date: weeksAgo(7) },
      ],
      publicRecords: [],
      scores: [{ bureau, score, reasonCodes: ["Too many inquiries", "High utilization"] }],
      summary: {
        totalAccounts: accounts.length,
        negativeAccounts: negative.length,
        collections: negative.filter((a) => a.negativeFlags.includes("collection")).length,
        latePayments: 1,
        chargeOffs: negative.filter((a) => a.negativeFlags.includes("charge_off")).length,
        bankruptcies: 0,
        totalBalance: accounts.reduce((s, a) => s + a.balance, 0),
      },
      rawText: "",
      errors: [],
    };

    return {
      bureau,
      filename: `${bureau.toLowerCase()}-report-${today}.csv`,
      providerRef: `sim-${createHash("sha256").update(ctx.shareCode).digest("hex").slice(0, 12)}`,
      outcome,
    };
  }
}
