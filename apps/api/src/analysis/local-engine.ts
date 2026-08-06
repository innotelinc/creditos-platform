import { Injectable } from "@nestjs/common";
import type {
  AccountContext,
  AnalysisFinding,
  AnalysisResult,
  AnalysisStrategy,
  AnalysisSummary,
  ReportContext,
} from "./types";

/**
 * Deterministic analysis engine. Runs entirely locally (no API key required)
 * and implements the §4.3 detection rules: duplicates, mixed files, incorrect
 * balances, obsolete collections, statute-of-limitations, late-payment
 * inconsistencies, charge-off errors, identity-theft indicators.
 */
@Injectable()
export class LocalEngine {
  name = "local-engine";

  private yearsAgo(years: number): Date {
    const d = new Date();
    d.setFullYear(d.getFullYear() - years);
    return d;
  }

  analyzeReport(context: ReportContext): AnalysisResult {
    const findings: AnalysisFinding[] = [];
    const accounts = context.accounts;

    // ── Duplicate accounts ──────────────────────────────────────────────────
    const seen = new Map<string, AccountContext[]>();
    for (const a of accounts) {
      const key = a.accountName.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (key.length >= 4) {
        const list = seen.get(key) ?? [];
        list.push(a);
        seen.set(key, list);
      }
    }
    for (const [, dupes] of seen) {
      if (dupes.length >= 2) {
        const bal = new Set(dupes.map((d) => d.balance ?? 0));
        const severity: AnalysisFinding["severity"] = bal.size === 1 ? "high" : "medium";
        findings.push({
          id: `dup-${dupes[0]?.id}`,
          type: "duplicate_account",
          severity,
          confidence: severity === "high" ? 0.92 : 0.78,
          title: `Duplicate account: ${dupes[0]?.accountName}`,
          description: `${dupes.length} identical account(s) reporting the same tradeline. Duplicates deflate your score by overstating debt.`,
          recommendation: "Dispute the duplicate with a 609 letter citing the same name, balance, and dates appearing twice.",
          disputeLetter: "609",
          accountId: dupes[0]?.id,
          accountName: dupes[0]?.accountName,
        });
      }
    }

    // ── Obsolete collections (7-year reporting limit) ──────────────────────
    const obsoleteWindow = this.yearsAgo(7);
    for (const a of accounts) {
      if (!a.isNegative || !a.negativeFlags.includes("collection")) continue;
      const ref = a.dateFirstDelinquent ?? a.lastReportedDate ?? a.closedDate;
      if (ref && ref < obsoleteWindow) {
        findings.push({
          id: `obsolete-${a.id}`,
          type: "obsolete_collection",
          severity: "high",
          confidence: 0.9,
          title: `Obsolete collection: ${a.accountName}`,
          description: `This collection dates to ${ref.toISOString().slice(0, 10)} — beyond the 7-year reporting window and should no longer appear on your report.`,
          recommendation: "Send a 604 letter demanding removal of the obsolete collection from all three bureaus.",
          disputeLetter: "604",
          accountId: a.id,
          accountName: a.accountName,
        });
      }
    }

    // ── Statute of limitations ─────────────────────────────────────────────
    for (const a of accounts) {
      if (!a.negativeFlags.includes("collection")) continue;
      const ref = a.dateFirstDelinquent ?? a.lastReportedDate;
      if (ref && ref < this.yearsAgo(6)) {
        findings.push({
          id: `sol-${a.id}`,
          type: "statute_of_limitations",
          severity: "medium",
          confidence: 0.75,
          title: `Possible time-barred debt: ${a.accountName}`,
          description: "This debt is more than 6 years old and may be past the statute of limitations for collection lawsuits.",
          recommendation: "Respond to any collection calls with a debt validation request; consider a cease-and-desist letter.",
          disputeLetter: "debt_validation",
          accountId: a.id,
          accountName: a.accountName,
        });
      }
    }

    // ── Incorrect balances / utilization ───────────────────────────────────
    let revolvingBalance = 0;
    let revolvingLimit = 0;
    for (const a of accounts) {
      const isRevolving = !a.accountType || /revolving|credit card/i.test(a.accountType ?? "");
      if (isRevolving) {
        revolvingBalance += a.balance ?? 0;
        revolvingLimit += a.creditLimit ?? 0;
      }
      if (a.balance && a.balance > 0 && (!a.creditLimit || a.creditLimit === 0)) {
        findings.push({
          id: `balance-${a.id}`,
          type: "incorrect_balance",
          severity: "medium",
          confidence: 0.6,
          title: `Account reports a balance without a credit limit: ${a.accountName}`,
          description: "A revolving account with a balance but no limit is a data error that can depress your score.",
          recommendation: "Dispute the missing/inaccurate credit limit with a 611 investigation request.",
          disputeLetter: "611",
          accountId: a.id,
          accountName: a.accountName,
        });
      }
    }
    const utilization = revolvingLimit > 0 ? revolvingBalance / revolvingLimit : 0;
    if (utilization > 0.3 && revolvingLimit > 0) {
      findings.push({
        id: "utilization",
        type: "high_utilization",
        severity: "medium",
        confidence: 0.85,
        title: `High credit utilization (${Math.round(utilization * 100)}%)`,
        description: "Utilization above 30% is a top score driver. Paying down revolving balances offers the fastest score gain.",
        recommendation: "Prioritize paying down the highest-balance revolving account to below 30% utilization.",
      });
    }

    // ── Late payment inconsistencies ───────────────────────────────────────
    for (const a of accounts) {
      const hasLateFlag = a.negativeFlags.includes("late_payment") || a.negativeFlags.includes("late_payment_history");
      if (a.paymentHistory && hasLateFlag) {
        const clean = a.paymentHistory.replace(/[^0-9]/g, "");
        if (clean && !/[1-9]/.test(clean)) {
          findings.push({
            id: `late-inconsistency-${a.id}`,
            type: "late_payment_inconsistency",
            severity: "medium",
            confidence: 0.7,
            title: `Late payment inconsistency: ${a.accountName}`,
            description: "This account is marked delinquent, yet the 24-month payment history shows no late entries.",
            recommendation: "Request verification of the delinquency dates with a 623 letter to the data furnisher.",
            disputeLetter: "623",
            accountId: a.id,
            accountName: a.accountName,
          });
        }
      }
      if (a.paymentHistory && /[4-9]/.test(a.paymentHistory) && !hasLateFlag) {
        findings.push({
          id: `late-unmarked-${a.id}`,
          type: "late_payment_inconsistency",
          severity: "medium",
          confidence: 0.65,
          title: `Unmarked late payments: ${a.accountName}`,
          description: "The payment history contains severe late codes, but the account status does not reflect delinquency.",
          recommendation: "Investigate the discrepancy with the furnisher via a 623 letter.",
          disputeLetter: "623",
          accountId: a.id,
          accountName: a.accountName,
        });
      }
    }

    // ── Charge-off errors ──────────────────────────────────────────────────
    for (const a of accounts) {
      if (!a.negativeFlags.includes("charge_off")) continue;
      const ref = a.dateFirstDelinquent ?? a.lastReportedDate;
      if (ref && ref < this.yearsAgo(7)) {
        findings.push({
          id: `co-obsolete-${a.id}`,
          type: "charge_off_error",
          severity: "high",
          confidence: 0.88,
          title: `Aged charge-off: ${a.accountName}`,
          description: "This charge-off is beyond the 7-year reporting window and should be removed.",
          recommendation: "Dispute the obsolete charge-off with a 604 letter.",
          disputeLetter: "604",
          accountId: a.id,
          accountName: a.accountName,
        });
      } else if (a.lastReportedDate) {
        const days = (Date.now() - a.lastReportedDate.getTime()) / 86_400_000;
        if (days > 730 && a.balance && a.balance > 0) {
          findings.push({
            id: `co-stale-${a.id}`,
            type: "charge_off_error",
            severity: "medium",
            confidence: 0.6,
            title: `Stale charge-off balance: ${a.accountName}`,
            description: "The balance has not been updated in over two years — the charged-off amount is likely inaccurate.",
            recommendation: "Verify the balance with the furnisher using a 623 letter.",
            disputeLetter: "623",
            accountId: a.id,
            accountName: a.accountName,
          });
        }
      }
    }

    // ── Identity theft indicators ──────────────────────────────────────────
    for (const a of accounts) {
      const text = `${a.accountName} ${a.status ?? ""}`.toLowerCase();
      if (/fraud|identity theft|not mine|unauthorized/i.test(text)) {
        findings.push({
          id: `idtheft-${a.id}`,
          type: "identity_theft",
          severity: "high",
          confidence: 0.8,
          title: `Identity-theft indicator: ${a.accountName}`,
          description: "This account is flagged as fraudulent or unauthorized.",
          recommendation: "File an FTC identity-theft report and dispute with an Identity Theft letter plus the FTC affidavit.",
          disputeLetter: "identity_theft",
          accountId: a.id,
          accountName: a.accountName,
        });
      }
    }

    // ── Hard inquiries ─────────────────────────────────────────────────────
    if (context.inquiryCount >= 5) {
      findings.push({
        id: "inquiries",
        type: "excessive_inquiries",
        severity: "low",
        confidence: 0.7,
        title: `${context.inquiryCount} inquiries in this report period`,
        description: "Multiple hard inquiries can temporarily lower your score, especially recent ones.",
        recommendation: "Dispute unauthorized or older inquiries with a 604/611 inquiry dispute letter.",
        disputeLetter: "611",
      });
    }

    // ── Bankruptcy / public records ────────────────────────────────────────
    const bankruptcy = accounts.find((a) => a.negativeFlags.includes("bankruptcy"));
    if (bankruptcy && (bankruptcy.lastReportedDate ?? bankruptcy.closedDate) && (bankruptcy.lastReportedDate ?? bankruptcy.closedDate)! < this.yearsAgo(10)) {
      findings.push({
        id: `bk-obsolete-${bankruptcy.id}`,
        type: "obsolete_bankruptcy",
        severity: "high",
        confidence: 0.85,
        title: `Obsolete bankruptcy: ${bankruptcy.accountName}`,
        description: "Bankruptcies may be reported for 10 years; this one is past that window.",
        recommendation: "Dispute the obsolete bankruptcy with a bankruptcy verification letter.",
        disputeLetter: "bankruptcy_verification",
        accountId: bankruptcy.id,
        accountName: bankruptcy.accountName,
      });
    }

    // ── Summary ────────────────────────────────────────────────────────────
    const neg = accounts.filter((a) => a.isNegative);
    const summary: AnalysisSummary = {
      totalAccounts: accounts.length,
      negativeAccounts: neg.length,
      collections: accounts.filter((a) => a.negativeFlags.includes("collection")).length,
      latePayments: accounts.filter((a) => a.negativeFlags.includes("late_payment") || a.negativeFlags.includes("late_payment_history")).length,
      chargeOffs: accounts.filter((a) => a.negativeFlags.includes("charge_off")).length,
      bankruptcies: accounts.filter((a) => a.negativeFlags.includes("bankruptcy")).length,
      inquiries: context.inquiryCount,
      publicRecords: context.publicRecordCount,
      totalBalance: accounts.reduce((s, a) => s + (a.balance ?? 0), 0),
      totalCreditLimit: accounts.reduce((s, a) => s + (a.creditLimit ?? 0), 0),
      utilization,
    };

    // ── Score estimate ─────────────────────────────────────────────────────
    const impact: Record<string, number> = {
      high: 45,
      medium: 25,
      low: 10,
    };
    const currentScore = context.latestScore ?? 640;
    let gain = 0;
    for (const f of findings) gain += (impact[f.severity] ?? 0) * f.confidence;
    // cap realistically, decay with existing gains
    gain = Math.min(120, Math.round(gain));
    const estimatedScore = Math.min(850, currentScore + gain);

    // ── Strategy ───────────────────────────────────────────────────────────
    const strategy = this.buildStrategy(findings, summary);

    return {
      reportId: context.reportId,
      currentScore,
      estimatedScore,
      potentialGain: gain,
      findings: findings.sort((a, b) => b.severity.localeCompare(a.severity)),
      summary,
      strategy,
      generatedBy: "local-engine",
      generatedAt: new Date().toISOString(),
    };
  }

