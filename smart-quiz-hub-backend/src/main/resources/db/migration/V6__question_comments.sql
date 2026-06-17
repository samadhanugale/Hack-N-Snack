-- V6: Review discussion thread — threaded comments on a question.
-- A simple flat thread of comments exchanged between a question's creator and its
-- reviewer/admins during the review lifecycle. author_id is nullable and
-- author_name/author_role are denormalized snapshots, so the thread survives user
-- deletion and reflects the author's role at the time the comment was written.
-- `author_role` is a plain VARCHAR (no enum/CHECK), matching the existing
-- convention for `status` on mcq_questions and `type` on notifications.

CREATE TABLE question_comments (
    id          BIGSERIAL    PRIMARY KEY,
    question_id BIGINT       NOT NULL REFERENCES mcq_questions(id) ON DELETE CASCADE,
    author_id   BIGINT       REFERENCES users(id),
    author_name VARCHAR(200) NOT NULL,
    author_role VARCHAR(50),
    body        TEXT         NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_question_comments_question ON question_comments (question_id, created_at);
