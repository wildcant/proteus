# 06 — Layered product option schema and its rules

**What to build:** A variant stops pointing at the *global* option value and points at the
**product** value instead. That one pivot fixes two deletion rules that silently do the wrong thing
today, makes "a variant using an option its product does not offer" impossible to represent rather
than merely discouraged, and removes the cascade ordering ambiguity by construction — guards end up
pointing only upward across the layer boundary, so no cascade can contain both a guard and the row
it guards. The three integrity rules no foreign key can express stay in TypeScript, by decision:
the alternative is SQL functions and triggers nobody wants to maintain.

The schema change and the service change are one ticket because they cannot be separated — the
moment `product_variant_option` changes columns, `replaceVariantOptionValues` and every resolver
keyed on `optionId`/`optionValueId` stop compiling.

**Blocked by:** 05 — the schema uses composite foreign keys, which `buildCascadeGraph` rejects until
that ticket teaches it to follow them.

**Status:** ready-for-agent

## The rules

Five tables: **global option** (`product_option`), **global value** (`product_option_value`),
**product option** (`product_product_option`), **product value**
(`product_product_option_value`), **variant value** (`product_variant_option`).

| | Deletion rule |
| --- | --- |
| D1 | delete global option → refused while any product offers it |
| D2 | delete global value → refused while any product offers it |
| D3 | delete product option → cascades to product values and variant values |
| D4 | delete product value → cascades to variant values |
| D5 | delete variant → global and product layers untouched |
| D6 | delete product → product layer deleted, global layer untouched |

| | Integrity rule | Enforced by | Today |
| --- | --- | --- | --- |
| I1 | one value per option per variant | `UNIQUE (variant_id, product_product_option_id)` + composite FK | database index only; the DTO shape makes it unrepresentable anyway |
| I2 | combination unique per product | service | enforced on variant writes (`product-module-service.ts:1024, 1031, 1060, 1080`) and on option change by `planVariantReconciliation`, which *removes* collapsed variants (`reconcile-variants.ts:131`). Not enforced on deletion paths |
| I3 | no partial combination — a variant valued for one of its product's options is valued for all of them | service | enforced on variant **create** (`:1016`, `:1137`) only |
| I4 | a product option offers at least one value | service | nowhere — and it contradicts a live behaviour |
| I5 | a variant only uses options its own product offers | composite FKs on `(*, product_id)` | nothing prevents it today |

Every rule was proven against Postgres 17 in
`~/.dbclient/query/…@sandbox/New_Query_1787594132263.sql`. Part A of that script demonstrates
today's schema failing D3, D4 and I5; Part B is the target schema passing all eleven.

Two existing pre-checks are good and stay: `softDeleteProductOptions` refuses an option a product
still offers (`:450-457`), and `replaceOptionValues` refuses a value products still use
(`:1275-1286`).

## Acceptance criteria — schema

