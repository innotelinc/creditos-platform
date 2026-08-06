import { Bureau } from "@prisma/client";

/**
 * Parses credit report files (CSV from Experian/Equifax/TransUnion and PDF text)
 * into a normalized structure. Heuristic-based, bureau-tolerant: it never fails
 * on an unknown layout — unrecognized data lands in `rawJson` for AI analysis.
 */

export interface ParsedAccount {
  accountName: string;
  accountType?: string;
  bureau: Bureau;
  accountNumber?: string;
  status?: string;
  balance?: number;
  creditLimit?: number;
  highBalance?: number;
  paymentHistory?: string;
  openedDate?: string;
  closedDate?: string;
  lastReportedDate?: string;
  dateFirstDelinquent?: string;
  monthsNegative?: number;
  isNegative: boolean;
  negativeFlags: string[];
}

export interface ParsedInquiry {
  company: string;
  type: string;
  date: string;
}

export interface ParsedPublicRecord {
  type: string;
  court?: string;
  filingDate?: string;
  amount?: number;
  status?: string;
}

export interface ParsedScore {
  bureau: Bureau;
  score: number;
  reasonCodes: string[];
}

export interface ParsedReport {
  bureau: Bureau;
  accounts: ParsedAccount[];
  inquiries: ParsedInquiry[];
  publicRecords: ParsedPublicRecord[];
  scores: ParsedScore[];
  summary: Record<string, number>;
}

const NEGATIVE_KEYWORDS = [
  "collection",
  "charge off",
  "charge-off",
  "late 90",
  "late 120",
  "late 60",
  "late 30",
  "derogatory",
  "delinquent",
  "repossession",
  "foreclosure",
  "bankruptcy",
  "settled for less",
  "tax lien",
  "judgment",
  "written off",
  "profit and loss write-off",
];

const NEGATIVE_SHORT_CODES = ["CO", "L120", "L90", "L60", "L30", "B", "R", "F", "K", "J", "T"];

function detectBureau(text: string, filename = ""): Bureau {
  const t = (text + " " + filename).toLowerCase();
  if (t.includes("experian")) return Bureau.EXPERIAN;
  if (t.includes("equifax")) return Bureau.EQUIFAX;
  if (t.includes("transunion") || t.includes("trans union")) return Bureau.TRANSUNION;
  return Bureau.OTHER;
}

