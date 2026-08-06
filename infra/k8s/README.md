# Kubernetes manifests

Kubernetes-ready manifests for the CreditOS stack (modular monolith, split into
two stateless workloads + managed data services).

## Apply order

```bash
kubectl apply -f infra/k8s/namespace.yaml
kubectl apply -f infra/k8s/configmap.yaml
kubectl apply -f infra/k8s/postgres.yaml        # or use a managed Postgres (recommended)
kubectl apply -f infra/k8s/redis.yaml           # or use a managed Redis (recommended)
kubectl apply -f infra/k8s/api.yaml
kubectl apply -f infra/k8s/web.yaml
kubectl apply -f infra/k8s/ingress.yaml
```

## Production notes

- **Use managed services** (RDS/Aurora, ElastiCache, S3 + MinIO-compatible or
  native S3) instead of in-cluster Postgres/Redis for production workloads.
- Secrets (`DATABASE_URL`, JWT secrets, AI keys) should live in a Kubernetes
  `Secret`, not the ConfigMap. Update `api.yaml` to reference it.
- Set `RUN_SEED=false` in production; run `prisma migrate deploy` as a
  pre-deploy job instead of inside the pod.
- HPA: `kubectl autoscale deployment api --cpu-percent=70 --min=2 --max=10`
- Backups: see `docs/operations.md` for pg_dump cron guidance.