- [ ] `product_variant_option` references the **product value**, not the global value: its `option_id` and `option_value_id` columns are replaced by `product_id`, `product_product_option_id` and `product_product_option_value_id`
- [ ] `product_product_option_value.option_value_id` becomes `restrict` — a product offering a value is what guards the global value
- [ ] `UNIQUE (variant_id, product_product_option_id)` enforces I1, and a composite FK `(product_product_option_value_id, product_product_option_id) → product_product_option_value (id, product_product_option_id)` stops the denormalised option from drifting from the value it accompanies. Today nothing ties the two together and the column can silently disagree
- [ ] Composite FKs `(variant_id, product_id)` and `(product_product_option_id, product_id)` enforce I5, so a variant of one product cannot use another product's option. A test proves the insert is refused
- [ ] **No abbreviated identifiers.** No `ppo`, `ppov` or `ov` in a column, index, variable or type name — the repository's naming convention has no exception for schema work. Index names that would exceed Postgres's 63-byte identifier limit are named after the rule they enforce (`idx_product_variant_option_one_value_per_option`) rather than truncated, and the three existing abbreviated index names on `product_product_option_value` are renamed alongside them
- [ ] A foreign key needs a **non-partial** unique index on the columns it references, so the three new ones — `product_variant (id, product_id)`, `product_product_option (id, product_id)`, `product_product_option_value (id, product_product_option_id)` — cannot carry the soft-delete predicate. `soft-delete-index-predicate` learns to allow exactly this shape: uniqueness that includes the table's own primary key constrains nothing the primary key does not already constrain, so it holds no slot for a soft delete to release. It has to be a **constraint** rather than an index — a constraint is emitted inside `CREATE TABLE`, ahead of every `ALTER TABLE … ADD FOREIGN KEY`, whereas an index lands after them and the migration fails on the first foreign key that references it. So the exemption is on `uniqueConstraints`, and every unique *index* on a soft-deletable table stays partial without exception
- [ ] All six deletion rules behave as stated above, each covered by a test asserting what a later read returns
- [ ] The conventions check from ticket 05 reports no guard/guarded overlap for the product module
- [ ] The product migration is regenerated **in place** under `0000_create_product_tables` — never a `0001_*` file — and `db:generate` afterwards reports no schema changes for all twelve configs
- [ ] Existing rows are remapped from global value id to product value id. The application is not deployed, so a cold re-migrate is acceptable rather than a data migration

## Acceptance criteria — service

- [ ] **The product layer stops at the module service.** It is a storage and enforcement concern: `product_variant_option` stores `product_id`, `product_product_option_id` and `product_product_option_value_id`, and the service resolves those rows itself on every read and write. Combinations, DTOs, workflows and the wire keep speaking global `optionId`/`optionValueId`, so `combinationKey`, `buildCombinations`, `findCombination` and `buildPickerTargets` are unchanged and nothing outside the module moves.

  An earlier draft had those functions key on the product-layer ids instead. It does not work, and would not have been worth it if it did: `planProductOptionChange` runs *before* `setProductOptions`, so a newly added option has no product-layer id at plan time; the create-product form authors a variant's `optionValues` before the product exists at all; and `manage-product-options-form` posts a product-scoped option's id straight back as a **global** `optionId`. Each needs a translation step in a workflow or a client, to buy nothing — D1–D6 and I1–I5 are properties of the schema and the service, not of which id a pure function happens to key on.

  What does change: `replaceVariantOptionValues` resolves the product's option rows and writes all four columns, and `listVariantOptionMaps`, `listOptionValuesForVariant`, `countVariantsByOptionValue` and `retitleVariantsCarrying` resolve back to global ids
- [ ] **I4 is settled and the codebase says which way.** `valueIds: []` currently means "this product offers *every* value of the option" (`:636-639`), which I4 forbids. Recommended: adopt I4, add `min(1)` to `SetProductOptionsDTO.valueIds`, guard `setProductOptions`, and delete the `hasValueLinks ? … : allValues` widening. **Do not remove the filter at `reconcile-variants.ts:70` on the same change.** Its comment states why: *"Left in, it would multiply the combination count to zero and plan the deletion of the entire catalogue."* It is a last line of defence, not redundancy. Remove it only once I4 is enforced on every write path and a test proves a valueless option cannot be persisted
- [ ] **`setProductOptions` writes incrementally.** Today it soft-deletes every link and recreates them. Under the new schema that cascade takes every variant's option values with it on any option edit, so a surviving option or value must keep its row and its id, and only what the payload dropped is deleted
- [ ] `setProductOptions` refuses a change that would break I2 or I3, so the service is safe when called outside `setProductOptionsWorkflow`. The refusal is exactly `plan.remove` being non-empty: a variant carrying a dropped value would be left partial (I3), and a variant collapsed onto another's combination would duplicate it (I2). It still applies `plan.reassign`, which is what lets dropping an option from a single-variant product succeed and leave that variant bare
- [ ] The workflow stays the path that *resolves* collisions by removing collapsed variants rather than refusing, and gains none of the resolution logic itself. It calls `applyProductOptionChange`, which writes the options and moves the variants onto them in one transaction and returns the plan it applied; the workflow keeps only the cross-module work the module cannot do — price sets, links, cart eviction — and the removal step that must stay last so nothing has to be put back
- [ ] The deletion paths that now cascade into variant values cannot leave two variants sharing a combination, or a variant missing a value. Neither the database nor the cascade walker can see these rules, so the service is the only place they can be caught
- [ ] Deleting a product option from a product with **one** variant succeeds and leaves that variant with no values — the ordinary option-less product shape. With **two** variants it is refused, because it would produce two identical variants
- [ ] Violations keep the error type their neighbours already use, rather than being flattened to one. The existing I2/I3 guards raise **`INVALID_DATA`** (`:1026`, `:1063`, `:1081`, `:1139`) — the caller sent a bad payload; the deletion pre-checks raise **`NOT_ALLOWED`** (`:453`, `:1278`) — the operation is not permitted in this state. Both are 400. New write-path guards follow the first, new deletion guards the second; do not change the four existing types and their tests as a side effect
- [ ] Every rule has a test asserting the observable outcome of a read, and each new assertion is mutation-tested — revert the guard and confirm the test bites

