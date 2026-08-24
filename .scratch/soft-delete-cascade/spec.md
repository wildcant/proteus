# Soft-Delete Cascade

**Status:** ready-for-agent

## Problem Statement

Soft-deleting a record hides that record and nothing else. Its children stay fully readable, so a
"deleted" order still returns its line items, and a "deleted" cart still returns its shipping
methods. Each module service is expected to walk its own children by hand, and most never do —
cart and fulfillment cascade to nothing at all, while product does it correctly in one method.
There is no mechanism that notices when a new child table is added and nobody updates the service.

Three further defects share the same root:

- **Rolled-back checkouts leak addresses.** An order points at its addresses, so nothing removes
  them when the order goes — not the database on a hard delete, and not the service on a soft one.
  Every discarded order leaves up to two rows behind forever.
- **Two unique constraints ignore soft-deleted rows.** Deleting a user permanently burns their
  email address; deleting a customer's default billing address means they can never set a new one.
- **Cascade relationships are not consistently indexed**, so deleting a parent scans its children,
  and product and inventory indexes cannot serve the filtered reads the repository actually issues.

## Solution

Derive the cascade from the model instead of restating it in every service. Soft-deleting a record
hides the children the schema already declares it owns, and restore brings back exactly those
children and nothing else. Where the database can express the relationship, it does; where it
cannot, the schema is changed so it can.

A cascading soft delete becomes a single **event**, identified by its timestamp. Restore undoes that
event, so a child deleted earlier for unrelated reasons is not resurrected alongside it.

Order and cart addresses are re-modelled as owned children rather than shared entities the parent
points at, which lets the database enforce the ownership and removes the last relationship the
walker cannot derive.

Finally, the deletion verbs are made to mean one thing each, and the index audit closes the
correctness and traversal gaps that soft delete introduced.

## User Stories

1. As a backend developer, I want soft-deleting a record to hide its owned children too, so that a deleted order does not leave readable line items behind.
2. As a backend developer, I want the cascade derived from the model's declarations, so that I cannot forget to update a service when I add a child table.
3. As a backend developer, I want a new child table to be covered the moment it declares its relationship, so that coverage is not a function of who reviewed the pull request.
4. As a backend developer, I want restore to bring back exactly what the matching delete removed, so that undoing a deletion does not resurrect rows deleted earlier for other reasons.
5. As a backend developer, I want a soft delete refused when the record is still referenced by a restrict relationship, so that I cannot hide a product option that products still offer.
6. As a shopkeeper, I want a clear message when I try to delete an option still used by products, so that I know to remove it from those products first.
7. As a client developer, I want "still referenced" to produce the same error shape whether it came from the database or from an application check, so that I handle one case.
8. As an on-call engineer, I want a refused deletion to name the relationship that blocked it, so that I can act without reading the schema.
9. As a shopkeeper, I want to reuse the email address of a deleted user when creating a new one, so that staff turnover does not permanently burn addresses.
10. As a customer, I want to set a new default billing address after deleting the old one, so that my address book stays usable.
11. As a backend developer, I want deleting an order to remove its addresses, so that rolled-back checkouts stop accumulating orphan rows.
12. As a backend developer, I want each order to own a private copy of its addresses, so that changing or deleting one order can never affect another.
13. As a backend developer, I want that ownership enforced by the database, so that it cannot be bypassed by application code or forgotten by a new caller.
14. As a shopkeeper, I want an order's shipping and billing addresses preserved exactly as they were at purchase time, so that the order remains an accurate record.
15. As a backend developer, I want one verb per deletion meaning, so that I do not have to read an implementation to learn whether a call hides or destroys.
16. As a backend developer, I want the destructive verb reserved for cases where something genuinely ceases to exist, so that the word keeps its warning value.
17. As a security-conscious developer, I want password reset tokens destroyed rather than hidden when their identity is deleted, so that a disabled account's outstanding token cannot be used.
18. As a security-conscious developer, I want a consumed reset token to be unrecoverable, so that no restore path can bring a spent credential back.
19. As a backend developer, I want cascade relationships traversed through an index, so that deleting a parent does not scan every child row.
20. As a backend developer, I want the indexes to match the queries the repository actually issues, so that reads stay fast as soft-deleted rows accumulate.
21. As a backend developer, I want CI to fail when I add a cascade relationship without an index for it, so that the regression is caught before merge rather than in production.
22. As a backend developer, I want CI to fail when I add a unique index that ignores soft-deleted rows, so that I do not create a slot that can never be freed again.
23. As a backend developer, I want CI to fail when a model is not reachable from its module's barrel, so that the cascade can always see it.
24. As a developer reading a model, I want each index declared next to the columns it serves, so that I can see the physical consequences of the shape I am defining.
25. As a developer authoring an index on a soft-deletable table, I want the soft-delete predicate applied for me, so that omitting it is not possible by accident.
26. As a backend developer, I want a child reachable by two different paths to be handled once, so that a cascade over a diamond-shaped graph stays correct.
27. As a backend developer, I want hard delete to remain available and continue to be handled entirely by the database, so that there is exactly one implementation of that behaviour.
28. As a backend developer, I want cart deletion to hide its line items and shipping methods, so that cart cleanup behaves like order cleanup.
29. As a backend developer, I want an order's transactions hidden alongside the order, so that financial records do not outlive the record they belong to.
30. As a backend developer, I want a single written decision explaining why the cascade is derived rather than declared, so that nobody reintroduces a per-service list later.
31. As a backend developer, I want cross-module cleanup to remain the link layer's responsibility, so that module isolation is preserved.
32. As a backend developer, I want the walker to reach tables that have no repository, so that coverage does not depend on which tables happened to get one.