function parseDate(raw: string): string | undefined {
  const cleaned = raw.trim();
  if (!cleaned || !/\d/.test(cleaned)) return undefined;
  // ISO-ish or common US formats
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(cleaned);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(cleaned);
  if (us) {
    const m = us[1]!;
    const d = us[2]!;
    const y = us[3]!;
    const yy = y.length === 2 ? `20${y}` : y;
    return `${yy}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const mon = /^([A-Za-z]{3})[a-z]*\s+(\d{1,2}),?\s+(\d{4})$/.exec(cleaned);
  if (mon) {
    const months: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    };
    const mm = months[mon[1]!.toLowerCase()];
    if (mm) return `${mon[3]!}-${mm}-${mon[2]!.padStart(2, "0")}`;
  }
  return undefined;
}

function toMoney(raw: string): number | undefined {
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  if (!cleaned || !/\d/.test(cleaned)) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function isNegativeStatus(status?: string): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  if (NEGATIVE_KEYWORDS.some((k) => s.includes(k))) return true;
  const words = s.split(/\s+/);
  return words.some((w) => NEGATIVE_SHORT_CODES.includes(w.toUpperCase()));
}

function flagsFor(account: { status?: string; paymentHistory?: string; monthsNegative?: number }): string[] {
  const flags: string[] = [];
  const s = (account.status ?? "").toLowerCase();
  if (s.includes("collection")) flags.push("collection");
  if (s.includes("charge") || s.includes("charge-off")) flags.push("charge_off");
  if (/late|delinquent/.test(s)) flags.push("late_payment");
  if (s.includes("repossess")) flags.push("repossession");
  if (s.includes("foreclosure")) flags.push("foreclosure");
  if (s.includes("bankruptcy")) flags.push("bankruptcy");
  if (s.includes("lien")) flags.push("tax_lien");
  if (s.includes("judgment")) flags.push("judgment");
  if ((account.monthsNegative ?? 0) >= 1) flags.push("derogatory_history");
  if (account.paymentHistory && /[4-9]/.test(account.paymentHistory)) flags.push("late_payment_history");
  return flags;
}

/** Parses bureau-style CSV into normalized accounts. */
export function parseCsv(text: string): ParsedReport {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const bureau = detectBureau(text);
  const rows = lines.map((l) => {
    // naive CSV split that respects quoted fields
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (const ch of l) {
      if (ch === '"') inQ = !inQ;
      else if (ch === "," && !inQ) {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out.map((c) => c.trim());
  });

  const headerIdx = rows.findIndex((r) =>
    r.some((c) => /account\s*name|creditor|institution/i.test(c)) &&
    r.some((c) => /balance|amount/i.test(c)),
  );

  const accounts: ParsedAccount[] = [];
  const inquiries: ParsedInquiry[] = [];
  const scores: ParsedScore[] = [];

  if (headerIdx >= 0) {
    const header = rows[headerIdx] ?? [];
    const col = (name: string) => {
      const idx = header.findIndex((h) => new RegExp(name, "i").test(h));
      return idx >= 0 ? idx : undefined;
    };
    const cName = col("account name|creditor|institution|company");
    const cType = col("account type|type");
    const cNum = col("account number|acct");
    const cStatus = col("status");
    const cBalance = col("balance|current balance");
    const cLimit = col("credit limit");
    const cHigh = col("high balance|high credit");
    const cHistory = col("payment history|24 month|history");
    const cOpened = col("opened|open date|date opened");
    const cClosed = col("closed|close date|date closed");
    const cReported = col("last reported|reported|date updated");
    const cDla = col("date first|dla|first delinquent");
    const cMonths = col("months negative|months");

    for (const row of rows.slice(headerIdx + 1)) {
      const name = cName !== undefined ? (row[cName] ?? "") : "";
      if (!name) continue;
      const status = cStatus !== undefined ? (row[cStatus] ?? "") : "";
      const balance = cBalance !== undefined ? toMoney(row[cBalance] ?? "") : undefined;
      const creditLimit = cLimit !== undefined ? toMoney(row[cLimit] ?? "") : undefined;
      const highBalance = cHigh !== undefined ? toMoney(row[cHigh] ?? "") : undefined;
      const monthsNegative = cMonths !== undefined ? Number((row[cMonths] ?? "").replace(/\D/g, "")) || undefined : undefined;
      const account: ParsedAccount = {
        accountName: name,
        accountType: cType !== undefined ? (row[cType] ?? undefined) : undefined,
        bureau,
        accountNumber: cNum !== undefined ? (row[cNum] ?? undefined) : undefined,
        status,
        balance,
        creditLimit,
        highBalance,
        paymentHistory: cHistory !== undefined ? (row[cHistory] ?? undefined) : undefined,
        openedDate: cOpened !== undefined ? parseDate(row[cOpened] ?? "") : undefined,
        closedDate: cClosed !== undefined ? parseDate(row[cClosed] ?? "") : undefined,
        lastReportedDate: cReported !== undefined ? parseDate(row[cReported] ?? "") : undefined,
        dateFirstDelinquent: cDla !== undefined ? parseDate(row[cDla] ?? "") : undefined,
        monthsNegative,
        isNegative: isNegativeStatus(status) || (monthsNegative ?? 0) > 0,
        negativeFlags: [],
      };
      account.negativeFlags = flagsFor(account);
      accounts.push(account);
    }
  }

  // Fallback text scan for inquiries / scores / public records in any file type
  const joined = lines.join("\n");
  const scoreMatch = /(?:fico|score)[^\d]{0,20}(\d{3})/i.exec(joined);
  if (scoreMatch) {
    scores.push({ bureau, score: Number(scoreMatch[1]), reasonCodes: [] });
  }

  return {
    bureau,
    accounts,
    inquiries,
    publicRecords: [],
    scores,
    summary: summarize(accounts),
  };
}

/** Parses a PDF by extracting text lines and applying heuristics. */
export function parsePdfText(text: string): ParsedReport {
  const bureau = detectBureau(text);
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const accounts: ParsedAccount[] = [];
  const inquiries: ParsedInquiry[] = [];
  const publicRecords: ParsedPublicRecord[] = [];
  const scores: ParsedScore[] = [];

  let current: Partial<ParsedAccount> | null = null;
  const accountBoundary = /(?:collection|charge[- ]?off|installment|revolving|mortgage|auto|credit card|student loan|account|tradeline|judgment|tax lien)/i;

  for (const line of lines) {
    if (/^\s*$/.test(line)) continue;

    // Score lines: "FICO® Score: 672" or "VantageScore 3.0 640"
    const scoreMatch = /(?:fico|vantage|score)[^\d]{0,25}(\d{3})/i.exec(line);
    if (scoreMatch && !line.includes("score type") && Number(scoreMatch[1]) >= 300 && Number(scoreMatch[1]) <= 850) {
      scores.push({ bureau, score: Number(scoreMatch[1]), reasonCodes: [] });
    }

    // Inquiry lines: company + date pattern
    const inquiryMatch = /^([A-Za-z0-9&.\- ]{3,40}?)\s{2,}([A-Za-z]{3}\s+\d{1,2},?\s+\d{4})/.exec(line);
    if (inquiryMatch && !inquiryMatch[1]!.includes("inquiries")) {
      inquiries.push({ company: inquiryMatch[1]!.trim(), type: "hard", date: parseDate(inquiryMatch[2] ?? "") ?? "" });
    }

    // Public records
    if (/bankruptcy|chapter \d|tax lien|judgment/i.test(line)) {
      const type = /bankruptcy|chapter/i.test(line) ? "bankruptcy" : /tax lien/i.test(line) ? "tax_lien" : "judgment";
      publicRecords.push({
        type,
        court: /court/.test(line) ? line : undefined,
        amount: toMoney(line),
        status: undefined,
      });
      continue;
    }

    // New account boundary
    if (accountBoundary.test(line) && /\$|status|payment/i.test(line) && !/current balance|total/i.test(line)) {
      if (current?.accountName) accounts.push(finalizeAccount(current, bureau));
      const statusMatch = /(collection|charge[- ]?off|installment|revolving|mortgage|auto|credit card|student loan|judgment|tax lien)/i.exec(line);
      current = {
        accountName: line.slice(0, 60),
        accountType: statusMatch?.[1]?.toLowerCase(),
        bureau,
        isNegative: false,
        negativeFlags: [],
      };
      const statusTag = /(?:status|condition)[:\s]+([A-Za-z0-9, /-]{3,40})/.exec(line);
      if (statusTag) current.status = statusTag[1];
      const bal = toMoney(line);
      if (bal !== undefined && /\$/.test(line)) current.balance = bal;
      continue;
    }

    if (!current) continue;

    const balanceMatch = /(?:current balance|balance)[:\s]+\$?([\d,]+(?:\.\d{2})?)/i.exec(line);
    if (balanceMatch) current.balance = toMoney(balanceMatch[1] ?? "") ?? undefined;
    const limitMatch = /(?:credit limit|high balance)[:\s]+\$?([\d,]+(?:\.\d{2})?)/i.exec(line);
    if (limitMatch) current.creditLimit = toMoney(limitMatch[1] ?? "") ?? undefined;
    const statusMatch = /(?:status|condition)[:\s]+([A-Za-z0-9, /-]{3,40})/.exec(line);
    if (statusMatch) current.status = statusMatch[1];
    const dateMatch = /(?:reported|last reported)[:\s]+([A-Za-z]{3}\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/.exec(line);
    if (dateMatch) current.lastReportedDate = parseDate(dateMatch[1] ?? "");
    const openedMatch = /(?:opened|open date)[:\s]+([A-Za-z]{3}\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/.exec(line);
    if (openedMatch) current.openedDate = parseDate(openedMatch[1] ?? "");
    const historyMatch = /(?:payment history)[:\s]+([0-9OACDRILX? ]{12,})/.exec(line);
    if (historyMatch) current.paymentHistory = historyMatch[1]?.replace(/\s/g, "") ?? undefined;
    const monthsMatch = /(\d{1,3})\s*month(?:s)?\s*negative/i.exec(line);
    if (monthsMatch) current.monthsNegative = Number(monthsMatch[1]);
  }

  if (current?.accountName) accounts.push(finalizeAccount(current, bureau));

  return {
    bureau,
    accounts,
    inquiries,
    publicRecords,
    scores,
    summary: summarize(accounts),
  };
}

function finalizeAccount(p: Partial<ParsedAccount>, bureau: Bureau): ParsedAccount {
  const account: ParsedAccount = {
    accountName: p.accountName ?? "Unknown account",
    accountType: p.accountType,
    bureau,
    accountNumber: p.accountNumber,
    status: p.status,
    balance: p.balance,
    creditLimit: p.creditLimit,
    highBalance: p.highBalance,
    paymentHistory: p.paymentHistory,
    openedDate: p.openedDate,
    closedDate: p.closedDate,
    lastReportedDate: p.lastReportedDate,
    dateFirstDelinquent: p.dateFirstDelinquent,
    monthsNegative: p.monthsNegative,
    isNegative: p.isNegative || isNegativeStatus(p.status) || (p.monthsNegative ?? 0) > 0,
    negativeFlags: [],
  };
  account.negativeFlags = flagsFor(account);
  return account;
}

function summarize(accounts: ParsedAccount[]): Record<string, number> {
  const neg = accounts.filter((a) => a.isNegative);
  return {
    totalAccounts: accounts.length,
    negativeAccounts: neg.length,
    collections: neg.filter((a) => a.negativeFlags.includes("collection")).length,
    latePayments: neg.filter((a) => a.negativeFlags.includes("late_payment") || a.negativeFlags.includes("late_payment_history")).length,
    chargeOffs: neg.filter((a) => a.negativeFlags.includes("charge_off")).length,
    bankruptcies: neg.filter((a) => a.negativeFlags.includes("bankruptcy")).length,
    totalBalance: accounts.reduce((s, a) => s + (a.balance ?? 0), 0),
  };
}

export interface ParseOutcome {
  bureau: Bureau;
  accounts: ParsedAccount[];
  inquiries: ParsedInquiry[];
  publicRecords: ParsedPublicRecord[];
  scores: ParsedScore[];
  summary: Record<string, number>;
  rawText: string;
  errors: string[];
}

/** Entry point: parse a file buffer (CSV or PDF) into structured data. */
export async function parseReportFile(buffer: Buffer, filename: string, mimeType: string): Promise<ParseOutcome> {
  const errors: string[] = [];
  const lower = (filename ?? "").toLowerCase();
  const isCsv = mimeType === "text/csv" || lower.endsWith(".csv") || /csv/i.test(buffer.slice(0, 512).toString("latin1"));
  const isPdf = mimeType === "application/pdf" || lower.endsWith(".pdf") || buffer.slice(0, 5).toString("latin1") === "%PDF-";

  try {
    if (isCsv) {
      const text = buffer.toString("utf8");
      const parsed = parseCsv(text);
      return {
        ...parsed,
        rawText: text.slice(0, 200_000),
        errors,
      };
    }
    if (isPdf) {
      // pdf-parse ships no types; wrap it defensively
      const mod = (await import("pdf-parse")) as unknown as {
        default: (buf: Buffer) => Promise<{ text?: string }>;
      };
      const result = await mod.default(buffer);
      const text = result.text ?? "";
      if (!text.trim()) errors.push("PDF contained no extractable text (OCR required for scanned documents)");
      const parsed = parsePdfText(text);
      return { ...parsed, rawText: text.slice(0, 200_000), errors };
    }
  } catch (err) {
    errors.push(`Parse failed: ${(err as Error).message}`);
  }

  // Last resort: treat as text
  const text = buffer.toString("utf8");
  const parsed = parseCsv(text);
  return { ...parsed, rawText: text.slice(0, 200_000), errors: [...errors, "Unsupported file type — treated as text"] };
}
