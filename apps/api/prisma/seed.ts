/**
 * CreditOS seed — demo data across 2 tenants, all roles, letter templates,
 * a fully-parsed sample credit report with AI analysis, disputes and tasks.
 *
 * Idempotent: safe to run repeatedly.
 */
import { PrismaClient, Role, UserStatus, Bureau, DisputeStatus, RoundStatus, TaskStatus, TaskPriority, NotificationType, LetterStatus, TenantPlan, PlanModel, PlanInterval, SubscriptionStatus, InvoiceStatus, CrmStage, CrmActivityType } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import Stripe from "stripe";

const prisma = new PrismaClient();

const PASSWORD = "Password123!";

async function upsertTenant(slug: string, name: string, brandColor: string, plan: TenantPlan = TenantPlan.TRIAL) {
  return prisma.tenant.upsert({
    where: { slug },
    update: { plan },
    create: { slug, name, brandColor, plan },
  });
}

async function upsertUser(tenantId: string, email: string, name: string, role: Role, opts: { isSuperAdmin?: boolean; phone?: string } = {}) {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const existing = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId, email } },
  });
  if (existing) return existing;
  return prisma.user.create({
    data: {
      tenantId,
      email,
      name,
      role,
      passwordHash,
      isSuperAdmin: opts.isSuperAdmin ?? false,
      phone: opts.phone,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });
}

