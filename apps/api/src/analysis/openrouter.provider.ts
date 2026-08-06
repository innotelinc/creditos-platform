import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AnalysisResult, LetterGenerationInput, ReportContext, AiProvider } from "./types";
import { LocalEngine } from "./local-engine";

const ANALYSIS_PROMPT = `You are the Credit Analyst agent of an AI credit-repair platform. Analyze the provided credit report data and return STRICT JSON (no markdown) with this exact shape:
{
  "findings": [
    {
      "type": "string (snake_case, e.g. duplicate_account, obsolete_collection, incorrect_balance, statute_of_limitations, late_payment_inconsistency, charge_off_error, identity_theft, excessive_inquiries, high_utilization)",
      "severity": "high|medium|low",
      "confidence": 0.0-1.0,
      "title": "short title",
      "description": "2-3 sentences explaining the issue plainly",
      "recommendation": "concrete next action",
      "disputeLetter": "609|611|623|604|goodwill|identity_theft|debt_validation|pay_for_delete|method_of_verification|custom or null",
      "accountId": "matching id from the input or null",
      "accountName": "account name or null"
    }
  ],
  "summary": { "totalAccounts": n, "negativeAccounts": n, "collections": n, "latePayments": n, "chargeOffs": n, "bankruptcies": n, "inquiries": n, "publicRecords": n, "totalBalance": n, "totalCreditLimit": n, "utilization": 0.0-1.0 },
  "strategy": { "recommendation": "string", "rationale": "string", "confidence": 0.0-1.0 },
  "estimatedScore": 300-850,
  "potentialGain": 0-150
}
Do not invent accounts. Be conservative: only report findings with real supporting evidence.`;

const LETTER_PROMPT = `You are the Dispute Specialist agent of an AI credit-repair platform. Write a formal, FCRA-compliant credit dispute letter based on the input. Use proper business-letter format with the client's name, a clear statement of the disputed item, a specific reason, and a 30-day investigation request under the FCRA. Plain text, no markdown.`;

@Injectable()
export class OpenRouterProvider implements AiProvider {
  private readonly logger = new Logger(OpenRouterProvider.name);
  readonly name: string;

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly local: LocalEngine;

  constructor(config: ConfigService, local: LocalEngine) {
    this.name = config.get("AI_PROVIDER") ?? "openrouter";
    this.baseUrl = (config.get("AI_BASE_URL") ?? "https://openrouter.ai/api/v1").replace(/\/$/, "");
    this.apiKey = config.get("AI_API_KEY") ?? "";
    this.model = config.get("AI_MODEL") ?? "deepseek/deepseek-chat";
    this.timeoutMs = config.get<number>("AI_TIMEOUT_MS") ?? 60_000;
    this.local = local;
  }

  private get available(): boolean {
    return Boolean(this.apiKey);
  }

  async chat(prompt: string, system?: string): Promise<string> {
    if (!this.available) return this.local.chatFallback(prompt, system);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "HTTP-Referer": process.env.APP_URL ?? "https://creditos.local",
          "X-Title": "CreditOS",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: system ?? "You are a helpful assistant for a credit-repair platform." },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 4000,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`AI provider ${res.status}: ${text.slice(0, 300)}`);
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("AI provider returned empty content");
      return content;
    } finally {
      clearTimeout(timer);
    }
  }

  async analyzeReport(context: ReportContext): Promise<AnalysisResult> {
    if (!this.available) {
      this.logger.log("No AI key configured — using local deterministic engine");
      return this.local.analyzeReport(context);
    }
    const prompt = `${ANALYSIS_PROMPT}\n\nCREDIT REPORT DATA:\n${JSON.stringify(context, null, 2)}`;
    try {
      const content = await this.chat(prompt, "You are a conservative credit analyst. Output JSON only.");
      const parsed = JSON.parse(this.stripCodeFences(content)) as Partial<AnalysisResult>;
      if (!Array.isArray(parsed.findings)) throw new Error("AI response missing findings array");
      return {
        reportId: context.reportId,
        currentScore: context.latestScore ?? parsed.currentScore ?? null,
        estimatedScore: parsed.estimatedScore ?? context.latestScore ?? 640,
        potentialGain: parsed.potentialGain ?? 0,
        findings: parsed.findings ?? [],
        summary: {
          totalAccounts: context.accounts.length,
          negativeAccounts: 0,
          collections: 0,
          latePayments: 0,
          chargeOffs: 0,
          bankruptcies: 0,
          inquiries: context.inquiryCount,
          publicRecords: context.publicRecordCount,
          totalBalance: 0,
          totalCreditLimit: 0,
          utilization: 0,
          ...(parsed.summary ?? {}),
        },
        strategy: parsed.strategy ?? { recommendation: "Review findings and begin disputing high-confidence items.", rationale: "", confidence: 0.5 },
        generatedBy: this.name as AnalysisResult["generatedBy"],
        generatedAt: new Date().toISOString(),
      };
    } catch (err) {
      this.logger.warn(`AI analysis failed (${(err as Error).message}) — falling back to local engine`);
      return this.local.analyzeReport(context);
    }
  }

  async generateLetter(input: LetterGenerationInput): Promise<string> {
    if (!this.available) {
      return this.local.generateLetter({
        clientName: input.clientName,
        creditorName: input.creditorName,
        bureau: input.bureau,
        accountName: input.accountName,
        accountNumber: input.accountNumber,
        balance: input.balance,
        reason: input.reason,
        letterType: input.letterType,
      });
    }
    const prompt = `${LETTER_PROMPT}\n\nINPUT:\n${JSON.stringify(input, null, 2)}`;
    try {
      return this.stripCodeFences(await this.chat(prompt));
    } catch (err) {
      this.logger.warn(`AI letter generation failed (${(err as Error).message}) — using template`);
      return this.local.generateLetter({
        clientName: input.clientName,
        creditorName: input.creditorName,
        bureau: input.bureau,
        accountName: input.accountName,
        accountNumber: input.accountNumber,
        balance: input.balance,
        reason: input.reason,
        letterType: input.letterType,
      });
    }
  }

  private stripCodeFences(content: string): string {
    const trimmed = content.trim();
    if (trimmed.startsWith("```")) {
      return trimmed.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
    }
    return trimmed;
  }
}
