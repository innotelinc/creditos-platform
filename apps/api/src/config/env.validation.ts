import { z } from "zod";

const booleanFromString = (v: unknown, def: boolean) => {
  if (typeof v === "string") return v.toLowerCase() === "true";
  return (v as boolean) ?? def;
};

const intFromString = (v: unknown, def: number) => {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : def;
};

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional().default(""),
  S3_ENDPOINT: z.string().default("http://localhost:9000"),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().default("creditos"),
  S3_ACCESS_KEY: z.string().default("minioadmin"),
  S3_SECRET_KEY: z.string().default("minioadmin"),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  SMTP_FROM: z.string().default("CreditOS <no-reply@creditos.local>"),
  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 chars"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 chars"),
  JWT_ACCESS_TTL: z.coerce.number().default(900),
  JWT_REFRESH_TTL: z.coerce.number().default(2592000),
  APP_URL: z.string().default("http://localhost:3000"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  AI_PROVIDER: z.enum(["openrouter", "openai", "local", "custom"]).default("openrouter"),
  AI_BASE_URL: z.string().default("https://openrouter.ai/api/v1"),
  AI_API_KEY: z.string().optional().default(""),
  AI_MODEL: z.string().default("deepseek/deepseek-chat"),
  AI_TIMEOUT_MS: z.coerce.number().default(60000),
  RUN_SEED: z.string().optional().default("false"),
  TRIAL_DAYS: z.coerce.number().int().min(0).default(3),
  STRIPE_SECRET_KEY: z.string().optional().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(""),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const env = parsed.data;
  return {
    ...env,
    AI_API_KEY: env.AI_API_KEY?.trim() ?? "",
    RUN_SEED: booleanFromString(env.RUN_SEED, false) ? "true" : "false",
    REDIS_PORT: intFromString(env.REDIS_PORT, 6379),
    JWT_ACCESS_TTL: intFromString(env.JWT_ACCESS_TTL, 900),
    JWT_REFRESH_TTL: intFromString(env.JWT_REFRESH_TTL, 2592000),
  };
}