const TEMPLATES: Array<{
  code: string;
  name: string;
  category: string;
  letterType: string;
  body: string;
}> = [
  {
    code: "609",
    name: "609 Dispute Letter",
    category: "FCRA Dispute",
    letterType: "609",
    body: `RE: Request for Complete File Information — {{account_name ?? creditor}}\n\nDear {{bureau}} Credit Bureau,\n\nI am writing pursuant to Section 609 of the Fair Credit Reporting Act (15 U.S.C. § 1681g) to request the complete file information you maintain regarding the following item on my credit report:\n\n• Creditor: {{creditor}}\n• Account number: {{account_number}}\n• Reported balance: {{balance}}\n• Last reported: {{last_reported}}\n\nI am requesting the full details of this file, including the source of the information, the date it was first reported, and any procedures used to determine its accuracy. Please provide a complete copy of my file as required by law.\n\nSincerely,\n\n{{client_name}}\n{{client_email}}\n{{date}}`,
  },
  {
    code: "611",
    name: "611 Investigation Request",
    category: "FCRA Dispute",
    letterType: "611",
    body: `RE: Reinvestigation Request — {{creditor}}\n\nDear {{bureau}} Credit Bureau,\n\nI am writing to request a reinvestigation of the following inaccurate information on my credit report, pursuant to Section 611 of the Fair Credit Reporting Act (15 U.S.C. § 1681i):\n\n• Creditor: {{creditor}}\n• Account number: {{account_number}}\n• Reported balance: {{balance}}\n\nThis information is inaccurate and/or incomplete. Please reinvestigate the item with the data furnisher within 30 days and provide me with the results of the investigation, including the name, address, and telephone number of the furnisher.\n\nSincerely,\n\n{{client_name}}\n{{date}}`,
  },
  {
    code: "623",
    name: "623 Furnisher Dispute",
    category: "FCRA Dispute",
    letterType: "623",
    body: `RE: Dispute to Data Furnisher — {{creditor}}\n\nDear {{creditor}},\n\nI am writing directly to you as the data furnisher regarding an item you are reporting on my credit report, pursuant to Section 623 of the Fair Credit Reporting Act (15 U.S.C. § 1681s-2):\n\n• Account number: {{account_number}}\n• Reported balance: {{balance}}\n• Last reported: {{last_reported}}\n\nI dispute the accuracy of this information. The reporting is inaccurate because it fails to reflect the actual status of this account. Please investigate this matter, correct your records, and instruct all credit reporting agencies to update their files accordingly.\n\nIf you cannot verify the accuracy of this information within 30 days, please delete it from my credit file.\n\nSincerely,\n\n{{client_name}}\n{{date}}`,
  },
  {
    code: "604",
    name: "604 Obsolete Item Removal",
    category: "FCRA Dispute",
    letterType: "604",
    body: `RE: Removal of Obsolete Information — {{creditor}}\n\nDear {{bureau}} Credit Bureau,\n\nThe following item is being reported beyond the time limits allowed by the Fair Credit Reporting Act (15 U.S.C. § 1681c):\n\n• Creditor: {{creditor}}\n• Account number: {{account_number}}\n• Last reported: {{last_reported}}\n\nBecause this item is obsolete, it must be removed from my credit report. Please delete this information immediately and confirm its removal in writing.\n\nSincerely,\n\n{{client_name}}\n{{date}}`,
  },
  {
    code: "identity_theft",
    name: "Identity Theft Letter",
    category: "Identity Theft",
    letterType: "Identity Theft",
    body: `RE: Identity Theft — Fraudulent Account — {{creditor}}\n\nDear {{bureau}} Credit Bureau,\n\nThe following account was opened without my authorization and is the result of identity theft:\n\n• Creditor: {{creditor}}\n• Account number: {{account_number}}\n\nI have filed an identity theft report with the Federal Trade Commission (FTC) and, where applicable, a police report. I request that this account be blocked from my credit file and blocked from being furnished, per 15 U.S.C. § 1681c-2. Please send me copies of any documents you rely on to verify the account.\n\nSincerely,\n\n{{client_name}}\n{{date}}`,
  },
  {
    code: "debt_validation",
    name: "Debt Validation Request",
    category: "Collections",
    letterType: "Debt Validation",
    body: `RE: Debt Validation Request — {{creditor}}\n\nDear {{creditor}},\n\nI am writing to request validation of the debt you are attempting to collect:\n\n• Alleged account number: {{account_number}}\n• Alleged balance: {{balance}}\n\nPursuant to the Fair Debt Collection Practices Act (15 U.S.C. § 1692g), please provide written verification of this debt, including the original creditor's name and the amount owed. Until validation is provided, please cease all collection activity.\n\nSincerely,\n\n{{client_name}}\n{{date}}`,
  },
  {
    code: "goodwill",
    name: "Goodwill Adjustment Letter",
    category: "Late Payments",
    letterType: "Goodwill",
    body: `RE: Goodwill Adjustment Request — {{creditor}}\n\nDear {{creditor}},\n\nI am writing to request a goodwill adjustment regarding my account ({{account_number}}). The late payments reported on {{last_reported}} were the result of hardship, and I have maintained an excellent payment record both before and since.\n\nI respectfully ask that you consider removing the late payment notation from my credit report as a goodwill gesture. I value our relationship and have been, and will continue to be, a reliable customer.\n\nSincerely,\n\n{{client_name}}\n{{date}}`,
  },
  {
    code: "pay_for_delete",
    name: "Pay-for-Delete Letter",
    category: "Collections",
    letterType: "Pay-for-Delete",
    body: `RE: Settlement & Deletion Offer — {{creditor}}\n\nDear {{creditor}},\n\nI am prepared to settle the collection account referenced above ({{account_number}}, balance {{balance}}) in exchange for your written agreement to delete this collection from my credit reports at all three credit bureaus.\n\nIn consideration of this settlement, I require that the account be deleted entirely rather than reported as "paid" or "settled." Please confirm in writing before I remit payment.\n\nSincerely,\n\n{{client_name}}\n{{date}}`,
  },
  {
    code: "method_of_verification",
    name: "Method of Verification Request",
    category: "FCRA Dispute",
    letterType: "Method of Verification",
    body: `RE: Method of Verification Request — {{creditor}}\n\nDear {{bureau}} Credit Bureau,\n\nPursuant to 15 U.S.C. § 1681i, please provide the method of verification used to verify the following disputed item:\n\n• Creditor: {{creditor}}\n• Account number: {{account_number}}\n\nPlease identify the specific records reviewed and the procedures followed during the reinvestigation of this item.\n\nSincerely,\n\n{{client_name}}\n{{date}}`,
  },
  {
    code: "hipaa",
    name: "HIPAA Medical Dispute",
    category: "Medical",
    letterType: "HIPAA",
    body: `RE: Medical Account Dispute — {{creditor}}\n\nDear {{bureau}} Credit Bureau,\n\nThe following medical account should not appear on my credit report:\n\n• Medical provider: {{creditor}}\n• Account number: {{account_number}}\n\nPursuant to the Health Insurance Portability and Accountability Act (HIPAA) and applicable state privacy laws, this medical information is being reported without proper authorization and is disputed. Please remove this item and instruct the furnisher to cease reporting it.\n\nSincerely,\n\n{{client_name}}\n{{date}}`,
  },
  {
    code: "late_payment_removal",
    name: "Late Payment Removal Letter",
    category: "Late Payments",
    letterType: "Late Payment Removal",
    body: `RE: Late Payment Removal Request — {{creditor}}\n\nDear {{bureau}} Credit Bureau,\n\nThe late payment reported on {{last_reported}} for {{creditor}} ({{account_number}}) is inaccurate and should be removed.\n\nPer the reinvestigation requirements of the FCRA, please verify the dates of this delinquency. If the late payment cannot be verified, it must be deleted from my file.\n\nSincerely,\n\n{{client_name}}\n{{date}}`,
  },
  {
    code: "bankruptcy_verification",
    name: "Bankruptcy Verification Letter",
    category: "Public Records",
    letterType: "Bankruptcy Verification",
    body: `RE: Bankruptcy Verification Request — {{creditor}}\n\nDear {{bureau}} Credit Bureau,\n\nThe following public record is reported on my credit file and I dispute its accuracy:\n\n• Type: Bankruptcy\n• Creditor: {{creditor}}\n• Last reported: {{last_reported}}\n\nPlease verify this record with the court of jurisdiction. Provide the case number, filing date, and disposition. If the record cannot be verified or is obsolete, please remove it.\n\nSincerely,\n\n{{client_name}}\n{{date}}`,
  },
  {
    code: "custom",
    name: "Custom Dispute Letter",
    category: "General",
    letterType: "Custom",
    body: `RE: Dispute of Inaccurate Information\n\nDear {{bureau}} Credit Bureau,\n\nI am writing to dispute the following information on my credit report:\n\n• Creditor: {{creditor}}\n• Account number: {{account_number}}\n\nThis information is inaccurate. Please investigate this item per your obligations under the Fair Credit Reporting Act and correct or delete it within 30 days.\n\nSincerely,\n\n{{client_name}}\n{{date}}`,
  },
];

async function seedTemplates() {
  for (const t of TEMPLATES) {
    const existing = await prisma.letterTemplate.findFirst({
      where: { code: t.code, isSystem: true },
    });
    if (existing) continue;
    await prisma.letterTemplate.create({
      data: { ...t, isSystem: true },
    });
  }
}

