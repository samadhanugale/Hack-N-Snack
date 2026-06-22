-- V7: Drop FK on audit_logs.question_id
-- AuditServiceImpl.record() runs in REQUIRES_NEW (a separate DB connection), so it
-- cannot see the question row that was saved-but-not-yet-committed in the outer
-- transaction. The FK check fails, the inner transaction is marked rollback-only,
-- and Spring's TransactionInterceptor rethrows UnexpectedRollbackException even
-- though the exception was caught in the try/catch — poisoning the outer transaction.
--
-- Audit logs are an append-only record; referential integrity is not required.
-- The question_id column is kept as a plain BIGINT reference (no FK), which lets
-- the REQUIRES_NEW insert succeed before the outer transaction commits.
-- Orphaned rows for deleted questions are intentionally preserved as history.

ALTER TABLE audit_logs DROP CONSTRAINT audit_logs_question_id_fkey;
