import { Bureau } from "@prisma/client";
import type { ParsedAccount, ParsedInquiry, ParsedPublicRecord, ParsedScore, ParseOutcome } from "../../parser";

/**
 * Tolerant mapping from provider JSON payloads into the normalized report
 * shape used by the rest of the pipeline. Real provider contracts vary —
 * confirm the exact key names against the provider's API docs and extend the
 * key lists below as needed.
 */

function pick(raw: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === "string") return v;
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

function num(raw: Record<string, unknown>, ...keys: string[]): number | undefined {
  const v = pick(raw, ...keys);
  if (v === undefined) return undefined;
  const n = Number(v.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function dateOf(v: string | undefined): string | undefined {
  if (!v || !/\d/.test(v)) return undefined;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return new Date(v).toISOString().slice(0, 10);
}

const NEGATIVE = /collection|charge|delinquent|derogatory|late|repossess|foreclosure|bankrupt|lien|judgment|written off/i;

export function mapAccount(raw: Record<string, unknown>, bureau: Bureau): ParsedAccount {
  const status = pick(raw, "status", "accountStatus", "condition", "currentStatus") ?? "";
  const monthsNegative = num(raw, "monthsNegative", "months_negative", "delinquencyMonths");
  const isNegative = NEGATIVE.test(status) || (monthsNegative ?? 0) > 0;

  const account: ParsedAccount = {
    accountName: pick(raw, "accountName", "creditor", "institution", "name") ?? "Unknown account",
    accountType: pick(raw, "accountType", "type", "account_type"),
    bureau,
    accountNumber: pick(raw, "accountNumber", "account_number", "accountNo", "acct"),
    status,
    balance: num(raw, "balance", "currentBalance", "current_balance", "amount"),
    creditLimit: num(raw, "creditLimit", "credit_limit", "limit"),
    highBalance: num(raw, "highBalance", "high_balance", "highCredit"),
    paymentHistory: pick(raw, "paymentHistory", "payment_history", "history"),
    openedDate: dateOf(pick(raw, "openedDate", "opened", "dateOpened", "open_date")),
    closedDate: dateOf(pick(raw, "closedDate", "closed", "dateClosed", "close_date")),
    lastReportedDate: dateOf(pick(raw, "lastReportedDate", "lastReported", "reportedDate", "last_reported")),
    dateFirstDelinquent: dateOf(pick(raw, "dateFirstDelinquent", "dfd", "firstDelinquent")),
    monthsNegative,
    isNegative,
    negativeFlags: [],
  };
  const flags: string[] = [];
  const s = status.toLowerCase();
  if (s.includes("collection")) flags.push("collection");
  if (s.includes("charge")) flags.push("charge_off");
  if (/late|delinquent/.test(s)) flags.push("late_payment");
  if (s.includes("bankrupt")) flags.push("bankruptcy");
  if (s.includes("lien")) flags.push("tax_lien");
  if (s.includes("judgment")) flags.push("judgment");
  if ((monthsNegative ?? 0) >= 1) flags.push("derogatory_history");
  account.negativeFlags = flags;
  return account;
}

function mapInquiry(raw: Record<string, unknown>): ParsedInquiry {
  return {
    company: pick(raw, "company", "creditor", "name") ?? "Unknown",
    type: pick(raw, "type", "kind") ?? "hard",
    date: dateOf(pick(raw, "date", "inquiryDate", "dateOfInquiry")) ?? new Date().toISOString().slice(0, 10),
  };
}

function mapPublicRecord(raw: Record<string, unknown>): ParsedPublicRecord {
  const type = pick(raw, "type", "recordType") ?? "judgment";
  return {
    type: /bankrupt/i.test(type) ? "bankruptcy" : /lien/i.test(type) ? "tax_lien" : "judgment",
    court: pick(raw, "court"),
    filingDate: dateOf(pick(raw, "filingDate", "dateFiled", "filed")),
    amount: num(raw, "amount", "value"),
    status: pick(raw, "status"),
  };
}

function mapScore(raw: Record<string, unknown>, bureau: Bureau): ParsedScore {
  return {
    bureau,
    score: num(raw, "score", "value", "fico") ?? 0,
    reasonCodes: Array.isArray(raw.reasonCodes) ? (raw.reasonCodes as unknown[]).map(String) : [],
  };
}

export function bureauFrom(v: string | undefined, fallback?: Bureau): Bureau {
  const u = (v ?? "").toUpperCase();
  if (u.includes("EQUIFAX")) return Bureau.EQUIFAX;
  if (u.includes("TRANSUNION")) return Bureau.TRANSUNION;
  if (u.includes("EXPERIAN")) return Bureau.EXPERIAN;
  return fallback ?? Bureau.OTHER;
}

export function buildOutcome(
  raw: { bureau?: string; accounts?: unknown[]; inquiries?: unknown[]; publicRecords?: unknown[]; scores?: unknown[] },
  fallbackBureau: Bureau | undefined,
): ParseOutcome {
  const bureau = bureauFrom(raw.bureau, fallbackBureau);
  const accounts = (raw.accounts ?? []).map((a) => mapAccount(a as Record<string, unknown>, bureau));
  const negative = accounts.filter((a) => a.isNegative);
  const outcome: ParseOutcome = {
    bureau,
    accounts,
    inquiries: (raw.inquiries ?? []).map((i) => mapInquiry(i as Record<string, unknown>)),
    publicRecords: (raw.publicRecords ?? []).map((p) => mapPublicRecord(p as Record<string, unknown>)),
    scores: (raw.scores ?? []).map((s) => mapScore(s as Record<string, unknown>, bureau)),
    summary: {
      totalAccounts: accounts.length,
      negativeAccounts: negative.length,
      collections: negative.filter((a) => a.negativeFlags.includes("collection")).length,
      latePayments: negative.filter((a) => a.negativeFlags.includes("late_payment")).length,
      chargeOffs: negative.filter((a) => a.negativeFlags.includes("charge_off")).length,
      bankruptcies: negative.filter((a) => a.negativeFlags.includes("bankruptcy")).length,
      totalBalance: accounts.reduce((sum, a) => sum + (a.balance ?? 0), 0),
    },
    rawText: JSON.stringify(raw).slice(0, 200_000),
    errors: [],
  };
  return outcome;
}