async function seedDemoAgency() {
  const tenant = await upsertTenant("summit-credit", "Summit Credit Solutions", "#6366f1", TenantPlan.BUSINESS);
  const tenant2 = await upsertTenant("northstar-credit", "Northstar Credit Group", "#0ea5e9", TenantPlan.PROFESSIONAL);

  const superadmin = await upsertUser(tenant.id, "superadmin@creditos.dev", "Platform Super Admin", Role.SUPER_ADMIN, { isSuperAdmin: true });
  const admin = await upsertUser(tenant.id, "admin@summit.test", "Sofia Martinez", Role.ADMIN, { phone: "+1 555-0101" });
  const specialist = await upsertUser(tenant.id, "specialist@summit.test", "David Chen", Role.CREDIT_SPECIALIST, { phone: "+1 555-0102" });
  const disputes = await upsertUser(tenant.id, "disputes@summit.test", "Priya Patel", Role.DISPUTE_SPECIALIST, { phone: "+1 555-0103" });
  const attorney = await upsertUser(tenant.id, "attorney@summit.test", "Marcus Webb", Role.ATTORNEY, { phone: "+1 555-0104" });
  const client = await upsertUser(tenant.id, "client@summit.test", "Alex Rivera", Role.CLIENT, { phone: "+1 555-0123" });
  const client2 = await upsertUser(tenant.id, "jordan@summit.test", "Jordan Lee", Role.CLIENT);

  const northAdmin = await upsertUser(tenant2.id, "admin@northstar.test", "Chen Wei", Role.ADMIN);
  const northClient = await upsertUser(tenant2.id, "client@northstar.test", "Morgan Chen", Role.CLIENT);

  // Feature flags
  const flags = [
    { key: "ai_analysis", enabled: true },
    { key: "letter_library", enabled: true },
    { key: "dispute_workflow", enabled: true },
    { key: "payments", enabled: false },
    { key: "credit_monitoring", enabled: false },
  ];
  for (const f of flags) {
    const existing = await prisma.featureFlag.findFirst({ where: { key: f.key, tenantId: null } });
    if (existing) continue;
    await prisma.featureFlag.create({ data: { key: f.key, enabled: f.enabled } });
  }

  // ── Sample credit report (Experian) for Alex Rivera ───────────────────────
  const existingReport = await prisma.creditReport.findFirst({
    where: { tenantId: tenant.id, clientId: client.id, bureau: Bureau.EXPERIAN },
  });
  let report = existingReport;
  if (!report) {
    report = await prisma.creditReport.create({
      data: {
        tenantId: tenant.id,
        clientId: client.id,
        bureau: Bureau.EXPERIAN,
        filename: "sample-experian-report.csv",
        mimeType: "text/csv",
        status: "ANALYZED" as never,
        analyzedAt: new Date(),
        pulledAt: new Date("2026-07-28"),
        summary: {
          totalAccounts: 5,
          negativeAccounts: 3,
          collections: 2,
          latePayments: 1,
          chargeOffs: 1,
        },
      },
    });

    const acc1 = await prisma.creditAccount.create({
      data: {
        reportId: report.id,
        accountName: "First National Collection",
        accountType: "Collection",
        bureau: Bureau.EXPERIAN,
        accountNumber: "XFN-441209",
        status: "Collection Account",
        balance: 1240,
        lastReportedDate: new Date("2019-03-12"),
        dateFirstDelinquent: new Date("2018-01-15"),
        monthsNegative: 18,
        isNegative: true,
        negativeFlags: ["collection"],
      },
    });
    await prisma.creditAccount.create({
      data: {
        reportId: report.id,
        accountName: "Capital One",
        accountType: "Revolving",
        bureau: Bureau.EXPERIAN,
        accountNumber: "5178 4521 9076 3312",
        status: "Charge Off",
        balance: 3850,
        creditLimit: 4000,
        highBalance: 4200,
        paymentHistory: "111111111111111111111111",
        openedDate: new Date("2019-05-01"),
        lastReportedDate: new Date("2024-01-30"),
        dateFirstDelinquent: new Date("2022-11-01"),
        monthsNegative: 4,
        isNegative: true,
        negativeFlags: ["charge_off"],
      },
    });
    await prisma.creditAccount.create({
      data: {
        reportId: report.id,
        accountName: "Verizon Wireless",
        accountType: "Collection",
        bureau: Bureau.EXPERIAN,
        accountNumber: "VZN-88213",
        status: "Collection",
        balance: 312,
        lastReportedDate: new Date("2022-06-15"),
        dateFirstDelinquent: new Date("2020-09-01"),
        monthsNegative: 6,
        isNegative: true,
        negativeFlags: ["collection"],
      },
    });
    await prisma.creditAccount.create({
      data: {
        reportId: report.id,
        accountName: "Chase Freedom",
        accountType: "Revolving",
        bureau: Bureau.EXPERIAN,
        accountNumber: "4356 8810 2244 9917",
        status: "Current",
        balance: 1200,
        creditLimit: 6500,
        paymentHistory: "000000000000000000000000",
        openedDate: new Date("2021-03-15"),
        lastReportedDate: new Date("2026-07-01"),
        isNegative: false,
        negativeFlags: [],
      },
    });
    await prisma.creditAccount.create({
      data: {
        reportId: report.id,
        accountName: "Student Loan Services",
        accountType: "Installment",
        bureau: Bureau.EXPERIAN,
        accountNumber: "SLS-9912201",
        status: "Current",
        balance: 18400,
        creditLimit: 21000,
        paymentHistory: "000000000000000000000000",
        openedDate: new Date("2017-08-20"),
        lastReportedDate: new Date("2026-07-05"),
        isNegative: false,
        negativeFlags: [],
      },
    });

    await prisma.scoreSnapshot.create({
      data: { reportId: report.id, bureau: Bureau.EXPERIAN, score: 612, reasonCodes: ["Too many inquiries", "Serious delinquency", "High utilization"] },
    });

    const inquiries = [
      { company: "Ally Financial", date: new Date("2026-05-12") },
      { company: "Discover Bank", date: new Date("2026-06-02") },
      { company: "Citi Card", date: new Date("2026-06-18") },
    ];
    for (const i of inquiries) {
      await prisma.creditInquiry.create({ data: { reportId: report.id, company: i.company, type: "hard", date: i.date } });
    }

    // Run the local analysis engine at seed time for a realistic analyzed report
    const { LocalEngine } = await import("../src/analysis/local-engine");
    const engine = new LocalEngine();
    const result = engine.analyzeReport({
      reportId: report.id,
      bureau: "EXPERIAN",
      clientName: client.name,
      accounts: [
        {
          id: acc1.id,
          accountName: "First National Collection",
          accountType: "Collection",
          status: "Collection Account",
          balance: 1240,
          lastReportedDate: new Date("2019-03-12"),
          dateFirstDelinquent: new Date("2018-01-15"),
          monthsNegative: 18,
          isNegative: true,
          negativeFlags: ["collection"],
        },
        {
          id: "seed-acc-capone",
          accountName: "Capital One",
          accountType: "Revolving",
          status: "Charge Off",
          balance: 3850,
          creditLimit: 4000,
          paymentHistory: "111111111111111111111111",
          lastReportedDate: new Date("2024-01-30"),
          monthsNegative: 4,
          isNegative: true,
          negativeFlags: ["charge_off"],
        },
        {
          id: "seed-acc-verizon",
          accountName: "Verizon Wireless",
          accountType: "Collection",
          status: "Collection",
          balance: 312,
          lastReportedDate: new Date("2022-06-15"),
          monthsNegative: 6,
          isNegative: true,
          negativeFlags: ["collection"],
        },
      ],
      inquiryCount: 3,
      publicRecordCount: 0,
      latestScore: 612,
    });
    await prisma.creditReport.update({
      where: { id: report.id },
      data: { analysisJson: JSON.parse(JSON.stringify(result)) },
    });
  }

  // ── Letters + disputes ────────────────────────────────────────────────────
  const template623 = await prisma.letterTemplate.findFirst({ where: { code: "623", isSystem: true } });

  const dispute1 = await prisma.dispute.upsert({
    where: { id: "seed-dispute-capone" },
    update: {},
    create: {
      id: "seed-dispute-capone",
      tenantId: tenant.id,
      clientId: client.id,
      reportId: report.id,
      title: "Capital One Charge-Off — Furnisher Dispute",
      status: DisputeStatus.ACTIVE,
      currentRound: 1,
      priority: TaskPriority.HIGH,
      notes: "Charge-off balance unverified by furnisher; payment history shows no late codes.",
    },
  });
  await prisma.dispute.upsert({
    where: { id: "seed-dispute-fnc" },
    update: {},
    create: {
      id: "seed-dispute-fnc",
      tenantId: tenant.id,
      clientId: client.id,
      reportId: report.id,
      title: "First National Collection — Obsolete Item",
      status: DisputeStatus.DRAFT,
      currentRound: 0,
      priority: TaskPriority.MEDIUM,
      notes: "Collection is beyond the 7-year reporting window (2019).",
    },
  });

  const letter1 = await prisma.letter.upsert({
    where: { id: "seed-letter-623" },
    update: {},
    create: {
      id: "seed-letter-623",
      tenantId: tenant.id,
      clientId: client.id,
      disputeId: dispute1.id,
      templateId: template623?.id,
      title: "623 Furnisher Dispute — Capital One",
      letterType: "623",
      status: LetterStatus.SENT,
      version: 1,
      createdById: specialist.id,
      body: `RE: Dispute to Data Furnisher — Capital One\n\nDear Capital One,\n\nI am writing directly to you as the data furnisher regarding the item you are reporting on my credit report, pursuant to Section 623 of the Fair Credit Reporting Act (15 U.S.C. § 1681s-2):\n\n• Account number: 5178 4521 9076 3312\n• Reported balance: $3,850.00\n• Last reported: 2024-01-30\n\nI dispute the accuracy of this information. My 24-month payment history shows no late payments, yet this account is reported as a charge-off. Please investigate this matter, correct your records, and instruct all credit reporting agencies to update their files accordingly.\n\nIf you cannot verify the accuracy of this information within 30 days, please delete it from my credit file.\n\nSincerely,\n\nAlex Rivera\nJuly 30, 2026`,
    },
  });
  await prisma.letterVersion.upsert({
    where: { letterId_version: { letterId: letter1.id, version: 1 } },
    update: {},
    create: { letterId: letter1.id, version: 1, title: letter1.title, body: letter1.body, createdById: specialist.id },
  });
  await prisma.disputeRound.upsert({
    where: { disputeId_roundNumber: { disputeId: dispute1.id, roundNumber: 1 } },
    update: {},
    create: {
      disputeId: dispute1.id,
      roundNumber: 1,
      letterId: letter1.id,
      status: RoundStatus.SENT,
      sentAt: new Date("2026-07-30"),
    },
  });

  // ── Tasks ─────────────────────────────────────────────────────────────────
  await prisma.task.upsert({
    where: { id: "seed-task-followup" },
    update: {},
    create: {
      id: "seed-task-followup",
      tenantId: tenant.id,
      clientId: client.id,
      assigneeId: specialist.id,
      createdById: specialist.id,
      title: "Follow up on Capital One response (30-day window)",
      description: "Bureau investigation window closes. If no response, escalate to Round 2.",
      dueAt: new Date("2026-08-29"),
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
    },
  });
  await prisma.task.upsert({
    where: { id: "seed-task-round2" },
    update: {},
    create: {
      id: "seed-task-round2",
      tenantId: tenant.id,
      clientId: client.id,
      assigneeId: disputes.id,
      createdById: disputes.id,
      title: "Prepare Round 2 letter for First National Collection",
      description: "Draft 604 letter to Experian citing the 7-year reporting limit.",
      dueAt: new Date("2026-08-12"),
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
    },
  });

  // ── Notifications ─────────────────────────────────────────────────────────
  await prisma.notification.create({
    data: {
      tenantId: tenant.id,
      userId: client.id,
      type: NotificationType.ALERT,
      title: "Credit analysis complete — Experian",
      body: "3 high-priority findings. Estimated gain: +70 pts.",
      link: `/reports/${report.id}`,
    },
  });
  await prisma.notification.create({
    data: {
      tenantId: tenant.id,
      userId: specialist.id,
      type: NotificationType.INFO,
      title: "New client task assigned",
      body: "Prepare Round 2 letter for First National Collection.",
      link: "/tasks",
    },
  });

  // ── Audit trail ───────────────────────────────────────────────────────────
  const auditEntries = [
    { userId: specialist.id, action: "report.uploaded", entity: "CreditReport", entityId: report.id, meta: { filename: "sample-experian-report.csv" } },
    { userId: specialist.id, action: "report.analyzed", entity: "CreditReport", entityId: report.id, meta: { findings: 4, engine: "local-engine" } },
    { userId: specialist.id, action: "letter.generated", entity: "Letter", entityId: letter1.id, meta: { template: "623" } },
    { userId: specialist.id, action: "dispute.round.started", entity: "Dispute", entityId: dispute1.id, meta: { round: 1 } },
  ];
  for (const a of auditEntries) {
    await prisma.auditLog.create({ data: { ...a, tenantId: tenant.id } });
  }

  // ── Consents ──────────────────────────────────────────────────────────────
  await prisma.consent.upsert({
    where: { clientId_type_version: { clientId: client.id, type: "credit_authorization", version: "1.0" } },
    update: {},
    create: {
      tenantId: tenant.id,
      clientId: client.id,
      type: "credit_authorization",
      version: "1.0",
      acceptedAt: new Date("2026-07-20"),
      ip: "127.0.0.1",
    },
  });

  console.log("Seeded Summit Credit Solutions:", {
    superadmin: superadmin.email,
    admin: admin.email,
    specialist: specialist.email,
    disputes: disputes.email,
    attorney: attorney.email,
    client: client.email,
    client2: client2.email,
  });
  console.log("Seeded Northstar Credit Group:", {
    admin: northAdmin.email,
    client: northClient.email,
  });
  console.log(`Seeded ${TEMPLATES.length} system letter templates`);
}

