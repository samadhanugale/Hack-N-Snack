-- V8: Review SLA engine (reminder + escalation tracking)
-- The ReviewSlaScheduler reminds reviewers about stale UNDER_REVIEW assignments and
-- escalates very-overdue ones to admins. These columns track the SLA clock per question:
--   assigned_at       — when the current reviewer assignment started (resets the clock)
--   reminder_sent_at  — when the reviewer reminder was sent (null = not yet reminded)
--   escalated_at      — when the admin escalation was sent (null = not yet escalated)

ALTER TABLE mcq_questions
    ADD COLUMN assigned_at      TIMESTAMPTZ,
    ADD COLUMN reminder_sent_at TIMESTAMPTZ,
    ADD COLUMN escalated_at     TIMESTAMPTZ;

-- Backfill existing in-flight assignments so the scheduler has a baseline to measure from.
-- updated_at approximates when the reviewer was last assigned for already-assigned rows.
UPDATE mcq_questions
SET assigned_at = updated_at
WHERE status = 'UNDER_REVIEW' AND reviewer_id IS NOT NULL;

-- Speeds up the scheduler's periodic scan for UNDER_REVIEW questions with a non-null clock.
CREATE INDEX IF NOT EXISTS idx_mcq_status_assigned_at ON mcq_questions (status, assigned_at);
