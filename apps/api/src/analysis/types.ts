export type FindingSeverity = "high" | "medium" | "low";

export interface AnalysisFinding {
  id: string;
  type: string;
  severity: FindingSeverity;
  confidence: number; // 0..1
  title: string;
  description: string;
  recommendation: string;
  disputeLetter?: string; // template code suggestion
  accountId?: string;
  accountName?: string;
}

export interface AnalysisStrategy {
  recommendation: string;
  rationale: string;
  confidence: number;
}

export interface AnalysisSummary {
  totalAccounts: number;
  negativeAccounts: number;
  collections: number;
  latePayments: number;
  chargeOffs: number;
  bankruptcies: number;
  inquiries: number;
  publicRecords: number;
  totalBalance: number;
  totalCreditLimit: number;
  utilization: number; // 0..1
}

export interface AnalysisResult {
  reportId: string;
  currentScore: number | null;
  estimatedScore: number;
  potentialGain: number;
  findings: AnalysisFinding[];
  summary: AnalysisSummary;
  strategy: AnalysisStrategy;
  generatedBy: "local-engine" | "openrouter" | "openai" | "custom";
  generatedAt: string;
}

export interface AccountContext {
  id: string;
  accountName: string;
  accountType?: string | null;
  status?: string | null;
  balance?: number | null;
  creditLimit?: number | null;
  highBalance?: number | null;
  paymentHistory?: string | null;
  openedDate?: Date | null;
  closedDate?: Date | null;
  lastReportedDate?: Date | null;
  dateFirstDelinquent?: Date | null;
  monthsNegative?: number | null;
  isNegative: boolean;
  negativeFlags: string[];
}

export interface ReportContext {
  reportId: string;
  bureau: string;
  clientName: string;
  pulledAt?: Date | null;
  accounts: AccountContext[];
  inquiryCount: number;
  publicRecordCount: number;
  latestScore: number | null;
}

export interface LetterGenerationInput {
  clientName: string;
  clientAddress?: string;
  creditorName: string;
  bureau: string;
  accountName?: string;
  accountNumber?: string;
  balance?: number;
  openedDate?: string;
  lastReportedDate?: string;
  reason: string;
  letterType: string;
}

/** AI provider contract — any OpenAI-compatible proxy or the local engine. */
export interface AiProvider {
  readonly name: string;
  /** May resolve synchronously (local engine) or via promise (remote provider). */
  analyzeReport(context: ReportContext): AnalysisResult | Promise<AnalysisResult>;
  generateLetter(input: LetterGenerationInput): string | Promise<string>;
  chat(prompt: string, system?: string): string | Promise<string>;
}
