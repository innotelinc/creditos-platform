-- Credit pulls: automatic report ingestion via third-party providers using a
-- consumer share code (SmartCredit / IdentityIQ / simulated), plus staff notes
-- on clients and reports, and per-pull cost tracking for pass-through pricing.

ALTER TABLE "User" ADD COLUMN "notes" TEXT;

ALTER TABLE "CreditReport" ADD COLUMN "notes" TEXT;
ALTER TABLE "CreditReport" ADD COLUMN "provider" TEXT;
ALTER TABLE "CreditReport" ADD COLUMN "shareCodeHash" TEXT;

CREATE TABLE "ReportPull" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reportId" TEXT,
    "provider" TEXT NOT NULL,
    "bureau" "Bureau" NOT NULL DEFAULT 'OTHER',
    "shareCodeHash" TEXT,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "providerRef" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReportPull_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ReportPull" ADD CONSTRAINT "ReportPull_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportPull" ADD CONSTRAINT "ReportPull_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "CreditReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ReportPull_tenantId_idx" ON "ReportPull"("tenantId");
CREATE INDEX "ReportPull_reportId_idx" ON "ReportPull"("reportId");
