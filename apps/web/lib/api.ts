/** Shared API types + fetch helpers. All requests go through the Next.js BFF
 *  proxy (`/api/[...path]`) which holds httpOnly tokens and auto-refreshes. */

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  phone: string | null;
  isSuperAdmin: boolean;
  totpEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  plan: string;
  brandColor: string | null;
  settings: Record<string, unknown> | null;
}

export interface AuthSession {
  user: User;
  tenant: TenantInfo;
}

export interface ScoreSnapshot {
  id: string;
  bureau: string;
  score: number;
  scoreDate: string;
}

export interface CreditAccount {
  id: string;
  accountName: string;
  accountType: string | null;
  bureau: string;
  accountNumber: string | null;
  status: string | null;
  balance: string | number | null;
  creditLimit: string | number | null;
  paymentHistory: string | null;
  openedDate: string | null;
  lastReportedDate: string | null;
  dateFirstDelinquent: string | null;
  monthsNegative: number | null;
  isNegative: boolean;
  negativeFlags: string[];
}

export interface CreditReport {
  id: string;
  bureau: string;
  filename: string;
  mimeType: string | null;
  sizeBytes: number | null;
  status: string;
  createdAt: string;
  analyzedAt: string | null;
  summary: Record<string, number> | null;
  parseErrors: unknown;
  client: { id: string; name: string; email: string };
  scoreSnapshots: ScoreSnapshot[];
  accounts: CreditAccount[];
  inquiries: { id: string; company: string; type: string; date: string }[];
  publicRecords: { id: string; type: string; court: string | null; filingDate: string | null; amount: string | null }[];
  disputes: { id: string; title: string; status: string; currentRound: number }[];
  _count?: { accounts: number; disputes: number };
}

export interface AnalysisFinding {
  id: string;
  type: string;
  severity: "high" | "medium" | "low";
  confidence: number;
  title: string;
  description: string;
  recommendation: string;
  disputeLetter?: string;
  accountId?: string;
  accountName?: string;
}

export interface AnalysisResult {
  reportId: string;
  currentScore: number | null;
  estimatedScore: number;
  potentialGain: number;
  findings: AnalysisFinding[];
  summary: {
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
    utilization: number;
  };
  strategy: { recommendation: string; rationale: string; confidence: number };
  generatedBy: string;
  generatedAt: string;
}

export interface LetterTemplate {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  letterType: string;
  body: string;
  isSystem: boolean;
  version: number;
  isFavorite: boolean;
}

export interface Letter {
  id: string;
  title: string;
  letterType: string;
  body: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string; email: string };
  template: { code: string; name: string } | null;
  dispute: { id: string; title: string; status: string; currentRound: number } | null;
  versions: { id: string; version: number; title: string; body: string; createdAt: string }[];
}

export interface Dispute {
  id: string;
  title: string;
  status: string;
  currentRound: number;
  priority: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string; email: string };
  report: { id: string; bureau: string; filename: string } | null;
  rounds: DisputeRound[];
  letters: Letter[];
  _count?: { rounds: number; letters: number };
}

export interface DisputeRound {
  id: string;
  roundNumber: number;
  status: string;
  sentAt: string | null;
  deliveredAt: string | null;
  receivedAt: string | null;
  responseAt: string | null;
  responseSummary: string | null;
  result: string | null;
  nextStep: string | null;
  letter: Letter | null;
}

export interface DashboardSummary {
  user: { id: string; role: string; isStaff: boolean };
  latestScore: ScoreSnapshot | null;
  negativeAccounts: number;
  negativeCounts: { collections: number; latePayments: number; chargeOffs: number; bankruptcies: number };
  disputes: Dispute[];
  disputeStats: Record<string, number>;
  lettersSent: number;
  tasks: Task[];
  unreadNotifications: number;
  reportsCount: number;
  generatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  status: string;
  priority: string;
  assignee: { id: string; name: string } | null;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; name: string; email: string; role: string } | null;
}

export interface Plan {
  id: string;
  model: "BUSINESS" | "CONSUMER";
  code: string;
  name: string;
  description: string | null;
  priceCents: number;
  interval: "MONTH" | "YEAR" | "ONE_TIME";
  currency: string;
  popular: boolean;
  isActive: boolean;
  sortOrder: number;
  features: string[];
  stripePriceId: string | null;
}

export interface PricingCatalog {
  business: Plan[];
  consumer: Plan[];
}

export interface SubscriptionInfo {
  id: string;
  planCode: string;
  status: string;
  seats: number;
  provider: string;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
}

export interface Invoice {
  id: string;
  number: string;
  description: string | null;
  amountCents: number;
  currency: string;
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface BillingSummary {
  tenant: { id: string; name: string; plan: string };
  subscription: SubscriptionInfo | null;
  invoices: Invoice[];
  usage: { clients: number; reports: number; lettersSent: number };
  entitlements: string[];
}

export interface CrmLead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string | null;
  stage: string;
  value: number | null;
  ownerId: string | null;
  owner: { id: string; name: string } | null;
  tags: string[];
  notes: string | null;
  score: number;
  nextFollowUpAt: string | null;
  wonAt: string | null;
  createdAt: string;
  updatedAt: string;
  activities?: CrmActivity[];
}

export interface CrmActivity {
  id: string;
  type: string;
  subject: string;
  body: string | null;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
}

export interface CrmPipeline {
  stages: Record<string, { count: number; value: number }>;
  totals: { leads: number; value: number };
}

export interface KnowledgeArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  excerpt: string | null;
  body?: string;
  updatedAt: string;
}

export interface KnowledgeCategory {
  category: string;
  label: string;
  count: number;
}

export interface DocumentItem {
  id: string;
  name: string;
  type: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  client: { id: string; name: string; email: string };
  uploadedBy: { id: string; name: string } | null;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
}

export class ApiClientError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiClientError";
  }
}

async function parseResponse(res: Response): Promise<unknown> {
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const maybe = data && typeof data === "object" && "message" in data ? (data as { message?: string | string[] }).message : undefined;
    const msg = Array.isArray(maybe) ? maybe.join(", ") : maybe ? String(maybe) : `Request failed (${res.status})`;
    throw new ApiClientError(res.status, msg);
  }
  return data;
}

export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
    credentials: "same-origin",
  });
  return (await parseResponse(res)) as T;
}

export const api = {
  get: <T = unknown>(path: string) => apiFetch<T>(path),
  post: <T = unknown>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T = unknown>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T = unknown>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "PUT", body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T = unknown>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
  upload: <T = unknown>(path: string, form: FormData) => apiFetch<T>(path, { method: "POST", body: form }),
};
