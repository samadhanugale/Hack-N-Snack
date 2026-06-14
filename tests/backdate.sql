-- ============================================================================
-- backdate.sql — spread timestamps so date-based features are demoable/testable.
--
-- The API sets created_at/updated_at via Hibernate @CreationTimestamp/@UpdateTimestamp
-- (always "now"), so seeded rows would all share today's date. This raw-SQL pass
-- backdates them deterministically across the last ~12 weeks, keeping a sensible
-- ordering: created_at < submitted_at < reviewed_at.
--
-- Run via:  docker compose exec -T postgres psql -U <user> -d <db> -f - < tests/backdate.sql
-- (seed-demo-data.sh does this for you.)
-- ============================================================================

-- Questions: spread creation over the last ~80 days (deterministic by id).
UPDATE mcq_questions
SET created_at = NOW()
    - (((id * 7 + 3) % 80) || ' days')::interval
    - ((id % 24) || ' hours')::interval;

-- Submitted ~1–5 days after creation (everything that left DRAFT).
UPDATE mcq_questions
SET submitted_at = created_at + ((1 + (id % 5)) || ' days')::interval
WHERE status <> 'DRAFT';

-- Reviewed ~1–7 days after submission (decided states) → varied turnaround.
UPDATE mcq_questions
SET reviewed_at = submitted_at + ((1 + (id % 7)) || ' days')::interval
WHERE status IN ('APPROVED', 'REJECTED', 'MODIFICATION_REQUESTED');

-- updated_at reflects the most recent lifecycle action.
UPDATE mcq_questions
SET updated_at = COALESCE(reviewed_at, submitted_at, created_at);

-- SMEs/users: vary join + update dates over the last ~120 days.
UPDATE users
SET created_at = NOW() - (((id * 13 + 9) % 120) || ' days')::interval,
    updated_at = NOW() - (((id * 5) % 30) || ' days')::interval
WHERE role = 'SME';

-- Quick summary so you can eyeball the spread.
SELECT status, COUNT(*) AS questions,
       MIN(created_at)::date AS earliest,
       MAX(created_at)::date AS latest
FROM mcq_questions GROUP BY status ORDER BY status;
