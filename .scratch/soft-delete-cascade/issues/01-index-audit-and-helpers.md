# 01 — Index audit and authoring helpers

**What to build:** Two behaviours that are broken today start working — a shopkeeper can reuse the
email address of a deleted user when creating a new one, and a customer can set a new default
billing or shipping address after deleting the old one. Alongside those fixes, every index in the
codebase becomes consistent about excluding soft-deleted rows, the relationships the cascade will
traverse gain the indexes they need, and CI starts rejecting new indexes that get this wrong.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Every index converted or added by this ticket is declared through a helper that applies the soft-delete predicate automatically; a predicate-less index on a soft-deletable table is rejected by the conventions job, so omitting it is not possible by accident
- [ ] Creating a user with the email of a previously deleted user succeeds; a test covers it and fails if the fix is reverted
- [ ] Setting a new default billing address after deleting the old one succeeds, and likewise for shipping; tests cover both
- [ ] The uniqueness rule on user email is expressed as a table-level partial index — an inline uniqueness declaration cannot carry a predicate, so it must move
- [ ] The two cascade relationships from auth identity to its children each have an index with the foreign-key column leading
- [ ] The twenty unfiltered non-unique indexes are converted to partial: **product 14, inventory 5, and one on customer address**. The customer-address one is easy to miss because that table also appears in the correctness fixes above and so reads as already handled
- [ ] The two password-reset-token indexes remain unfiltered — that table has no soft-delete column, so a plain index is correct there
- [ ] A TypeScript check runner is introduced for the conventions job. The three existing checks are pure bash/grep, but these rules need drizzle's table metadata at runtime — foreign-key relationships and index column order are not greppable. Ticket 02 adds two more checks and will reuse this runner
- [ ] The conventions job fails when a unique index on a soft-deletable table omits the soft-delete predicate
- [ ] The conventions job fails when a cascade or restrict relationship has no leading-column index
- [ ] Affected migrations are regenerated in place under their existing tags, per the project convention
- [ ] Full backend suite green; `npm run verify` green

## Notes

This ticket and 02 both extend the conventions job. If they are worked concurrently they will
conflict there mechanically — not a correctness problem, but coordinate or sequence them.

An index on the soft-delete column itself was considered and rejected — measured against a
200,000-row table the planner never chose it, because it stores one constant key for nearly every
row. The useful inverse (indexing only deleted rows) is deferred until a purge job exists.

A partial index is only usable when the query carries the predicate. Reads that request deleted rows
fall back to a sequential scan; those are confined to tests today, which is what makes these
conversions safe.