## Implementation Decisions

### Deletion vocabulary

Two verbs, one meaning each:

- **`deleteX`** — the thing genuinely ceases to exist. After this change it survives in exactly four
  places, for two distinct reasons:
  - **Three provider-facing operations** (file storage, payment methods, account holders). The object
    is destroyed at R2 or Stripe and retention there is not ours to control, so calling it soft would
    be a lie about what happened. Note that the account-holder operation is a *hybrid*: it destroys at
    the provider and then soft-deletes our local record. Both halves must survive the migration.
  - **Password reset tokens.** Our own table, but a single-use bearer credential with no soft-delete
    column at all. A retained token hash *is* the threat model, and restoring a consumed credential
    has no legitimate meaning. This is the one table-backed `deleteX` that is not renamed.
- **`softDeleteX`** — the record is hidden and cascades to its owned children.

Every other `deleteX` on a module service becomes `softDeleteX`, collapsing the pairs of synonyms
that exist today. No deprecation shims; the old names are removed outright.

### The cascade walker

Lives in the shared repository base and applies to `softDelete` and `restore` only. Hard delete is
left entirely to the database, which handles it natively once the address relationship is inverted.

- **Children are derived** from foreign keys declaring cascade-on-delete, resolved in the inverse
  direction. No per-table declaration and no opt-in list.
- **Restrict relationships are enforced.** Before hiding a record, if any live child references it
  through a restrict relationship, the operation is refused. This mirrors what the database does on
  a hard delete, so the declaration remains the single statement of intent.
- **One timestamp for the whole cascade.** The walker stamps a single value across every table it
  touches, which is what makes the event identifiable. This changes the existing soft-delete
  signature: today each repository call computes its own timestamp, so a five-table cascade would
  produce five values microseconds apart and restore-by-timestamp could never match. The walker
  computes it once and threads it down.
- **A cascade child with no soft-delete column is hard-deleted.** The absence of the column is a
  deliberate statement that the table is destroy-only; the cascade declaration still applies. Only
  password reset tokens are in this position, and destroying them is the required behaviour.
- **Diamond paths are de-duplicated** and cycles guarded, though the schema currently has neither
  cycles nor composite foreign keys. The deepest chains today are three tables, i.e. two hops.
  The column-less-child rule must hold at any depth, not only for direct children: password reset
  tokens hang off provider identity as well as off auth identity.
- **The walker writes to tables directly**, not through repositories, because coverage must not
  depend on whether a table happens to have one.

### Table registry

Each module passes its models barrel to its module definition. Bootstrap filters it to table
definitions, builds the inverse foreign-key index once, and injects it into the module's private
container. Scope is deliberately per-module: no foreign key crosses a module boundary today, so
module scope is complete, and a global registry would cost the isolation guarantee for nothing.

### Restore

Walks the same graph and restores only the children whose deletion timestamp matches the parent's.
A child deleted before the cascade keeps its own timestamp and is left alone.

### Address ownership

Order and cart addresses become owned children. The parent's two pointer columns are dropped; the
address gains a non-nullable parent reference with cascade-on-delete and a role discriminator, with
a partial unique index enforcing one address per role per parent:

    orderId   — notNull, references order, on delete cascade
    type      — enum: 'shipping' | 'billing'
    unique index on (orderId, type) where deletedAt is null

Consequences: order creation must precede address creation, so the order-creation payload accepts
nested addresses rather than identifiers; an address can no longer be shared between the shipping
and billing roles, which matches what the checkout already does; and a standalone address with no
parent becomes impossible, which is correct.

**Why the pointer direction cannot simply be given a cascade instead.** Postgres cannot cascade
forward. Removing a row never affects the row it points at — verified: deleting the order left its
address intact. Worse, adding cascade-on-delete to the parent's pointer column reverses the meaning:
deleting the *address* then deletes the *order* — also verified, the order row disappeared. So the
edit that looks like a one-line fix for the orphan is a data-loss bug, and it is exactly the edit
someone will reach for on seeing the pointer column. Inverting removes the possibility; until the
inversion lands, no cascade may be added to those pointer columns.

This is a deliberate divergence from Medusa, recorded in an ADR alongside the cascade decision.

### Error mapping

