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
| I1 | one value per option per variant | `UNIQUE (variant_id, ppo_id)` + composite FK | database index only; the DTO shape makes it unrepresentable anyway |
| I2 | combination unique per product | service | enforced on variant writes (`product-module-service.ts:1024, 1031, 1060, 1080`) and on option change by `planVariantReconciliation`, which *removes* collapsed variants (`reconcile-variants.ts:131`). Not enforced on deletion paths |
| I3 | a variant has a value for every option its product offers | service | enforced on variant **create** (`:1016`, `:1137`) only |
| I4 | a product option offers at least one value | service | nowhere — and it contradicts a live behaviour |
| I5 | a variant only uses options its own product offers | composite FKs on `(*, product_id)` | nothing prevents it today |

Every rule was proven against Postgres 17 in
`~/.dbclient/query/…@sandbox/New_Query_1787594132263.sql`. Part A of that script demonstrates
today's schema failing D3, D4 and I5; Part B is the target schema passing all eleven.

Two existing pre-checks are good and stay: `softDeleteProductOptions` refuses an option a product
still offers (`:450-457`), and `replaceOptionValues` refuses a value products still use
(`:1275-1286`).

## Acceptance criteria — schema

- [ ] `product_variant_option` references the **product value**, not the global value, and carries `product_id` and a denormalised `ppo_id`
- [ ] `product_product_option_value.option_value_id` becomes `restrict` — a product offering a value is what guards the global value
- [ ] `UNIQUE (variant_id, ppo_id)` enforces I1, and a composite FK `(ppov_id, ppo_id) → product_product_option_value (id, ppo_id)` stops `ppo_id` drifting from the value it accompanies. Today nothing ties the two together and the column can silently disagree
- [ ] Composite FKs `(variant_id, product_id)` and `(ppo_id, product_id)` enforce I5, so a variant of one product cannot use another product's option. A test proves the insert is refused
- [ ] All six deletion rules behave as stated above, each covered by a test asserting what a later read returns
- [ ] The conventions check from ticket 05 reports no guard/guarded overlap for the product module
- [ ] The product migration is regenerated **in place** under `0000_create_product_tables` — never a `0001_*` file — and `db:generate` afterwards reports no schema changes for all twelve configs
- [ ] Existing rows are remapped from global value id to product value id. The application is not deployed, so a cold re-migrate is acceptable rather than a data migration

## Acceptance criteria — service

- [ ] `option-combinations.ts` and `reconcile-variants.ts` key on `ppo_id`/`ppov_id` instead of `optionId`/`optionValueId` — `combinationKey`, `buildCombinations`, `findCombination`, `buildPickerTargets` — and `replaceVariantOptionValues` writes `product_id` and `ppo_id` too. This is the bulk of the ticket and touches every resolver a variant write goes through
- [ ] **I4 is settled and the codebase says which way.** `valueIds: []` currently means "this product offers *every* value of the option" (`:636-639`), which I4 forbids. Recommended: adopt I4, add `min(1)` to `SetProductOptionsDTO.valueIds`, guard `setProductOptions`, and delete the `hasValueLinks ? … : allValues` widening. **Do not remove the filter at `reconcile-variants.ts:70` on the same change.** Its comment states why: *"Left in, it would multiply the combination count to zero and plan the deletion of the entire catalogue."* It is a last line of defence, not redundancy. Remove it only once I4 is enforced on every write path and a test proves a valueless option cannot be persisted
- [ ] `setProductOptions` refuses a change that would break I2 or I3, so the service is safe when called outside `setProductOptionsWorkflow`. The workflow stays the path that *resolves* collisions by removing collapsed variants rather than refusing
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
  unreachable, so they become tests of an impossible input. The neighbouring
  *"ignores a variant with an incomplete combination"* (`:150`) and *"returns nothing for an
  incomplete map"* (`:181`) are **I3**, not I4, and stay as they are.

## Open questions this ticket must settle

Each needs an answer written down, not discovered during implementation.

- **Does I3 win over the deliberate combination-clearing hole?** `resolveCombinationsForUpdate`
  (`:1056`) lets an update clear a variant's combination while the product still has options, and a
  test pins that as intended. I3 forbids it. Pick one and say why in the ADR.
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

The denormalised `ppo_id` earns its place: it is the only way `UNIQUE (variant_id, ppo_id)` can
exist, since the option is two hops away and Postgres cannot index across a join. The composite FK
is what makes it trustworthy.

Building a product is inherently transactional and the rules make it so: I4 makes a product option
illegal until its values exist, I3 makes a variant illegal until it has a value for every option.
No statement ordering avoids the illegal intermediate state — proven in the sandbox, where seeding
with autocommit fails on the second statement. So "add an option to a product" must be one
transaction that also supplies a value for every existing variant, or be refused.

`planVariantReconciliation` already resolves the two-variant collapse by removing collapsed variants
(`reason: 'collapsed'`) — the same answer as "a variant is defined by its option values". Keep that
behaviour; the gap is only that raw `setProductOptions` does not reconcile at all.
