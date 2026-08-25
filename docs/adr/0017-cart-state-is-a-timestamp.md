# 17. Cart State Is a Timestamp

**Status:** Accepted

## Context

`cart` carried a `status` enum of `active` / `completed` / `abandoned` alongside a `completed_at`
timestamp. Two columns, one fact.

Nothing ever wrote one without the other. The only writer was `complete-cart`, which set
`{ status: 'completed', completedAt: new Date() }` on success and `{ status: 'active',
completedAt: null }` on compensation — both fields, same statement, every time. `abandoned` was
never written at all: a third of the enum was decoration.

Readers had already drifted, with no consequence, because the two columns could not disagree:

- `create-payment-collection-for-cart` guarded on `completedAt`
- three `CartModuleService` methods guarded on `status !== 'active'`
- `update-cart` guarded on **both**, in consecutive blocks

That last one is the diagnosis. Someone wrote two guards for one condition and neither read as
redundant, because nothing in the schema said they were the same question.

The duplication was not merely untidy — it could drift, and in the fixtures it already had.
`tests/factories/db/cart.ts` picked a random status while hardcoding `completedAt: null`, so it
could mint a cart that was `'completed'` but not completed. Nothing depended on it, but the trap
sat in the factory every test used.

## Decision

**`cart.status` is removed. A cart's state is `completedAt`, and `deletedAt` from
[ADR 0006](0006-soft-delete-by-default.md).**

    completed_at IS NULL AND deleted_at IS NULL   -- still being shopped
    completed_at IS NOT NULL                      -- became an order

The three service guards collapse onto one private `assertNotCompleted`, `update-cart` keeps the
`completedAt` half of its double guard, and `set-product-options` — the one place that genuinely
filtered carts by state — selects live carts with `completedAt: null`, which `buildFilters`
compiles to `IS NULL`.

The error message improves as a side effect: `Cart X is already completed` rather than
`Cart X is not active (current status: completed)`.

**This matches Medusa v2**, which dropped v1's cart status notions entirely and derives the same
state from `completed_at`. Independent arrival at the same shape, rather than parity for its own
sake — the argument above stands on our schema alone.

**Abandonment, if it is ever modelled, is `abandonedAt`, not a resurrected enum value.** Anything
that acts on an abandoned cart — a recovery email, a prune job — needs to know *when*, which a
status value cannot answer. That is the pattern already everywhere in this schema: `completedAt`,
`canceledAt`, `deletedAt`. A nullable timestamp means "this terminal state, and when it happened".
Cheaper still, and enough until something needs to track who has been emailed: derive it from
`completed_at IS NULL AND updated_at < now() - interval`.

**`order.status` stays.** The reasoning here does not transfer. `pending` / `completed` /
`canceled` / `archived` is not derivable — `pending` and `archived` have no timestamp behind them —
and it runs on a separate axis from `fulfillmentStatus`. That enum carries information. Cart's did
not.

## Consequences

`CartDTO`, `UpdateCartDTO`, `FilterableCartProps` and `StoreCart` all lose `status`; the generated
clients are regenerated. It is a wire break, accepted because nothing is deployed and no
compatibility shim is required.

`FilterableCartProps` gains `completedAt`, which is what a caller now narrows on. Filtering by a
state that no longer exists is a type error rather than a query that silently matches nothing.

A future "one active cart per customer" constraint expresses itself as a partial unique index
predicated on `completed_at IS NULL` rather than on a status value. That work needs cart merging
and a stale-cart lifecycle first — a constraint is a backstop for a race already handled, not a
mechanism for implementing a policy.