// ── Pricing catalog: business (agency SaaS) + consumer (client services) ────

const BUSINESS_PLANS = [
  {
    code: "STARTER",
    name: "Starter",
    description: "For solo credit specialists",
    priceCents: 4900,
    interval: PlanInterval.MONTH,
    popular: false,
    sortOrder: 1,
    stripePriceId: null,
    features: ["10 active clients", "3 workspace users", "All bureaus + OCR", "AI analysis with findings", "Letter generator + PDF"],
  },
  {
    code: "PROFESSIONAL",
    name: "Professional",
    description: "For growing repair agencies",
    priceCents: 14900,
    interval: PlanInterval.MONTH,
    popular: true,
    sortOrder: 2,
    stripePriceId: null,
    features: ["50 active clients", "10 workspace users", "Dispute workflow rounds 1–3", "Bureau response reader", "Client portal + e-sign", "Automation rules"],
  },
  {
    code: "BUSINESS",
    name: "Business",
    description: "For multi-branch operations",
    priceCents: 39900,
    interval: PlanInterval.MONTH,
    popular: false,
    sortOrder: 3,
    stripePriceId: null,
    features: ["250 active clients", "Unlimited users", "CRM & sales pipeline", "White-label branding", "API access", "Priority support"],
  },
  {
    code: "ENTERPRISE",
    name: "Enterprise",
    description: "Custom deployments, SLAs & compliance",
    priceCents: 0,
    interval: PlanInterval.MONTH,
    popular: false,
    sortOrder: 4,
    stripePriceId: null,
    features: ["Unlimited clients", "Dedicated success manager", "SSO / SAML", "Custom AI models & prompts", "SOC 2 audit pack", "Custom SLA"],
  },
];

