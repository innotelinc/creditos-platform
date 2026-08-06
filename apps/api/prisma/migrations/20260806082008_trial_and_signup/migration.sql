-- AlterEnum
ALTER TYPE "TenantPlan" ADD VALUE 'TRIAL';

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "trialEndsAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'TRIALING';
