-- Trial expiry: subscriptions whose trial ended without conversion get EXPIRED
-- (access blocked with a 402 until a paid plan is chosen).
ALTER TYPE "SubscriptionStatus" ADD VALUE 'EXPIRED';
