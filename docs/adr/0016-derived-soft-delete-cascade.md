# 16. Derived Soft-Delete Cascade

Full feature spec: [Soft-Delete Cascade](../../.scratch/soft-delete-cascade/spec.md).

**Status:** Accepted

## Context

[ADR 0006](0006-soft-delete-by-default.md) made every table soft-deletable and every read filter
on `deleted_at`. It said nothing about children, and the gap showed: soft-deleting a record hid
that record and nothing else. A "deleted" order still returned its line items, its shipping
methods and its transactions; a "deleted" cart still returned its shipping methods.

The implicit contract was that each module service walks its own children by hand. Most never did.
Cart and fulfillment cascaded to nothing at all. Product did it correctly in one method and
partially in three others. Nothing noticed when a new child table was added and nobody updated the
service — coverage was a function of who reviewed the pull request.

The same information was already in the schema, stated once and enforced by the database. Every
one of these relationships declares `on delete cascade`, which is exactly the statement "this child
goes when its parent goes". A hard delete honours it. A soft delete ignored it and asked a human to
restate it in TypeScript.

## Decision

**The cascade is derived from the model, not declared per service.**

Each module passes its models barrel to its module definition. Bootstrap filters it to drizzle
tables, resolves the foreign keys in the inverse direction, and builds a `CascadeGraph` once per
module. `BaseRepository.softDelete` and `.restore` walk it. No service names its children, and a
new child table is covered the moment it declares its relationship.

Four consequences of that choice are themselves decisions:

- **One timestamp for the whole cascade.** The walker stamps a single value across every table it
  touches, which is what makes a cascade an identifiable *event*. Restore matches on that value, so
  a child hidden earlier for unrelated reasons keeps its own timestamp and is left alone. This is
  why `softDelete` takes `deletedAt` as a parameter: a per-call `new Date()` would put microseconds
  between five tables and restore could never match anything.
- **Restrict relationships are enforced by the walker too.** Before hiding a record, a live child
  referencing it through `on delete restrict` refuses the operation, mirroring what the database
  does on a hard delete. Product options keep their existing pre-check for its shopkeeper-facing
  wording; the walker is the backstop that cannot be forgotten.

  The schema restricts in exactly two places, both guarding a *globally shared* record against the
  scoped rows that use it: `product_product_option.option_id`, so an option cannot be deleted while
  a product offers it, and `product_variant_option.option_value_id`, so a value cannot be deleted
  while a variant is size M. Everything else cascades, because everything else is genuinely owned —
  a variant belongs to its product, a variant's option link belongs to its variant. Sharing is what
  makes deletion someone else's business to refuse.
- **A cascade child with no `deleted_at` is destroyed, not hidden.** The absence of the column is a
  deliberate statement that the table is destroy-only. Only password reset tokens are in this
  position: a retained token hash *is* the threat model, and restoring a spent credential has no
  legitimate meaning. `scripts/checks/standard-timestamps.ts` holds that exemption list, so the
  next such table is a decision someone makes rather than three characters someone omits.
- **The walker writes to tables directly**, not through repositories, because coverage must not
  depend on which tables happened to get one.

**Hard delete is untouched** and remains entirely the database's job. There is one implementation
of that behaviour and it is not ours.

**Scope is per module.** No foreign key crosses a module boundary, so a module-scoped graph is
already complete; a global one would cost the isolation [ADR 0001](0001-per-module-container-isolation.md)
buys for nothing. Cross-module cleanup stays the link layer's responsibility, per
[ADR 0004](0004-link-modules-for-cross-module-joins.md).

**Order and cart addresses are owned children.** They were the one relationship the walker could
not derive, because the pointer sat on the parent: the order held `shipping_address_id`, so nothing
removed the address when the order went — not the database on a hard delete, and not the service on
a soft one. Every discarded order left up to two rows behind forever.