const CONSUMER_PLANS = [
  {
    code: "KICKSTART",
    name: "Kickstart",
    description: "One-time dispute audit + first letter",
    priceCents: 19900,
    interval: PlanInterval.ONE_TIME,
    popular: false,
    sortOrder: 1,
    features: ["1 credit report review", "AI error analysis", "1 dispute letter (609/611)", "Delivered in 48h"],
  },
  {
    code: "STANDARD",
    name: "Standard Repair",
    description: "3-month full repair program",
    priceCents: 49900,
    interval: PlanInterval.ONE_TIME,
    popular: true,
    sortOrder: 2,
    features: ["All 3 bureau reports", "Unlimited dispute rounds", "Bureau response handling", "Score monitoring during program", "Priority email support"],
  },
  {
    code: "COMPLETE",
    name: "Complete Repair",
    description: "6-month program with attorney review",
    priceCents: 89900,
    interval: PlanInterval.ONE_TIME,
    popular: false,
    sortOrder: 3,
    features: ["Everything in Standard", "Attorney review of disputes", "CFPB complaint filing", "Identity-theft toolkit", "Dedicated specialist"],
  },
  {
    code: "MONITORING",
    name: "Credit Monitoring",
    description: "Ongoing score & inquiry alerts",
    priceCents: 1900,
    interval: PlanInterval.MONTH,
    popular: false,
    sortOrder: 4,
    features: ["Daily score tracking", "New inquiry alerts", "New collection alerts", "Identity-theft alerts"],
  },
];

