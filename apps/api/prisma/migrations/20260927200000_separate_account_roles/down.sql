-- Deliberately a no-op: which roles each account held before is recorded
-- nowhere but the audit log, and guessing them back could give a student a
-- staff role again. Undoing only removes the ledger row.
SELECT 1;
