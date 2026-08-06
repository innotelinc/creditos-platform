# E2E Tests (Playwright)

A committed Playwright smoke suite lives in `e2e/` at the repo root and runs
against the full `docker compose up` stack — the web app on `:8080` (BFF proxy
at `/api`) with the API on `:3001`.

## Running locally

```bash
# 1. Start the stack (seeds Summit Credit + Northstar demo agencies)
docker compose up -d --build

# 2. Install the browser (one-time)
npx playwright install chromium

# 3. Run the suite
npm run test:e2e
```

Set `E2E_BASE_URL` to point at a different web origin
(e.g. `http://localhost:3000` in CI, where compose uses default ports).

## Suite coverage (`e2e/`)

| Spec | Coverage |
| --- | --- |
| `landing.spec.ts` | Public marketing page renders hero + auth links; login page + demo hint |
| `auth.spec.ts` | Unauthenticated redirect to `/login?next=`; invalid credentials toast; specialist dashboard (staff, no Admin nav); admin console; navigation across Reports/Disputes/Letters/Settings; sign-out re-protects routes |
| `portal.spec.ts` | Client sees only client nav + compliance disclosure (§7.2) on dashboard/reports/disputes; **API-level isolation checks through the BFF**: client cannot read another client's report/analysis/letters/disputes (404) and own list responses are client-scoped |
| `marketing.spec.ts` | `/pricing` shows both business and consumer plan models (tab switch); `/features` + `/about`; knowledge base lists seeded articles and opens one; `/contact` form submits |
| `modules.spec.ts` | Admin `/billing` (current plan, invoices, entitlements); specialist `/crm` pipeline with seeded leads across all six stages; client `/documents` (with compliance disclosure) |

Seed accounts used: `specialist@summit.test`, `admin@summit.test`,
`client@summit.test` (password `Password123!`).

## CI

`.github/workflows/ci.yml` runs the suite in the `e2e` job after `build`:

1. `docker compose up -d --build` (fresh stack, default ports)
2. Waits for `http://localhost:3001/health/ready`
3. `npx playwright install --with-deps chromium`
4. `npm run test:e2e` with `E2E_BASE_URL=http://localhost:3000`
5. Failed runs upload the Playwright report as a CI artifact

## Notes

- The suite is intentionally a smoke layer on top of the curl-based BFF
  verification (auth, RBAC, tenant + client isolation, upload → AI analysis,
  letters + PDF, dispute rounds) — see `docs/API.md` for those flows.
- Tests mutate data (e.g. uploading reports, generating letters); run them
  against a disposable stack, never production.