// ── Stripe price wiring ────────────────────────────────────────────────────
// Plans are seeded with a Stripe Price ID so `POST /billing/checkout` can
// create real Stripe Checkout Sessions. Resolution order per plan:
//   1. STRIPE_PRICE_<CODE> env var (explicit — always wins)
//   2. Auto-created via the Stripe API when STRIPE_SECRET_KEY is set
//      (billable business plans only; idempotent via product metadata)
// Without a Stripe key, plans keep their stored value (null by default) and
// billing falls back to local/simulated mode.

interface SeedPlan {
  model: PlanModel;
  code: string;
  name: string;
  priceCents: number;
  interval: PlanInterval;
}

let stripeClient: Stripe | null | undefined;
function getStripeClient(): Stripe | null {
  if (stripeClient !== undefined) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  // Use the SDK's default API version (see billing/stripe.service.ts).
  stripeClient = key ? new Stripe(key) : null;
  return stripeClient;
}

/** Reuse an existing Stripe price for the plan, or create product + price. */
async function ensureStripePrice(stripe: Stripe, plan: SeedPlan): Promise<string> {
  // Use the standard list endpoint — it is strongly consistent, whereas
  // products.search can lag behind newly created objects and would let the
  // seed create duplicate products on consecutive runs.
  const products = await stripe.products.list({ active: true, limit: 100 });
  const existing = products.data.find((prod) => prod.metadata?.creditos_plan_code === plan.code);

  if (existing) {
    const prices = await stripe.prices.list({ product: existing.id, active: true, limit: 20 });
    // Reuse only if the price matches both the interval and the current amount;
    // Stripe prices are immutable, so a changed priceCents creates a new price.
    const match = prices.data.find(
      (price) =>
        price.unit_amount === plan.priceCents &&
        (plan.interval === PlanInterval.MONTH ? price.recurring?.interval === "month" : !price.recurring),
    );
    if (match) return match.id;
  }

  const product =
    existing ??
    (await stripe.products.create({
      name: plan.name,
      description: `CreditOS ${plan.code} plan`,
      metadata: { creditos_plan_code: plan.code },
    }));

  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: plan.priceCents,
    recurring: plan.interval === PlanInterval.MONTH ? { interval: "month" } : undefined,
    metadata: { creditos_plan_code: plan.code },
  });
  return price.id;
}

/**
 * Resolve the Stripe Price ID for a seeded plan.
 * Returns `undefined` when nothing should change (keeps the stored value).
 */
async function resolveStripePriceId(plan: SeedPlan): Promise<string | undefined> {
  const fromEnv = process.env[`STRIPE_PRICE_${plan.code}`];
  if (fromEnv) return fromEnv;

  const stripe = getStripeClient();
  const isBillable =
    plan.model === PlanModel.BUSINESS && plan.priceCents > 0 && plan.interval === PlanInterval.MONTH;
  if (stripe && isBillable) {
    try {
      return await ensureStripePrice(stripe, plan);
    } catch (err) {
      console.warn(`[seed] Could not sync Stripe price for ${plan.code}:`, (err as Error).message);
    }
  }
  return undefined;
}

async function seedPlans() {
  // No free plans — drop any legacy FREE plan rows left by older seeds.
  await prisma.plan.deleteMany({ where: { code: "FREE" } });

  const plans: SeedPlan[] = [
    ...BUSINESS_PLANS.map((p) => ({ ...p, model: PlanModel.BUSINESS })),
    ...CONSUMER_PLANS.map((p) => ({ ...p, model: PlanModel.CONSUMER })),
  ];
  for (const p of plans) {
    const key = { model_code: { model: p.model, code: p.code } };
    const stripePriceId = await resolveStripePriceId(p);
    const existing = await prisma.plan.findUnique({ where: key });
    if (existing) {
      await prisma.plan.update({
        where: key,
        data: {
          ...p,
          model: undefined,
          ...(stripePriceId !== undefined ? { stripePriceId } : {}),
        },
      });
    } else {
      await prisma.plan.create({
        data: { ...p, ...(stripePriceId !== undefined ? { stripePriceId } : {}) },
      });
    }
  }
}

