# Tests / demo data

Curl-based scripts to populate the Smart Quiz Hub with realistic demo data so you can
exercise every feature (lifecycle states, reviews, multi-correct MCQs, analytics,
date-range filters, SME reports) without writing DB migrations.

## What it creates

`seed-demo-data.sh`:
1. Logs in as the admin.
2. Creates **5 SMEs** (`sme.aarav`, `sme.diya`, `sme.kabir`, `sme.isha`, `sme.rohan`) with
   stack assignments. Password: `Sme@12345`.
3. Creates **24 questions** — 4 in each lifecycle state:
   `DRAFT`, `READY_FOR_REVIEW`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `MODIFICATION_REQUESTED`
   — a mix of **single-** and **multiple-correct** options, varied difficulty and stacks,
   authored and reviewed by **different** SMEs.
4. Runs `backdate.sql` so `created_at` / `submitted_at` / `reviewed_at` / `updated_at`
   (and SME join dates) are **spread across the last ~12 weeks** — making the weekly trend,
   date-range analytics and review-turnaround metrics meaningful.

## Run it

From the repo root, with the stack running (`docker compose up`):

```bash
bash tests/seed-demo-data.sh
```

Override anything via env vars (defaults shown):

```bash
API_BASE=http://localhost:8080/api \
ADMIN_ENTERPRISE_ID=admin.user ADMIN_PASSWORD=Admin@123 \
SME_PASSWORD=Sme@12345 BACKDATE=1 \
DB_USER=postgres DB_NAME=smart_quiz_hub \
bash tests/seed-demo-data.sh
```

- Re-running is safe: existing SMEs are reused (HTTP 409 is ignored). It will add another
  batch of questions each run.
- Set `BACKDATE=0` to skip the date-spreading step.

## Backdate only

If you only want to re-spread dates (e.g. after manual edits):

```bash
docker compose exec -T postgres psql -U postgres -d smart_quiz_hub -f - < tests/backdate.sql
```

## Notes

- Timestamps are normally set by the server (`@CreationTimestamp`/`@UpdateTimestamp`),
  so date variety can only come from the raw-SQL `backdate.sql` pass — that's why it exists.
- Question stems are intentionally distinct so the AI duplicate-check doesn't block submission.
