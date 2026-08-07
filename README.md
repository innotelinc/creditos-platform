# CreditOS — AI Credit Repair Operating System

An original, enterprise-grade SaaS platform for credit repair agencies and
consumers: ingest credit reports, detect errors with AI, generate FCRA-compliant
dispute letters, and run the multi-round dispute workflow — with full RBAC,
multi-tenant isolation, audit trails, and compliance disclosures built in.

> **Important:** CreditOS is a documentation, letter-generation and
> dispute-tracking platform. It is not a law firm, is not a credit bureau, and
> does not provide legal advice. Credit outcomes are not guaranteed.

---

## Stack

| Layer      | Tech                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------- |
| Frontend   | Next.js 15 · React 19 · TypeScript · TailwindCSS 4 · Framer Motion · TanStack Query · RHF + Zod |
| Backend    | NestJS 11 · Prisma · PostgreSQL 16 · Redis + BullMQ · JWT (refresh rotation) · TOTP 2FA   |
| AI         | OpenAI-compatible provider interface (OpenRouter / your own proxy) + deterministic local engine |
| Storage    | MinIO (S3-compatible) · SMTP/MailHog (local email)                                        |
| DevOps     | Docker Compose · Kubernetes manifests · GitHub Actions CI                                 |

## Quick start — one command

```bash
cp .env.example .env        # defaults work out of the box
docker compose up --build -d
```

The API container runs `prisma migrate deploy` and seeds demo data on first
boot. Then open:

| Service              | URL                              |
| -------------------- | -------------------------------- |
| Web app              | http://localhost:3002            |
| API Swagger docs     | http://localhost:3001/docs       |
| MailHog (email inbox)| http://localhost:8025            |
| MinIO console        | http://localhost:9001            |

Host ports are configurable via env vars (`WEB_PORT`, `API_PORT`, `REDIS_PORT`,
`MINIO_PORT`, `MAILHOG_UI_PORT`, …) if the defaults are already taken on your
machine — set `APP_URL`/`CORS_ORIGINS` to match your web port in that case.

### Demo accounts (all password `Password123!`)

| Role               | Email                     | Tenant              |
| ------------------ | ------------------------- | ------------------- |
| Super admin        | `superadmin@creditos.dev` | Summit Credit       |
| Admin              | `admin@summit.test`       | Summit Credit       |
| Credit specialist  | `specialist@summit.test`  | Summit Credit       |
| Dispute specialist | `disputes@summit.test`    | Summit Credit       |
| Attorney           | `attorney@summit.test`    | Summit Credit       |
| Client             | `client@summit.test`      | Summit Credit       |
| Second agency      | `admin@northstar.test`    | Northstar Credit    |

Tenant isolation is verified by the seed: Summit and Northstar users can never
see each other's reports, disputes, or letters.

## Local development (no Docker for the apps)

```bash
npm install
docker compose up -d postgres redis minio mailhog   # infra only
npm run dev                                          # API :3001 + Web :3002 with watch
```

## AI provider

CreditOS talks to any OpenAI-compatible `/chat/completions` endpoint (OpenRouter,
your own proxy — e.g. a 9router-style gateway with your own models). Configure
on the API container:

```env
AI_PROVIDER=openrouter          # openrouter | openai | custom | local
AI_BASE_URL=https://openrouter.ai/api/v1
AI_API_KEY=sk-...               # empty → deterministic local engine
AI_MODEL=deepseek/deepseek-chat
```

With no key, a built-in deterministic engine performs the credit analysis
(duplicates, obsolete collections, SOL, late-payment inconsistencies, charge-off
errors, identity-theft flags), scores each finding with a confidence value, and
drafts letters from templates.

## Project structure

```
apps/
  api/    NestJS backend (modular monolith, DDD-flavored)
    prisma/   schema, migration, seed (2 tenants, all roles, sample report)
    src/      auth · users · tenants · reports · analysis · letters · disputes
              notifications · audit · dashboard · admin · queue (BullMQ) · health
  web/    Next.js 15 app router frontend
    app/      landing, auth pages, (app) shell: dashboard/reports/disputes/letters/admin/settings
    app/api/  BFF proxy — httpOnly tokens, transparent refresh rotation
    components/ui/  design system (glassmorphism, dark mode, skeletons, dialogs…)
infra/
  k8s/    Kubernetes manifests (namespace, config, postgres, redis, api, web, ingress)
.github/workflows/ci.yml   lint · typecheck · unit tests · builds on every PR
docs/    Architecture, API, operations, E2E scenarios
```

## Security & compliance (Phase 1 baseline)

- **RBAC** — six roles with a permission matrix; every endpoint guarded.
- **Multi-tenant isolation** — tenant resolved from JWT into AsyncLocalStorage;
  every query is tenant-scoped at the service layer.
- **Refresh-token rotation** — each refresh invalidates the prior token; logout
  and password changes revoke sessions; device/session listing.
- **2FA** — TOTP enrollment/verify/disable + enforcement at login.
- **Rate limiting**, structured JSON logs (pino), global exception filter,
  password hashing (bcrypt 12), reset tokens, audit trail on every mutation.
- **Compliance disclosures** on all client-facing report/dispute views (FCRA
  §1679c), configurable consent records.

## Roadmap (spec §phases)

1. **Phase 1 (this deliverable):** Foundation — auth/RBAC, tenancy, reports
   ingestion (CSV/PDF), AI analysis, letter generator + PDF, dispute rounds,
   admin/audit/settings, docker-compose, CI, k8s, docs.
2. **Phase 2:** Authorized data retrieval (Experian Connect et al.), bureau
   response reader, continuous monitoring, AI assistant chat.
3. **Phase 3:** Payments & billing (Stripe tiers), CRM, client portal, e-sign.
4. **Phase 4:** White-label per-tenant branding, marketing suite, workflow
   builder automation.

See `docs/` for architecture and deployment guides.