async function seedBilling(tenant: { id: string }, planCode: string, since: string) {
  const plan = await prisma.plan.findUnique({ where: { model_code: { model: PlanModel.BUSINESS, code: planCode } } });
  await prisma.subscription.upsert({
    where: { tenantId: tenant.id },
    update: { planCode, status: SubscriptionStatus.ACTIVE },
    create: {
      tenantId: tenant.id,
      planCode,
      status: SubscriptionStatus.ACTIVE,
      provider: "local",
      seats: plan?.code === "BUSINESS" || plan?.code === "ENTERPRISE" ? 10 : 3,
      currentPeriodEnd: new Date(new Date().setMonth(new Date().getMonth() + 1)),
    },
  });

  const existing = await prisma.invoice.count({ where: { tenantId: tenant.id } });
  if (existing > 0) return;
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth() - 1, periodEnd.getDate());
  await prisma.invoice.create({
    data: {
      tenantId: tenant.id,
      number: `INV-${periodEnd.getFullYear()}-0001`,
      description: `${plan?.name ?? planCode} — monthly subscription`,
      amountCents: plan?.priceCents ?? 0,
      status: InvoiceStatus.PAID,
      periodStart,
      periodEnd,
      paidAt: new Date(since),
      lineItems: [
        { label: `${plan?.name ?? planCode} plan`, amountCents: plan?.priceCents ?? 0 },
        { label: "Tax (0%)", amountCents: 0 },
      ],
    },
  });
}

// ── CRM ─────────────────────────────────────────────────────────────────────

const CRM_LEADS = [
  { name: "Melissa Grant", email: "melissa.grant@gmail.com", phone: "+1 555-0201", company: "—", source: "website", stage: CrmStage.WON, value: 89900, score: 88, tags: ["organic", "complete"], notes: "Signed Complete Repair after demo call.", followUp: null },
  { name: "Derek Stone", email: "derek.stone@yahoo.com", phone: "+1 555-0202", company: "—", source: "referral", stage: CrmStage.PROPOSAL, value: 49900, score: 74, tags: ["referral"], notes: "Comparing two agencies; needs 3-bureau program.", followUp: "2026-08-12T15:00:00.000Z" },
  { name: "Aisha Bello", email: "aisha.bello@outlook.com", phone: "+1 555-0203", company: "—", source: "facebook", stage: CrmStage.QUALIFIED, value: 19900, score: 61, tags: ["facebook", "starter"], notes: "Concerned about an obsolete collection. Prefers phone.", followUp: "2026-08-10T10:00:00.000Z" },
  { name: "Tom Nguyen", email: "tom.nguyen@proton.me", phone: "+1 555-0204", company: "—", source: "website", stage: CrmStage.CONTACTED, value: 49900, score: 45, tags: ["organic"], notes: "Sent intro email; awaiting reply.", followUp: "2026-08-09T09:00:00.000Z" },
  { name: "Rosa Delgado", email: "rosa.delgado@gmail.com", phone: "+1 555-0205", company: "—", source: "walk-in", stage: CrmStage.NEW, value: 19900, score: 32, tags: ["walk-in"], notes: "Walked in; needs a report review first.", followUp: null },
  { name: "Evan Foster", email: "evan.foster@gmail.com", phone: "+1 555-0206", company: "—", source: "cold-call", stage: CrmStage.LOST, value: 49900, score: 15, tags: ["cold-call"], notes: "Went with DIY after price quote.", followUp: null },
];

async function seedCrm(tenant: { id: string }, ownerId: string) {
  for (const l of CRM_LEADS) {
    const existing = await prisma.crmLead.findFirst({ where: { tenantId: tenant.id, name: l.name } });
    if (existing) continue;
    const lead = await prisma.crmLead.create({
      data: {
        tenantId: tenant.id,
        name: l.name,
        email: l.email,
        phone: l.phone,
        company: l.company,
        source: l.source,
        stage: l.stage,
        value: l.value,
        score: l.score,
        tags: l.tags,
        notes: l.notes,
        ownerId,
        nextFollowUpAt: l.followUp ? new Date(l.followUp) : undefined,
        wonAt: l.stage === CrmStage.WON ? new Date("2026-07-28") : undefined,
      },
    });
    await prisma.crmActivity.create({
      data: {
        tenantId: tenant.id,
        leadId: lead.id,
        type: l.stage === CrmStage.WON ? CrmActivityType.MEETING : CrmActivityType.CALL,
        subject: l.stage === CrmStage.WON ? "Onboarding call completed" : "Initial discovery call",
        body: l.notes,
        createdById: ownerId,
      },
    });
  }
}

// ── Knowledge base ──────────────────────────────────────────────────────────