The database's foreign-key violation code is currently mapped as though it always means "the
referenced row is missing", which is only true when inserting. The delete direction is
distinguishable from the message detail — the delete direction reads `is still referenced from
table "..."` where the insert direction reads `is not present in table "..."` — and maps to
`NOT_ALLOWED` (400) instead. `CONFLICT` (409) was considered and rejected: 400 is what the existing
product-option guard already throws and what Medusa uses for in-use-resource deletes, so no live
admin endpoint changes status code. The walker's
restrict check raises the same error shape, so callers see one contract regardless of origin.
Product options keep their existing pre-check for its shopkeeper-facing wording; the walker is the
backstop that cannot be forgotten.

### Index audit

Three classes of fix:

1. **Correctness** — the unique constraint on user email and the two customer default-address unique
   indexes must exclude soft-deleted rows. The user constraint must move from an inline uniqueness
   declaration to a table-level partial index, since inline uniqueness cannot carry a predicate.
2. **Traversal** — the two cascade relationships from auth identity to its children are unindexed and
   must gain indexes, as the walker traverses them on every auth deletion.
3. **Consistency** — twenty non-unique indexes are unfiltered while the rest of the codebase filters
   on the soft-delete predicate. All become partial. The split is **product 14, inventory 5, and one
   on customer address** — that last one is easy to miss, because customer address also appears under
   (1) for a different fix and so reads as already handled. The two password-reset-token indexes
   correctly stay unfiltered, because that table has no such column.

   A partial index is only usable when the query carries the predicate; a read requesting deleted rows
   falls back to a sequential scan. That such reads are confined to tests today is what makes these
   conversions safe, and a future production path that reads deleted rows would need re-examining.

Two authoring helpers apply the soft-delete predicate automatically for filtered and unique indexes,
and the existing conventions job gains checks for: every model reachable from its barrel, every
table carrying the standard timestamp columns except an explicit allowlist, every cascade or restrict
relationship having a leading-column index, and every unique index on a soft-deletable table
carrying the predicate.

**Not adopted:** an automatic index on the soft-delete column itself. Medusa generates one for every
model; measured against a 200,000-row table it was never chosen by the planner for any query,
because it stores a single constant key for nearly every row. The useful inverse — indexing only the
deleted rows — is deferred until a purge job exists to query it.

## Testing Decisions

A good test here asserts the observable outcome of a deletion — what a subsequent read returns —
never the traversal itself. No test should assert that a particular repository method was called, or
how many statements the walker issued. Assertions must be able to fail: mutate the walker and
confirm the test bites.

Coverage rides on existing seams wherever one exists, and every test runs against real modules and a
real database, consistent with the established backend test infrastructure.

| Seam | Covers |
| --- | --- |
| Order module service tests | cascade to line items, shipping methods, transactions and addresses; restore restricted to the matching event |
| Product module service tests | diamond paths and three-table chains; restrict enforcement and its message — the schema has exactly one restrict relationship, so this is the only place it can be exercised |
| Auth module service tests | the column-less cascade child destroyed rather than hidden |
| User and customer module service tests | email reusable after deletion; default address replaceable after deletion |
| Cart API tests | the address shape after inversion |
| Fulfillment module service tests | cascade from fulfillment set through service zones to geo zones — a two-hop chain that cascades to nothing today |
| Conventions job | the index, barrel and timestamp rules — the check is the assertion |

One new seam: the cart module has no service-level test file at all today. It gains one, covering
cart cascade behaviour directly rather than through the workflow and API tests that currently carry
it by accident.

Prior art: the existing cascade test in the order module tests, the concurrency test in the cart API
tests, and the soft-delete assertions already present in the product module tests.

## Out of Scope

- **Cross-module cleanup.** Link tables remain the link layer's responsibility. No foreign key
  crosses a module boundary, so the walker never encounters them.
- **Customer address role flags.** They stay boolean, because a customer address can hold both
  default roles at once — an enum would force a duplicate row. Only their index predicates change.
- **A purge job and its supporting index.** Deferred until something needs to query deleted rows.
- **Cart completion idempotency and cart locking.** Tracked separately.
- **Backward compatibility.** The application is not deployed; no migration path, deprecation window
  or compatibility shim is required. Migrations are regenerated in place under their existing tags.

## Further Notes

The address inversion diverges from Medusa, which places the pointer on the parent for cart, order
and fulfillment. Medusa contradicts itself here: its customer address is inverted, and of the three
that are not, cart and fulfillment cascade to their address while order does not. That omission is
the same defect this spec fixes in our own order module. The pointer direction is empirically the
one where the cascade gets forgotten — three independent instances across two codebases — which is
the argument for removing the possibility rather than remembering harder.

Our own schema is already split: customer and fulfillment addresses are inverted, order and cart are
not. Inverting the latter two makes all four consistent.

The cart module recently lost three unused tables (credit lines and two tax-line tables). Its
migration, snapshot and journal have already been regenerated; only the live dev database still
holds the tables, which a cold re-migrate resolves.
