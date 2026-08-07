# Operations Guide

## Stripe billing

Checkout runs through Stripe Checkout when `STRIPE_SECRET_KEY` is set and the
chosen plan has a Stripe Price ID; otherwise billing falls back to
local/simulated mode. Price IDs are wired up by the seed:

- Explicit overrides win: `STRIPE_PRICE_<CODE>` env vars, e.g.
  `STRIPE_PRICE_STARTER=price_...`, `STRIPE_PRICE_PROFESSIONAL=price_...`,
  `STRIPE_PRICE_BUSINESS=price_...`, `STRIPE_PRICE_ENTERPRISE=price_...`
  (consumer plans can use the same pattern, e.g. `STRIPE_PRICE_KICKSTART`).
- When a price ID is not provided but `STRIPE_SECRET_KEY` is set, the seed
  creates the product + monthly price in Stripe automatically (idempotent —
  it looks up products by the `creditos_plan_code` metadata and reuses them).
  Only billable business plans (monthly, non-custom) are auto-created;
  Enterprise (`Custom` pricing) and consumer plans are skipped.

`STRIPE_WEBHOOK_SECRET` must be configured for subscription lifecycle events
(`checkout.session.completed`, `customer.subscription.*`, `invoice.paid`) to
update local subscriptions; see `apps/api/src/billing/stripe.webhook.controller.ts`.

## Access gating (no free trials)

There are no free trials. A brand-new workspace has **no subscription**, so the
global `SubscriptionGateGuard` returns `402 Payment Required` on every core
endpoint (reports, pulls, analysis, letters, disputes, documents, dashboard,
CRM, user management) until the first plan is paid. Only `ACTIVE`
subscriptions pass; canceled/expired/past-due are blocked too. Auth, billing,
settings, notifications, public pages, and platform admin stay reachable.

- Stripe checkouts are created with `trial_period_days: 0` — the first payment
  is charged immediately.
- Client-role users of a blocked workspace see a lock screen (only the
  workspace admin can subscribe).

## Credit pulls (share codes)

Automatic report pulls use a consumer share code from the client's monitoring
account (SmartCredit / IdentityIQ flow) via a pluggable provider:

- `CREDIT_PULL_PROVIDER` — `simulated` (default, no credentials) |
  `smartcredit` | `identityiq`.
- `SMARTCREDIT_API_BASE_URL` / `SMARTCREDIT_API_KEY` and
  `IDENTITYIQ_API_BASE_URL` / `IDENTITYIQ_API_KEY` configure the real adapters;
  confirm the exact endpoint/payload against your provider agreement.
- `CREDIT_PULL_COST_CENTS` (default `1200`) is what each pull costs us and is
  passed through into plan pricing (see `apps/api/prisma/seed.ts`).
- `CREDIT_MONITORING_PRICE_CENTS` (default `2995`) is the resale price of the
  consumer Credit Monitoring plan — matched to the provider's price.
- Share codes are never stored; only a salted sha256 (`CREDIT_PULL_SHARE_SECRET`)
  is kept on the report. Each pull writes a `ReportPull` usage row with the
  cost for pass-through accounting.

## Backups (PostgreSQL)

Local (Docker): a nightly pg_dump job can be added with:

```bash
docker exec $(docker compose ps -q postgres) pg_dump -U creditos creditos | gzip > backup-$(date +%F).sql.gz
```

In-cluster (k8s), use a CronJob:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata: { name: pg-backup, namespace: creditos }
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: dump
              image: postgres:16-alpine
              command: ["/bin/sh", "-c", "pg_dump $DATABASE_URL | gzip > /backups/dump.sql.gz && mc cp /backups/dump.sql.gz myminio/creditos-backups/"]
              env:
                - { name: DATABASE_URL, value: "postgresql://creditos:...@postgres:5432/creditos?schema=public" }
```

## Monitoring & logs

- Structured JSON logs (pino). In dev they are pretty-printed.
- Health probes: `/health` (liveness), `/health/ready` (db, redis, S3).
- k8s readiness/liveness wired into the api/web deployments.
- Recommended additions: Prometheus `/metrics` exporter for Nest, OpenTelemetry
  tracing (spec §9 roadmap), Sentry for the web app.

## Releases

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests, production
builds, and Docker image builds on every PR. Promote images with tags, then:

```bash
kubectl set image deployment/api api=registry/creditos-api:1.x.y
kubectl set image deployment/web web=registry/creditos-web:1.x.y
kubectl rollout status deployment/api deployment/web
```

Run `prisma migrate deploy` before rolling out code that needs schema changes
(an init-container or a one-off job works).

## Scaling notes

- Stateless workloads: scale `api`/`web` horizontally behind the ingress.
- BullMQ workers run in-process with concurrency 3; extract them into a
  dedicated worker deployment when queue volume grows.
- Move to managed Postgres/Redis/S3 in production (see `infra/k8s/README.md`).
