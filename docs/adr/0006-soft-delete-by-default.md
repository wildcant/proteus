# 6. Soft-Delete by Default

**Status:** Accepted

## Context

When records are "deleted", we need to decide between hard deletion (row removed from the database) and soft deletion (row marked with a timestamp and filtered from queries).

Hard deletion is simpler — no ghost rows, no filter overhead, standard SQL. But it makes audit trails impossible, accidental deletions unrecoverable, and breaks referential integrity for cross-module references (Module B holds an ID that Module A hard-deleted).

In a modular system, hard deletion either violates FK constraints in link module join tables or — for plain-text cross-module columns within modules — creates dangling references with no recoverability.

## Decision

Every table has a `deleted_at` timestamp column (nullable, null = active). BaseRepository auto-filters `WHERE deleted_at IS NULL` on all find queries by default.

Modules expose three operations:
- `softDelete(ids)` — sets `deleted_at = now()`
- `restore(ids)` — clears `deleted_at`
- `delete(ids)` — true hard delete (for when you really mean it, e.g., GDPR purge)

The filter is applied at the repository level — services and API routes don't think about it.

### One verb per meaning on module services

Repositories keep all three operations, but a module service exposes only `softDeleteX`, so a call
site says which of the two happened without opening the implementation. Four operations keep the
destructive verb, for two distinct reasons:

- **File storage, payment methods and account holders** destroy the object at R2 or Stripe, where
  retention is not ours to control, so calling them soft would misdescribe what happened. The
  account-holder operation is a hybrid — it destroys at the provider *and* soft-deletes our local
  record.
- **Password reset tokens** are our own table, but a single-use bearer credential with no
  `deleted_at` column at all: a retained token hash *is* the threat model, and restoring a consumed
  credential has no legitimate meaning.

Hard delete stays reachable through the repository for the cases that genuinely need it — the
database performs the cascade, so there is exactly one implementation of that behaviour.

## Consequences

- Accidental deletions are recoverable
- Cross-module references remain resolvable (the row still exists)
- Audit/compliance use cases are supported out of the box
- Every query pays the cost of filtering on `deleted_at` (negligible with an index)
- Unique constraints must account for soft-deleted rows (partial unique indexes on `WHERE deleted_at IS NULL`)
- Storage grows over time — periodic hard-delete/archival may be needed for high-volume tables
