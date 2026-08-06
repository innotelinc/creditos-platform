# Operations Guide

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