## Acceptance criteria — documentation

- [ ] `docs/product-options.md` (new) documents the five tables, both rule sets, and where each rule is enforced
- [ ] ADR 0016 records two decisions: the pivot to the product value with the modelling bug it fixes, and that I2/I3/I4 are service-enforced — with the accepted cost that any caller reaching a repository directly, or writing raw SQL, bypasses them
- [ ] Full backend suite green; `npm run verify` green

## Tests that encode behaviour this ticket reverses

None of these should be deleted quietly — each is a decision being made again.

- **"setProductOptions no longer refuses a change its variants do not cover"** — pins the *removal*
  of an older guard, which this ticket brings back. Rewrite it to assert the new contract and say in
  the ADR why the guard returned.
- **"an empty optionValues map clears the combination"** — clearing a combination while the product
  still has options violates I3. Decide whether I3 wins or this is a deliberate exception.
- **Two tests in `utils/option-combinations.test.ts`** built on an option offering no values —
  *"an option offering no values collapses the count to zero"* (`:59`) and *"an option offering no
  values yields nothing rather than a partial row"* (`:168`). Adopting I4 makes that state
  unreachable through the service, so they become tests of an input only a direct repository call
  can produce. They stay, for the same reason the filter at `reconcile-variants.ts:70` stays — the
  pure layer is the last line of defence, and a test is what keeps it one. The neighbouring
  *"ignores a variant with an incomplete combination"* (`:150`) and *"returns nothing for an
  incomplete map"* (`:181`) are **I3**, not I4, and stay as they are.

## TODO — pick this up next

**`product_variant_option` was stripped back to its minimum**, deliberately, to leave a small
surface to re-check with fresh eyes. It now carries only `id`, `variant_id`,
`product_product_option_value_id` and the timestamps — two single-column foreign keys, both
`on delete cascade`. `foreignKeyTarget`, the three composite foreign keys, the non-partial unique
constraints they referenced and the check exemption that allowed them are all out.

### What still holds

- **D1–D6, all six, still enforced and still covered by tests.** Every deletion rule was carried by
  a cascade or a restrict that survives. D3 now reaches the variant values through
  `product_product_option` → `product_product_option_value` → here, rather than also directly.
- The service layer is untouched: I2, I3 and I4 are exactly as they were.

### What is no longer enforced

| | Rule | Needs |
| --- | --- | --- |
| I1 | one value per **option** per variant | a denormalised `product_product_option_id` to index on, and a composite FK to `product_product_option_value (id, product_product_option_id)` to keep it honest |
| I5 | a variant only uses options its own product offers | a denormalised `product_id`, and composite FKs `(variant_id, product_id)` and `(product_product_option_id, product_id)` |

A weaker index survives in I1's place: `UNIQUE (variant_id, product_product_option_value_id)` stops
a variant carrying the *same* value twice, but not S and M at once.

