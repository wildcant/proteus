# 05 — Cascade walker: ordering and atomicity

**What to build:** Two confirmed bugs in the cascade walker stop being possible. Today a soft delete
can give a different answer depending on the order a models barrel happens to export its tables, and
a refused deletion can leave rows already hidden behind it. Both are fixed by checking everything
before writing anything, inside one transaction. Nothing about the product model changes here, so
this ships on its own.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] The walker builds the full set of rows it would touch, runs every restrict check against that pre-cascade state, and only then writes. Refusal no longer depends on which table the traversal reached first
- [ ] The deliberately failing test `refuse whichever of the pair the walker reaches first — blocker first` in `src/core/db/__tests__/cascade-walker.test.ts` turns green, and its `blocked table first` sibling stays green
- [ ] A refused cascade leaves nothing written. A test asserts the root is still live after a refusal, and another asserts the same for a refusal two hops down — both fail against the current implementation
- [ ] The walker wraps its work in `client.transaction()`. This is safe whether it was handed the pool or an open transaction, because drizzle-postgres-js nests via `SAVEPOINT` — verify rather than assume
- [ ] Callers that reach a repository without a transaction (workflow compensation steps, `link-service.dismissLinks`, two `payment-module-service` methods) are covered by the walker's own transaction rather than needing to change
- [ ] The event timestamp comes from `clock_timestamp()` and is carried as an opaque `text` value. It must never become a JS `Date`: `timestamptz` is microsecond-precision, `Date` is millisecond, and a round trip makes `eq(stored, jsDate)` return false. `restoreCascade` matches with `deleted_at = $1::timestamptz`, `groupByDeletion` groups on the string, and `BaseRepository.softDelete` stops calling `new Date()`
- [ ] Two soft deletes in the same millisecond stay distinct events; a test covers it and fails if the timestamp goes back to `new Date()`
- [ ] `buildCascadeGraph` follows a composite foreign key by traversing the column paired with the parent's primary key, and still throws when zero or more than one referenced column is a primary key. Needed before ticket 06 can boot
- [ ] `ownedChildrenOf` and `blockersOf` return frozen arrays on a hit as well as a miss, so the `readonly` contract the code claims is true
- [ ] A conventions check **warns** — not fails — when one cascade closure contains both a guard and the table it guards. `Check` gains `severity?: 'error' | 'warning'` defaulting to `'error'`; opt out through an `ALLOWED` map keyed by guard relationship with a required reason, mirroring `EXEMPT` in `standard-timestamps.ts`
- [ ] A conventions check rejects a soft-deletable child of a destroy-only table — the walker stops descending after a hard delete, so Postgres would remove it outright
- [ ] Restoring a row whose unique slot was refilled produces a restore-aware error rather than a bare "already exists"
- [ ] `docs/soft-delete-cascade.md` gains the vocabulary (owner, owned child, guard, guarded table, cascade closure, overlap), replaces its "Known issue" section with the resolution, updates the walk diagram to the three phases, and records the ~65k id ceiling from Postgres's bind-parameter limit
- [ ] Full backend suite green; `npm run verify` green

## Out of scope, and why

- **`inArray` chunking / `= ANY(array)`.** A single cascade cannot exceed roughly 65,000 rows per
  table before hitting Postgres's bind-parameter cap (measured: an IN-list of 100k ids fails with
  `Max number of parameters (65534) exceeded`, while `= ANY(array)` passes as one parameter). No
  path comes close. Note the bound in the docs; revisit if a bulk or purge path appears.
- **Property-based testing over random DAGs.** The fixture schema in `cascade-walker.test.ts` is
  most of a harness for it — generate a DAG, compute the closure independently in TypeScript, assert
  the walker agrees, and that delete-then-restore is identity. Worth doing, not now.
- **Moving the cascade into PL/pgSQL or triggers.** Postgres cannot plan a soft delete: it never
  reports which rows it cascaded, so `DELETE … RETURNING` gives only the target table. Any
  database-side version reimplements the walk in another language.
- **`expectNoLiveOrphans(db)`**, a mechanical invariant asserting no live child of a hidden parent
  for every cascade edge. Cheap and broad, but it belongs with the property test.

## Decisions this ticket does not make

- **`getClient_(context): any`** at `base-repository.ts:46` is what feeds the walker. This ticket
  types the walker's own client but leaves the `any` at the seam supplying it. Pre-existing, and
  fixing it means typing nine call sites in `BaseRepository` — a separate piece of work, but it
  means the walker's new types are only as good as its own body.
- **`softDeletePaymentSession`** (`core/types/payment/service.ts:57`) destroys the session at Stripe
  and then soft-deletes locally, so the name promises a reversibility it cannot deliver. The spec
  treats the account-holder equivalent as a hybrid that keeps the destructive verb. Rename to
  `deletePaymentSession` — body unchanged — or record why it differs.

## Notes

**The working tree already holds part of this ticket, uncommitted.**
`src/core/db/__tests__/cascade-graph.test.ts`, `src/core/db/__tests__/cascade-walker.test.ts` and
`docs/soft-delete-cascade.md` are untracked. The walker tests include the deliberately failing
`blocker first` case this ticket turns green — they are target state, not scaffolding, unlike the
half-built work ticket 02 warned about. Commit them before starting so the red test is visible in
history rather than appearing to have never existed.

The ordering bug was reproduced by reordering two lines in a models barrel: with the guarded table
exported first the deletion is refused, with the guard first it succeeds and destroys the guarded
row. The half-applied bug was reproduced by asserting the root is still live after a refusal — it
is not.

Plan-then-apply makes the id lists larger than they are today, since each table is written once
with every id rather than in per-frontier batches. Still far from the bind-parameter ceiling noted
above, but it is the change that moves us toward it.

The `Handled` dedupe guard cannot be distinguished behaviourally — `liveChildIds` already filters
hidden children and `hideOrDestroy` filters with `isNull`, so re-reaching a row is a no-op. It is
redundancy avoidance, not a correctness guard, whatever its comment implies. Do not write a test for
it that would pass by construction.