const ARTICLES: Array<{ slug: string; title: string; category: string; excerpt: string; order: number; body: string }> = [
  {
    slug: "what-is-credit-repair",
    title: "What is credit repair?",
    category: "getting-started",
    excerpt: "How the dispute process works and what CreditOS does (and doesn't) do.",
    order: 1,
    body: "Credit repair is the process of disputing inaccurate, incomplete or unverifiable information on your credit reports with the three nationwide bureaus (Experian, Equifax, TransUnion).\n\nCreditOS helps consumers and repair agencies prepare FCRA-compliant dispute letters, track rounds of disputes, and monitor bureau responses. CreditOS is **not** a law firm, is **not** a credit bureau, and does **not** guarantee any particular outcome. Under 15 U.S.C. § 1679c you may always dispute directly with the bureaus at no cost.",
  },
  {
    slug: "upload-a-credit-report",
    title: "Uploading your credit report",
    category: "getting-started",
    excerpt: "CSV or PDF from any bureau — parsing and AI analysis happen automatically.",
    order: 2,
    body: "From the Reports page, choose the client, the bureau, and attach the file (CSV or PDF up to 25 MB). The parser normalizes tradelines, inquiries and public records; for PDFs an OCR fallback kicks in. AI analysis then runs in the background and flags findings with confidence scores.",
  },
  {
    slug: "dispute-rounds-explained",
    title: "Dispute rounds 1–3, explained",
    category: "disputes",
    excerpt: "Sent → Delivered → Received → Response: how rounds are tracked.",
    order: 1,
    body: "Each dispute starts at Round 1 when its first letter is sent. A round moves through SENT → DELIVERED → RECEIVED → RESPONSE_RECEIVED. If the bureau verifies the item, start Round 2 with a different legal basis (e.g., a 623 direct-to-furnisher dispute). Most agencies plan for up to 3 rounds, then escalate to CFPB or attorney review.",
  },
  {
    slug: "609-vs-611-vs-623",
    title: "609 vs 611 vs 623 letters",
    category: "letters",
    excerpt: "Which FCRA section to cite and when.",
    order: 1,
    body: "**609 (15 U.S.C. § 1681g)** — request the complete contents of your file. **611 (§ 1681i)** — request a reinvestigation of a specific item. **623 (§ 1681s-2)** — dispute directly with the data furnisher. Use 609 for a file-wide request, 611 after a verification you disagree with, and 623 when the furnisher is the problem.",
  },
  {
    slug: "statute-of-limitations",
    title: "Statute of limitations on old debts",
    category: "disputes",
    excerpt: "Obsolete collections: the 7-year reporting limit.",
    order: 2,
    body: "Most negative items can only be reported for **7 years** from the original delinquency date (10 for some bankruptcies). A collection beyond that window is obsolete and should be removed under 15 U.S.C. § 1681c. The AI analysis flags obsolete items automatically.",
  },
  {
    slug: "billing-and-plans",
    title: "Billing & plan switching",
    category: "billing",
    excerpt: "How subscriptions, invoices, trials and seat limits work.",
    order: 1,
    body: "New workspaces start with a free trial — explore all features with no commitment. After the trial, choose a plan (Starter, Professional, Business, or Enterprise) from the Billing page. Switch plans anytime — the invoice is generated immediately and your feature entitlements update. Plan limits include active clients and workspace seats.",
  },
  {
    slug: "compliance-disclosures",
    title: "Required compliance disclosures",
    category: "compliance",
    excerpt: "The § 1679c disclosure and what it means.",
    order: 1,
    body: "15 U.S.C. § 1679c requires a clear statement that the company is not a consumer reporting agency, that consumers may dispute directly with the bureaus at no cost, and that credit repair cannot guarantee results. CreditOS shows this disclosure on all client-facing report and dispute views.",
  },
  {
    slug: "identity-theft-first-steps",
    title: "Identity theft: first steps",
    category: "getting-started",
    excerpt: "FTC report, police report, fraud alerts and freezes.",
    order: 3,
    body: "1) File a report at identitytheft.gov to get an FTC Identity Theft Report. 2) Place a fraud alert or credit freeze with the bureaus. 3) File a police report if you have evidence. 4) Dispute fraudulent accounts with the identity-theft letter template. Keep all reports — you'll need them for blocked-account requests.",
  },
  {
    slug: "faq-how-long",
    title: "How long does credit repair take?",
    category: "faq",
    excerpt: "Typical timelines for disputes and score movement.",
    order: 1,
    body: "Bureaus must investigate within 30 days (45 in limited cases). Most clients see the first deletions within 60–90 days, with meaningful score movement over 3–6 months. Results vary — no service can guarantee a specific score or deletion.",
  },
];

async function seedKnowledge() {
  for (const a of ARTICLES) {
    await prisma.knowledgeArticle.upsert({
      where: { slug: a.slug },
      update: { title: a.title, category: a.category, excerpt: a.excerpt, body: a.body, order: a.order, published: true },
      create: { ...a, published: true },
    });
  }
}

async function main() {
  await seedTemplates();
  await seedPlans();
  await seedDemoAgency();
  await seedBilling((await prisma.tenant.findUnique({ where: { slug: "summit-credit" } }))!, "BUSINESS", "2026-08-01");
  await seedBilling((await prisma.tenant.findUnique({ where: { slug: "northstar-credit" } }))!, "PROFESSIONAL", "2026-08-01");
  const specialist = await prisma.user.findUnique({ where: { tenantId_email: { tenantId: (await prisma.tenant.findUnique({ where: { slug: "summit-credit" } }))!.id, email: "specialist@summit.test" } } });
  if (specialist) await seedCrm((await prisma.tenant.findUnique({ where: { slug: "summit-credit" } }))!, specialist.id);
  await seedKnowledge();
  console.log("✅ Seed complete — all passwords are:", PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
