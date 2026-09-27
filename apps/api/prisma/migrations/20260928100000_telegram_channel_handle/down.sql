-- Deliberately a no-op: the old handle no longer points at the channel, so
-- restoring it would only bring back dead links. Undoing removes the ledger row.
SELECT 1;
