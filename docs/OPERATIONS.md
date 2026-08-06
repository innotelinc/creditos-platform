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

## Trial expiry

Every workspace starts with a `TRIAL_DAYS`-long trial. When a trial ends
without converting to a paid plan, the subscription is marked `EXPIRED`:

- A hourly sweep (`TrialExpiryService`) flips overdue `TRIALING` subscriptions
  to `EXPIRED` and emails + notifies the workspace admins, pointing them to
  the billing page.
- The same expiry runs lazily whenever an admin opens the billing page or the
  app shell checks `/billing/status`.
- Once `EXPIRED`, a global guard returns `402 Payment Required` on every core
  endpoint (reports, analysis, letters, disputes, documents, dashboard, CRM,
  user management) until a paid plan is chosen. Auth, billing, settings,
  notifications, public pages, and platform admin stay reachable.
- Client-role users of an expired workspace see a lock screen (only the
  workspace admin can re-subscribe).

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