The direction is inverted rather than given a cascade. Postgres cannot cascade forward: removing a
row never affects the row it points at, and adding `on delete cascade` to the parent's pointer
column reverses the meaning so that deleting the *address* deletes the *order*. Both were verified
empirically. The edit that looks like a one-line fix for the orphan is a data-loss bug, and it is
exactly the edit someone will reach for on seeing the pointer column — so the column went. Both
pointer columns are dropped, and the address now carries:

    orderId   — notNull, references order, on delete cascade
    type      — enum: 'shipping' | 'billing'
    liveUniqueIndex on (orderId, type)      -- partial: where deleted_at is null

`cart_address` has the identical shape against `cart`. The unique index leads with the parent id,
so it is also the index the cascade traverses. Being partial is what lets a type be filled again
after its address is soft-deleted, rather than the slot staying held by a row nobody can read.

**Customer address is deliberately left alone.** It keeps its `isDefaultShipping` /
`isDefaultBilling` booleans rather than adopting this enum, because one customer address can be
both defaults at once and an enum would force a duplicate row to say so. An order address is the
opposite: it is a snapshot, duplication is free, and each snapshot is of exactly one type.

## Consequences

A repository now needs its module's cascade graph to be constructed, which is a required
constructor dependency rather than an optional one. Bootstrap supplies it; the handful of places
that build a repository by hand — module service tests, the provider sync scripts, the link layer —
build the graph from the same barrel. Required rather than optional is the point: an omitted graph
would silently reinstate the defect this ADR exists to remove.

Two shapes the walker cannot follow now throw at build time rather than under-cascading silently: a
composite foreign key, and a reference to anything but the parent's primary key. The schema has
neither, and the throw is what keeps it that way.

Postgres reports both directions of a foreign-key violation under one code. The delete direction
now maps to `NOT_ALLOWED` (400) instead of `NOT_FOUND` (404) — reporting "the referenced row does
not exist" for a row that plainly does was simply wrong. `CONFLICT` (409) was considered and
rejected: 400 is what the product-option guard already threw and what Medusa uses for in-use-resource
deletes, so no live admin endpoint changes status code. The walker's restrict check raises the same
shape, so callers handle one contract regardless of origin.

The model barrel becomes load-bearing. A model the barrel does not re-export is invisible to the
graph: it keeps its foreign keys, keeps looking correct in review, and quietly stops being reached
by them. `scripts/checks/model-barrel-reachable.ts` makes that a build failure.

The address inversion diverges from Medusa, which places the pointer on the parent for cart, order
and fulfillment. Medusa contradicts itself there — its customer address is inverted, and of the
three that are not, cart and fulfillment cascade to their address while order does not, which is
the same defect described above. Our own schema was already split, with customer and fulfillment
inverted and order and cart not. Inverting the latter two makes all four consistent. The cost is
that order creation must precede address creation, so the creation payload accepts nested addresses
rather than identifiers, and one address can no longer serve as both the shipping and the billing
address — which matches what the checkout already does.

The address service surface follows the ownership: reads and writes name the parent, because no
caller holds an address id any more. Reads are `retrieveOrderAddress(orderId, type)` for one and
`listOrderAddresses` / `listCartAddresses` for a parent's pair; writes are
`createOrderAddress(orderId, type, data)` and `upsertCartAddress(cartId, type, data)`. A standalone
address with no parent is no longer expressible, which is the point. Update-by-id is gone with it:
`upsertCartAddress` already replaces a cart's address of a type in place, and an order's addresses
are a record of what was true at purchase time, so nothing should be editing one after the fact.

Soft delete is the exception, keeping the `softDeleteOrderAddresses(ids)` / `softDeleteCartAddresses(ids)`
shape every other module service uses — including `softDeleteCustomerAddresses`, on an address that
was already inverted before this ADR. Uniformity with twenty-odd sibling methods is worth more here
than local consistency with the address surface, and the cascade means no production caller reaches
for them anyway.

`retrieveOrderAddress` returns null rather than throwing, unlike `retrieveOrder` and the other
`retrieveX` methods — an order legitimately has no billing address, so absence is not an error. It
mirrors `retrieveFulfillmentAddress(fulfillmentId)`, the address that was already inverted before
this ADR. Cart has no single-address equivalent because both of its callers want the pair.