Three tests are `test.skip`, not deleted, because they are the assertions that prove those rules:

- *"two values of the same option cannot both be assigned"* — I1
- *"a variant cannot carry an option its own product does not offer"* — I5
- *"a variant value cannot name an option other than its own"* — the drift guard on the
  denormalised option

All three were confirmed to fail without the constraints and pass with them, so un-skipping is the
check that the restoration actually worked.

### The chain to re-derive before restoring it

Each link is load-bearing, and if any one is wrong the whole helper is wrong:

1. A composite foreign key needs a **non-partial** unique declaration on the parent side.
2. Soft-delete uniqueness in this codebase is partial, and Postgres refuses to reference a partial
   index.
3. So the parent needs a second, unfiltered declaration — harmless **only** because it contains the
   primary key, which already makes it unique, so it holds no slot a soft delete must release.
4. It has to be a **constraint**, not an index: constraints are emitted inside `CREATE TABLE`,
   ahead of the `ALTER TABLE … ADD FOREIGN KEY` statements. As an index it lands after them and the
   migration dies on the first foreign key that references it.
5. `soft-delete-index-predicate` then has to allow exactly that shape and nothing wider.

### Also worth a look while in here

Four generated foreign-key names on the product tables exceed Postgres's 63-byte identifier limit
and are being silently truncated (longest is 89 bytes). They do **not** collide today — checked —
but they are one long name away from doing so, and a collision surfaces as a confusing migration
failure. Naming them explicitly avoids it.

## Settled

- **I3 does not reach the combination-clearing hole.** I3 forbids a *partial* combination: a product
  offering Size and Colour must not hold a variant valued for Size alone. A variant carrying no
  values at all is a different state — the shape every option-less product's variant has — so
  `resolveCombinationsForUpdate` (`:1056`) clearing a combination stays legal and the test pinning it
  stays as it is. Say so in the ADR, since the two states read alike from the outside.
- **The product layer stops at the module service.** See the first service criterion above.

## Open questions this ticket must settle

- **Guest-checkout orders carry `customerId: null`.** `complete-cart.ts:241` copies
  `cart.customerId` rather than deriving one from the customer step, so a guest's order can never
  appear in `GET /store/orders` — only be retrieved by id. Found while writing the store-order
  tests; may be intended, but it is undecided. Adjacent to this ticket rather than part of it.

## Out of scope

- **Backing I2 with a database constraint.** It is uniqueness over a *set* of rows, so no unique
  index can express it; the deferred constraint trigger that can was rejected along with the rest of
  the SQL-side logic.
- **Anything in ticket 05's out-of-scope list** — chunking, property testing, database-side
  cascades — remains out of scope here.

## Notes

The ambiguity ticket 05 works around is not inherent to `RESTRICT`. It exists because
`product_variant_option` declares both `option_id → cascade` and `option_value_id → restrict`: one
delete removes a guard and needs that guard's permission at the same time. Postgres resolves it by
asking "is anything still referencing this *after* the cascade?" and permitting the delete —
verified. The layered schema removes the collision rather than teaching anyone a rule about it.

The denormalised `product_product_option_id` earns its place: it is the only way
`UNIQUE (variant_id, product_product_option_id)` can exist, since the option is two hops away and
Postgres cannot index across a join. The composite FK is what makes it trustworthy.

Building a product is inherently transactional and the rules make it so: I4 makes a product option
illegal until its values exist, I3 makes a variant illegal until it has a value for every option.
No statement ordering avoids the illegal intermediate state — proven in the sandbox, where seeding
with autocommit fails on the second statement. So "add an option to a product" must be one
transaction that also supplies a value for every existing variant, or be refused.

`planVariantReconciliation` already resolves the two-variant collapse by removing collapsed variants
(`reason: 'collapsed'`) — the same answer as "a variant is defined by its option values". Keep that
behaviour; the gap is only that raw `setProductOptions` does not reconcile at all.

The ADR is **0018**, not 0016: 0016 and 0017 were taken by the tickets that shipped before this one.
