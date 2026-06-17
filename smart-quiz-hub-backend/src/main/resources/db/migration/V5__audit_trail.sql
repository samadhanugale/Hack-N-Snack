-- V5: Audit trail — "who changed what, when"
-- Records a row per mutation on an MCQ question (created, updated, submitted,
-- assigned, approved, rejected, modification requested, deleted) so the full
-- lifecycle history can be shown in the question detail dialog and the admin view.
-- performed_by is nullable and performed_by_name is a denormalized snapshot, so
-- history survives user deletion. `action` is a plain VARCHAR (no enum/CHECK),
-- matching the existing convention for `status` on mcq_questions.

CREATE TABLE audit_logs (
    id                BIGSERIAL    PRIMARY KEY,
    question_id       BIGINT       REFERENCES mcq_questions(id) ON DELETE CASCADE,
    action            VARCHAR(50)  NOT NULL,
    performed_by      BIGINT       REFERENCES users(id),
    performed_by_name VARCHAR(200),
    details           TEXT,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_question_id ON audit_logs (question_id);
CREATE INDEX idx_audit_created_at  ON audit_logs (created_at);