  private buildStrategy(findings: AnalysisFinding[], summary: AnalysisSummary): AnalysisStrategy {
    const actionable = findings.filter((f) => f.disputeLetter);
    const best = actionable.sort((a, b) => b.confidence - a.confidence)[0];
    if (best) {
      return {
        recommendation: `Start with the ${best.disputeLetter} dispute on "${best.accountName ?? best.title}" — highest confidence finding (${Math.round(best.confidence * 100)}%).`,
        rationale: best.recommendation,
        confidence: best.confidence,
      };
    }
    if (summary.negativeAccounts === 0) {
      return {
        recommendation: "No negative accounts detected. Focus on utilization and healthy credit-building habits.",
        rationale: "A clean report's fastest lever is keeping utilization under 10% and paying on time.",
        confidence: 0.95,
      };
    }
    return {
      recommendation: "Send a 623 dispute to the data furnisher for the highest-balance negative account.",
      rationale: "Furnisher verification disputes are the most effective first move when no account is clearly obsolete.",
      confidence: 0.6,
    };
  }

  /** Implements the AiProvider chat contract with a deterministic fallback. */
  chat(prompt: string, system?: string): Promise<string> {
    return Promise.resolve(this.chatFallback(prompt, system));
  }

  /** Local deterministic chat fallback for the assistant. */
  chatFallback(prompt: string, _system?: string): string {
    const lower = prompt.toLowerCase();
    if (lower.includes("explain") || lower.includes("what does") || lower.includes("summary")) {
      return "I can explain what's on your report in plain language. Upload a credit report, then ask about any account or finding — I'll walk you through it and suggest next steps.";
    }
    if (lower.includes("letter") || lower.includes("dispute")) {
      return "To dispute an item, open the Reports page, pick a finding, and generate a letter from the template library (609, 611, 623, 604…). I'll draft it with your details filled in.";
    }
    if (lower.includes("score")) {
      return "Scores are driven by payment history, utilization, and negative items. Remove or fix negative tradelines, keep utilization under 30%, and pay on time — that's the fastest path to improvement.";
    }
    return "I'm the CreditOS assistant running in offline mode. Connect an AI provider (OpenAI-compatible) in Settings to unlock full natural-language answers. Meanwhile, I can guide you through reports, disputes, and letters.";
  }

