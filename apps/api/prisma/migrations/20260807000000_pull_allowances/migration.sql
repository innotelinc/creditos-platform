-- Pull-allowance enforcement: per-plan bundled pulls, usage-period tracking,
-- and Stripe metered overage billing.

-- Numeric pull allowance bundled with each plan (0 = no bundled pulls).
ALTER TABLE "Plan" ADD COLUMN "pullsIncluded" INTEGER NOT NULL DEFAULT 0;

-- Usage-tracking state on the subscription:
--  usagePeriodStart — start of the current allowance period (lazily rolled)
--  usageItemId      — Stripe subscription item id for the metered overage price
ALTER TABLE "Subscription" ADD COLUMN "usagePeriodStart" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN "usageItemId" TEXT;

-- Mark pulls that exceeded the plan allowance (metered / billed as overage).
ALTER TABLE "ReportPull" ADD COLUMN "overage" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: mirror each plan's bundled-pulls feature count into pullsIncluded
-- where the features array advertises "<n> ... pulls" (seed plans only).
UPDATE "Plan" SET "pullsIncluded" = 10 WHERE model = 'BUSINESS' AND code = 'STARTER';
UPDATE "Plan" SET "pullsIncluded" = 40 WHERE model = 'BUSINESS' AND code = 'PROFESSIONAL';
UPDATE "Plan" SET "pullsIncluded" = 150 WHERE model = 'BUSINESS' AND code = 'BUSINESS';
UPDATE "Plan" SET "pullsIncluded" = 1 WHERE model = 'CONSUMER' AND code = 'KICKSTART';
UPDATE "Plan" SET "pullsIncluded" = 3 WHERE model = 'CONSUMER' AND code = 'STANDARD';
UPDATE "Plan" SET "pullsIncluded" = 6 WHERE model = 'CONSUMER' AND code = 'COMPLETE';
UPDATE "Plan" SET "pullsIncluded" = 1 WHERE model = 'CONSUMER' AND code = 'MONITORING';
