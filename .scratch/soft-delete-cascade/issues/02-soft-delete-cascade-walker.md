# 02 — Soft-delete cascade walker

**What to build:** Soft-deleting a record hides the children the schema already declares it owns,
instead of leaving them readable. Restoring it brings back exactly the children that same deletion
removed, and nothing that was deleted earlier for other reasons. A record still referenced through a
restrict relationship is refused rather than hidden. None of this is declared per service — it is
derived from the model, so a new child table is covered the moment it declares its relationship.

**Blocked by:** None — can start immediately. Ticket 01 is worth landing first so the walker
traverses indexed columns, but that is a performance concern, not a correctness gate.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Soft-deleting an order hides its line items, shipping methods and transactions; a subsequent read returns none of them
- [ ] Restoring that order brings all of them back
- [ ] A child soft-deleted *before* the cascade keeps its own deletion timestamp and is **not** restored alongside the parent
- [ ] The whole cascade stamps a single timestamp. This changes the existing soft-delete signature: today each repository call computes its own, so a five-table cascade would produce five values microseconds apart and restore could never match
- [ ] Soft-deleting a product option still offered by a product is refused with a not-allowed error naming the blocking relationship. The schema has exactly one restrict relationship, so the product module is the only place this can be exercised
- [ ] The existing product-option pre-check keeps its shopkeeper-facing wording; the walker is the backstop that cannot be forgotten
- [ ] The database's foreign-key violation code is split by direction: the delete direction reads `is still referenced from table "..."` and maps to a not-allowed error (400); the insert direction reads `is not present in table "..."` and keeps its existing not-found mapping
- [ ] Soft-deleting an auth identity **destroys** its password reset tokens rather than hiding them — that table has no soft-delete column, and the rule must hold at any depth, since tokens hang off provider identity as well
- [ ] A child reachable by two paths is handled once — product reaches variant images both through variants and through product images, so soft-deleting a product must not double-handle them. The walker also guards against cycles, though the schema has none today
- [ ] Hard delete is untouched and continues to be handled entirely by the database
- [ ] The walker reaches tables regardless of whether they have a repository
- [ ] Each module supplies its models barrel to its module definition; the inverse relationship index is built once at bootstrap and scoped per module
- [ ] The conventions job fails when a model is not reachable from its module's barrel, and when a table omits the standard timestamp columns without being on an explicit allowlist. These need drizzle's table metadata at runtime — reuse the TypeScript check runner from ticket 01 rather than inventing a second one
- [ ] Soft-deleting a fulfillment set cascades through service zones to geo zones — a two-hop chain that cascades to nothing today
- [ ] The cart module gains its first service-level test file, covering cart cascade directly rather than through workflow and API tests
- [ ] An ADR records the decision to derive the cascade rather than declare it per service, and the address-ownership decision that ticket 03 implements
- [ ] Full backend suite green; `npm run verify` green

## Notes

**The working tree may contain a half-built version of this ticket.** The order module service
currently carries a hand-rolled aggregate soft-delete that both its delete methods route through,
plus modified tests, left uncommitted from the investigation that produced this spec. It is
scaffolding, not target state — the walker supersedes it entirely. Delete it rather than building
around it.

Assertions must be able to fail. Test the observable outcome of a deletion — what a later read
returns — never that a particular repository method was called or how many statements were issued.
Mutate the walker and confirm each test bites.
