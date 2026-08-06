# CreditOS Architecture

## System overview

```
                        ┌──────────────────────────────────────────────┐
                        │                   Browser                    │
                        └──────────────────────┬───────────────────────┘
                                               │ HTTPS
                        ┌──────────────────────▼───────────────────────┐
                        │            Next.js 15 (apps/web)              │
                        │  BFF route handlers: httpOnly cookies,       │
                        │  transparent access-token refresh rotation   │
                        └──────────────────────┬───────────────────────┘
                                               │ /v1/*  (Bearer token)
                        ┌──────────────────────▼───────────────────────┐
                        │            NestJS 11 (apps/api)               │
                        │  Global: JwtAuthGuard → Tenancy(ALS) →       │
                        │  RolesGuard → PermissionsGuard → Throttler   │
                        ├──────────────────────────────────────────────┤
                        │ auth · users · tenants · reports · analysis  │
                        │ letters · disputes · notifications · audit   │
                        │ dashboard · admin · health                   │
                        ├──────────────────────────────────────────────┤
                        │ BullMQ workers: analysis · email             │
                        └───┬──────────┬──────────┬──────────┬─────────┘
                            │          │          │          │
                    ┌───────▼──┐  ┌────▼────┐ ┌───▼────┐ ┌───▼────────┐
                    │PostgreSQL│  │ Redis   │ │ MinIO  │ │ SMTP       │
                    │ (Prisma) │  │(BullMQ) │ │ (S3)   │ │(MailHog)   │
                    └──────────┘  └─────────┘ └────────┘ └────────────┘
```

## Modular monolith (DDD-flavored)

Each domain is a self-contained NestJS module with controller → service →
repository (Prisma) layering. Domains communicate through services and the
global audit/queue modules — the seams are designed so that any domain
(analysis, notifications, documents) can be extracted into a microservice
later without restructuring the app.

## Multi-tenant isolation

1. `JwtStrategy.validate()` returns `AuthUser { id, email, role, tenantId, isSuperAdmin }`.
2. `JwtAuthGuard.handleRequest()` enters the context into
   `TenancyService` (AsyncLocalStorage via `enterWith`).
3. Every service reads `this.tenancy.getTenantId()` and scopes its Prisma
   queries — a client can never address another tenant's resources even with
   a valid token.
4. `SUPER_ADMIN` bypasses role checks (cross-tenant platform operations live
   under `/v1/admin` and are guarded by the `superAdmin` permission).

## RBAC matrix

| Capability            | CLIENT | CREDIT/DISPUTE SPEC | ATTORNEY | ADMIN | SUPER_ADMIN |
| --------------------- | :----: | :-----------------: | :------: | :---: | :---------: |
| View own data        |  ✅    |         ✅          |    ✅    |  ✅   |     ✅      |
| Manage clients/reports|        |         ✅          |          |  ✅   |     ✅      |
| Manage disputes/letters|      |         ✅          |          |  ✅   |     ✅      |
| View audit / manage tenant|  |                      |          |  ✅   |     ✅      |
| Platform-wide ops     |        |                      |          |       |     ✅      |

## AI provider abstraction

`AiProvider` (interface) → `OpenRouterProvider` (OpenAI-compatible
`chat/completions` via fetch, JSON-mode for structured analysis) and
`LocalEngine` (deterministic heuristics). `AiProviderFactory` selects by
`AI_PROVIDER`; the remote provider falls back to the local engine on any
error or when `AI_API_KEY` is empty — the pipeline never breaks.

## Ingestion pipeline

```
Upload (CSV/PDF, ≤25MB) → S3 (MinIO) → parse (heuristic, bureau-tolerant)
→ persist tradelines/inquiries/scores → enqueue analysis (BullMQ)
→ worker: provider.analyzeReport() → findings + strategy + score estimate
→ status ANALYZED → client notification → audit log
```

## Auth & session flow

- Access token (15 min, JWT) in an httpOnly cookie set by the Next.js BFF.
- Refresh token (30 d, hashed at rest) rotates on every use; a 401 from the
  API triggers one transparent refresh+retry inside the BFF proxy.
- Password reset uses signed, expiring tokens emailed via SMTP (MailHog local).
- 2FA (TOTP) enforced at login when enabled.
