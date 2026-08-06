-- AlterEnum: remove FREE from TenantPlan.
-- No free plans — legacy tenants are moved onto the trial plan first.
UPDATE "Tenant" SET "plan" = 'TRIAL' WHERE "plan" = 'FREE';

BEGIN;
CREATE TYPE "TenantPlan_new" AS ENUM ('TRIAL', 'STARTER', 'PROFESSIONAL', 'BUSINESS', 'ENTERPRISE');
ALTER TABLE "public"."Tenant" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "Tenant" ALTER COLUMN "plan" TYPE "TenantPlan_new" USING ("plan"::text::"TenantPlan_new");
ALTER TYPE "TenantPlan" RENAME TO "TenantPlan_old";
ALTER TYPE "TenantPlan_new" RENAME TO "TenantPlan";
DROP TYPE "public"."TenantPlan_old";
ALTER TABLE "Tenant" ALTER COLUMN "plan" SET DEFAULT 'TRIAL';
COMMIT;

-- AlterTable
ALTER TABLE "Tenant" ALTER COLUMN "plan" SET DEFAULT 'TRIAL';
