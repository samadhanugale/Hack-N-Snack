-- ════════════════════════════════════════════════════
--  AI-generated questions
--  • ai_generated  — permanent identifier: this question was produced by the AI
--                    generator (drives the "AI" badge in the UI, kept forever).
--  • The new AI_PENDING lifecycle state (stored in the existing status VARCHAR,
--    no constraint change needed) quarantines freshly generated questions until
--    the creator explicitly accepts them into their drafts.
-- ════════════════════════════════════════════════════

ALTER TABLE mcq_questions
    ADD COLUMN ai_generated BOOLEAN NOT NULL DEFAULT FALSE;