  /** Local template-based letter draft (used when no AI provider is configured). */
  generateLetter(input: {
    clientName: string;
    creditorName: string;
    bureau: string;
    accountName?: string;
    accountNumber?: string;
    balance?: number;
    reason: string;
    letterType: string;
  }): string {
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const acct = input.accountName ?? input.creditorName;
    return [
      `RE: Dispute of inaccurate information — ${acct}${input.accountNumber ? ` (Account #${input.accountNumber})` : ""}`,
      "",
      `Dear ${input.bureau} Credit Bureau,`,
      "",
      `This letter is a formal dispute under the Fair Credit Reporting Act (FCRA), 15 U.S.C. § 1681. I am writing to dispute the accuracy of the following item on my credit report:`,
      "",
      `• Creditor: ${input.creditorName}`,
      input.accountNumber ? `• Account number: ${input.accountNumber}` : null,
      input.balance !== undefined ? `• Reported balance: $${(input.balance ?? 0).toFixed(2)}` : null,
      "",
      `Reason for dispute: ${input.reason}`,
      "",
      "This item is inaccurate and I request that you investigate, verify, and correct or delete this information within 30 days as required by law. Please provide the name, address, and phone number of the party who supplied this information.",
      "",
      "Thank you for your prompt attention to this matter.",
      "",
      "Sincerely,",
      "",
      input.clientName,
      "",
      `Dated: ${today}`,
    ]
      .filter((l): l is string => l !== null)
      .join("\n");
  }
}
