# CreditOS API

Interactive docs: **http://localhost:3001/docs** (Swagger/OpenAPI).

Base URL: `http://localhost:3001/v1` · Auth: `Authorization: Bearer <accessToken>`

## Endpoint map

| Area            | Method & path                                             | Notes                                  |
| --------------- | --------------------------------------------------------- | -------------------------------------- |
| Auth            | `POST /auth/register` `POST /auth/login` `POST /auth/refresh` `POST /auth/logout` | refresh rotates tokens |
|                 | `POST /auth/forgot-password` `POST /auth/reset-password` | signed, expiring links                 |
|                 | `GET /auth/me` `POST /auth/change-password` `GET /auth/sessions` |                                    |
| 2FA             | `POST /auth/totp/generate` `POST /auth/totp/verify` `POST /auth/totp/disable` | TOTP                       |
| Users           | `GET/PATCH /users/me` `GET /users` `POST /users` `PATCH /users/:id/role` `PATCH /users/:id/status` `GET /users/clients` | RBAC: viewClients/manageUsers |
| Tenants         | `GET/PATCH /tenants/me` `GET /tenants/me/feature-flags`   | branding, settings                     |
| Reports         | `GET /reports` `GET /reports/:id` `POST /reports` (multipart) `DELETE /reports/:id` `GET /reports/:id/download` | CSV/PDF, ≤25MB |
| Analysis        | `GET /analysis/reports/:id` `POST /analysis/reports/:id/run` `POST /analysis/reports/:id/run-local` `POST /analysis/letters/draft` | AI + local engine |
| Disputes        | `GET/POST /disputes` `GET/PATCH /disputes/:id` `POST /disputes/:id/rounds` `POST /disputes/:id/rounds/:round/response` `POST /disputes/:id/escalate` `GET /disputes/stats` | rounds 1–5 |
| Letters         | `GET/POST /letters/templates` `PATCH /letters/templates/:id` `GET /letters` `POST /letters/generate` `GET /letters/:id` `POST /letters/:id/versions` `POST /letters/:id/send` `GET /letters/:id/pdf` | version history |
| Notifications   | `GET /notifications` `GET /notifications/unread-count` `POST /notifications/read-all` `POST /notifications/:id/read` |                 |
| Dashboard       | `GET /dashboard/summary`                                  | role-aware aggregates                   |
| Audit           | `GET /audit`                                              | admins                                 |
| Admin           | `GET /admin/tenants` `GET /admin/stats`                   | super admin / admin                    |
| Pricing         | `GET /pricing/public`                                     | public catalog: business + consumer    |
|                 | `GET/POST /pricing` `PATCH/DELETE /pricing/:id`           | admin plan management                  |
| Billing         | `GET /billing/summary` `POST /billing/checkout` `POST /billing/cancel` | local payment mode (Stripe-ready) |
| CRM             | `GET /crm/pipeline` `GET/POST /crm/leads` `GET/PATCH /crm/leads/:id` `POST /crm/leads/:id/activities` | plan-gated (Business+) |
| Knowledge       | `GET /knowledge/articles` `GET /knowledge/categories` `GET /knowledge/articles/:slug` | public help center |
|                 | `POST /knowledge/articles` `PATCH /knowledge/articles/:id` | admin content management          |
| Contact         | `POST /contact` (public, throttled)                       | emails the support inbox               |
| Documents       | `GET/POST /documents` `GET /documents/:id/download` `DELETE /documents/:id` | S3, client-scoped |
| Health          | `GET /health` `GET /health/ready`                         | liveness / readiness (db+redis+s3)      |

## Error shape

```json
{ "statusCode": 401, "message": "Invalid or expired session", "path": "/v1/...", "timestamp": "…", "requestId": "…" }
```

Validation errors return `message` as an array of constraint messages.
