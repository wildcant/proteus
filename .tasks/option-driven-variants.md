# Option-driven variants

Two flows over one set of rules. Glossary in `CONTEXT.md`, prior work in
`.tasks/variant-options-redesign.md` and `docs/adr/0015-server-computed-option-projections.md`.

**Principle:** a product's variants are *derived* from its options. Choosing options determines a
variant set; the server owns the rules that say which; the admin confirms anything destructive
before it happens.

| | Flow A — create wizard | Flow B — edit options |
| --- | --- | --- |
| Where | `products/create`, Details + a new Variants step | `products/$id/options` drawer |
| Product | Does not exist yet | Exists, may already sell |
| Variant set | The client enumerates the matrix from its own form state | The server reconciles against what exists |
| Destructive? | No — nothing exists to destroy | Yes — removals need consent |
| Status | Missing entirely | Silently corrupts data today |

---

## Flow B — the bug

`setProductOptions` guards option and value *removal* (`checkProductOptionsStillCoverVariants`)
but nothing guards *addition*. Reproduced against a real database — product with Size (S/M) and
two variants, Colour (Red/Blue) added afterwards:

```
[1] setProductOptions adding an option:  ACCEPTED
[2] combinations:  S/Red→null  S/Blue→null  M/Red→null  M/Blue→null
[3] totalCombinations: 4   availableCombinations: 4        ← two variants exist, none counted
[4] edit form's `current` for variant "S":  undefined      ← combobox renders empty
[6] update without optionValues:  ACCEPTED, still stranded ← saves the title, leaves it broken
[7] create "S / Red" alongside stranded "S":  ACCEPTED     ← near-duplicate variants
[8] pickerTargets:  {"S":{}, "M":{}, "S / Red":{…}}        ← storefront picker dead for both
```

A stranded variant keys on one pair where a full combination keys on two, so `buildCombinations`
matches it to nothing and every downstream projection treats it as absent. The edit form does not
throw — it succeeds and leaves the variant broken.

## Flow A — the gap

`CreateProductForm` has Details / Organize / Attributes and no Variants step. `POST /admin/products`
takes no options and no variants and calls `createProduct` directly rather than a workflow. A
product cannot be born with variants.

---

## Constraints

Facts established while designing. Several remove features visible in the reference screenshots.

1. **No multi-currency.** `currencyCode: 'usd'` is hardcoded at `create-product-variants.ts:45`
   and `update-variant-prices.ts:60`; there is no store or region module. Medusa's *Price EUR /
   Price USD / Price Europe* columns collapse to one.
2. **Nothing in the API creates inventory items** — only `seed-dev.ts` does. `manageInventory` and
   `allowBackorder` exist on the variant with no inventory item behind them, so those columns are
   left out of the grid rather than shipped inert. Related: the `inStock` TODO in `next-todos`.
3. **SKU is globally unique**, not per-product (`idx_product_variant_sku`, partial on
   `deleted_at IS NULL`). Blank SKUs are `NULL` and never collide.
4. **Options and values are global entities** with their own CRUD. Values cannot be typed inline;
   the wizard links existing options only.
5. **Order and cart line items hold `variantId` as bare `text()` with no FK** and snapshot the
   title, so deleting a variant cannot corrupt order history.
6. **`components/data-grid/` already exists** — hand-rolled over `@proteus/ui`'s `Table` with
   `useGridNavigation`, columns of `text | checkbox | currency`. It uses **no** react-table; that
   is confined to `components/data-table/`. `@dnd-kit/*` is already a dependency.
7. **`AdminProductScopedOptionValue.variantCount` already ships** — "Variants of this product
   carrying the value." The options drawer already reads it. This is what makes destructive
   changes confirmable without a preview endpoint.

### Rank, confirmed against Medusa

| | Medusa | Proteus | |
| --- | --- | --- | --- |
| `ProductVariant.variant_rank` | `number().default(0).nullable()` | `integer().default(0)` | what the sortable list writes |
| `ProductOptionValue.rank` (global) | `number().nullable()` | `integer().default(0)` | what "the option's first value" means |
| `ProductProductOptionValue.rank` | absent | absent | no per-product value order |
| `ProductProductOption.rank` | absent | `integer().default(0).notNull()` | proteus is ahead here |

Per-product value order does not exist in Medusa either, so the global rank is parity rather than a
gap. **No migration in this work.**

---

## Reference behaviour

**Shopify**, adding Size (M/XL) to a product whose variants vary by Colour: every existing variant
keeps its identity — SKU, image, price — and lands on the **index-0** value of the new option. The
rest of the matrix is generated and tagged `New`. Removing a value deletes the variants carrying
it.

Worth being precise about how that preview works, because it shaped this design: Shopify's options
editor and variants table are **the same unsaved form**. The `New` badges are the page re-rendering
its own state, not a server round-trip. There is one `Save`.

**Medusa**, `product-create-details-variant-section.tsx` and `product-create-variants-form.tsx`:
the wizard holds the whole matrix in form state, a sortable list sets `variant_rank` from index,
and the Variants step renders an editable grid.

Taken: rank from index, the sortable list, the editable grid, one-form-one-save.

Not taken:

- **`form.setValue("variants", newVariants)` discards every per-row edit on any option change.**
  Type a SKU, add a value, lose the SKU. Our rows are keyed by `combination.key`, so re-enumerating
  carries edited rows across.
- **Medusa's `should_create` checkboxes.** We create the full matrix; a shopkeeper who wants fewer
  either deletes the variant afterwards or narrows the option's values.
- **Medusa fabricates a "Default option / Default variant"** for products without variants. Our
  rules handle genuinely option-less products, so no phantom option is needed.
- **Medusa's editable Title column.** Titles are derived here — see decision 12.

---

## Decisions

| # | Decision |
| --- | --- |
| 1 | The variant set is derived from the options. Flow B's removal guards become reconciliation. |
| 2 | A variant with no value for a newly added option takes that option's **index-0** value in global rank order. Final — the admin reassigns afterwards with the edit-variant combobox, which already does exactly that. |
| 3 | A variant whose carried value is no longer offered is **removed**, not reassigned — reassigning silently relabels stock. |
| 4 | Variants colliding after an option is dropped collapse to the oldest by `createdAt`; the rest are removed. |
| 5 | Missing combinations are created, seeded from the **most-overlapping** survivor. Diverges from Shopify's flat default: `XL / Charcoal` should inherit `M / Charcoal`'s price. |
| 6 | An option offering zero values is not a dimension and is filtered out. Left in, it multiplies the count to zero and plans a catalogue wipe. |
| 7 | `nextOptions: []` collapses to a **single** option-less variant. A product offering no options can sell exactly one combination — the empty one — so dropping the last option merges its variants rather than leaving one nameless duplicate per combination, all sharing the product's title. |
| 8 | **No plan endpoint.** Reconciliation happens inside the save. Creating is not destructive and needs no consent; removing is, and `variantCount` already tells the drawer how many variants a value holds. |
| 9 | Flow A creates the **full** matrix, enumerated client-side from form state. A product that does not exist yet offers nothing, so there is no server state for the client to drift from — and the server validates every variant on create regardless. |
| 10 | `variantRank` comes from the sortable list in the Details step. No migration. |
| 11 | A separate, lower `MAX_VARIANTS_PER_PRODUCT` governs writing variants; `MAX_OPTION_COMBINATIONS` only governs enumerating them for a combobox. |
| 12 | **Variant Title is always derived** — the combination's label, or the product title when the product offers no options. Dropped from the API payloads entirely. |
| 13 | Renaming a Product Option Value **retitles every variant carrying it**, or "always derived" is not true. |
| 14 | Removing a variant **soft-deletes its line items in `active` carts**, silently. Completed carts are history and stay intact. |
| 15 | Every removal in this work is a soft delete, through `BaseRepository`. |
| 16 | A SKU collision fails the whole save. Per-row recovery is not worth it at this size. |
| 17 | No backward compatibility. Code the redesign obsoletes is deleted, not deprecated. |

---

## Shared core

### 1. The combination rules — already shipped

`modules/product/utils/option-combinations.ts`. `buildCombinations` is the single source of what a
product can sell, and every write path already validates through it. Nothing here changes.

### 2. The reconciler — **done**, flow B only

`modules/product/utils/reconcile-variants.ts` + `reconcile-variants.test.ts`, 12 tests, no
database, beside `option-combinations.ts`.

```ts
planVariantReconciliation({ currentOptions, nextOptions, variants }): VariantReconciliationPlan

type VariantReconciliationPlan = {
  keep:    Array<{ variantId: string; combination: OptionCombination }>
  reassign: Array<{ variantId: string; fromLabel: string; combination: OptionCombination }>
  create:  Array<{ combination: OptionCombination; copyPricesFromVariantId: string | null }>
  remove:  Array<{ variantId: string; title: string; reason: 'value-dropped' | 'collapsed' }>
}
```

Flow A does not call this — it has no existing variants to reconcile against, so the degenerate
case (`variants: []` → every combination in `create`) is a property the tests pin rather than a
code path anything uses.

**Outstanding from phase 1:** rename `move` → `reassign` per `CONTEXT.md`, and drop `retitleTo` —
decision 12 makes the title unconditionally the new label, so the heuristic goes.

Every rule was mutation-tested rather than trusted green:

| mutation | tests failed |
| --- | --- |
| project onto the last value, not index 0 | 4 |
| stop filtering valueless options | 1 |
| seed new variants from one default, Shopify-style | 1 |
| collapse toward the newest variant | 4 |
| reassign a dropped value instead of removing | 1 |

### 3. Derived titles

One label implementation. `buildCombinations` already produces `label`; nothing else may derive one.

- `ProductModuleService.retitleVariantsCarrying(optionValueIds: string[])` — loads the affected
  variants and their combinations, derives each label through the existing path, writes back.
  **TypeScript over a clever `string_agg` statement**, so labelling has exactly one source.
- Called from `updateProductOptionValue` (decision 13) and from the reconciler's `reassign` and
  `create`.
- `resolveVariantTitle` and the `title` fields on `AdminCreateProductVariant` /
  `AdminUpdateProductVariant` are **deleted** (decisions 12, 17).
- An option-less product's variant takes the product title, since `label` is `''` and the column is
  `notNull`.

### 4. Variant writes with prices

`createProductVariantsWorkflow`'s price-set and link steps, and
`deleteProductVariantWorkflow`'s dismissal, are what both flows write through. Removal gains one
step: soft-delete line items in `active` carts (decision 14).

### 5. Components

- **`OptionValueSelector`** — the options multi-select plus the per-option values multi-select.
  Extracted from `manage-product-options-form.tsx`, where it already exists as a private
  `OptionSelector`. `pinnedValueIds` is **kept and repurposed** — same `variantCount` data, changed
  from "you cannot unlink this" to "unlinking this will delete 3 variants."
- **`SortableList`** — ported from
  `medusa-source/packages/admin/dashboard/src/components/common/sortable-list/sortable-list.tsx`.
  `@dnd-kit/*` is already a dependency; swap `@medusajs/icons`/`IconButton` for the `@proteus/ui`
  equivalents. No checkboxes — decision 9 removed the only thing they toggled.
- **`components/data-grid/`** — extend rather than replace. Add a `readonly` column type and a
  `ReadonlyCell`; Combination and Title both need one.

---

## Backend work

- `setProductOptionsWorkflow` — `plan` → `set-options` → `apply-plan`, each compensating. The plan
  is computed inside the workflow and never leaves it. `PUT /admin/products/:id/options` runs it
  instead of calling the service.
- `createProductWorkflow` — `create-product` → `set-options` → `create-variants`.
  `POST /admin/products` runs it; `AdminCreateProduct` gains optional `options` and `variants`.
  Each variant is validated against `buildCombinations` by the existing create path; a partial
  matrix stays legal at the API even though the wizard always sends a full one.
- `retitleVariantsCarrying`, wired into `updateProductOptionValue`.
- Cart eviction step: `listLineItems({ variantId })` filtered to `active` carts → `deleteLineItems`.
- `MAX_VARIANTS_PER_PRODUCT`, enforced on both write paths.
- `variantRank` written from the payload.
- `ProductModuleService` loses `checkProductOptionsStillCoverVariants` and `expandOfferedValues`.
- `npm run openapi:generate`.

No new routes.

## Admin work

- Extract `OptionValueSelector`; port `SortableList`; add `readonly` to `data-grid`.
- **Options drawer** — selector plus a confirm step naming what will be deleted, counted from
  `variantCount`. Dropping a whole option counts the variants on that option, which is the
  worst case for a collapse. Creates and reassignments are not announced; they are not destructive.
- **`CreateProductForm`** gains `Tab.VARIANTS` after Organize. **Details** hosts the "product with
  variants" toggle, `OptionValueSelector`, and the `SortableList` that sets `variantRank`.
  **Variants** hosts the grid: Combination (read-only) / Title (read-only) / SKU / Price.
- `use-create-product-form.ts` — rows are enumerated from the selected options and held keyed by
  `combination.key`, so re-enumerating after an option change preserves edited rows. The Variants
  tab is the first whose schema is not an `AdminCreateProduct.pick(...)`; that break is accepted.
- Title inputs removed from the create-variant and edit-variant forms.

## Deleted

`checkProductOptionsStillCoverVariants`, `expandOfferedValues`, `resolveVariantTitle`, the `title`
fields on both variant payloads, the title inputs in both variant forms, and the two `NOT_ALLOWED`
tests in `product-module-service.test.ts`, which invert into reconciliation assertions.
Decision 17: delete, do not deprecate.

---

## Edge-case register

| # | Case | Rule |
| --- | --- | --- |
| 1 | Option added to a product with variants | Each variant takes the new option's index-0 value; rest of matrix created |
| 2 | Value dropped that variants carry | Those variants removed, not relabelled; confirmed first from `variantCount` |
| 3 | Option dropped, two variants collide | Oldest by `createdAt` survives; rest removed as `collapsed` |
| 4 | Option offering zero values | Filtered out — otherwise the count multiplies to zero and plans a catalogue wipe |
| 5 | All options removed | Collapses to one variant on the empty combination; the rest are removed as `collapsed` |
| 6 | Product created with the variants toggle off | One option-less variant, titled after the product |
| 7 | New variant needs a price | Copied from the most-overlapping survivor; `null` when there is none |
| 8 | Write exceeds `MAX_VARIANTS_PER_PRODUCT` | Refused on both paths |
| 9 | Two rows given the same SKU | Whole save fails — SKU is globally unique |
| 10 | SKU already used by another product | Same |
| 11 | Removed variant sits in a live cart | Line items soft-deleted from `active` carts, silently |
| 12 | Removed variant in order history | Safe — no FK, title snapshotted |
| 13 | Shop has no global options at all | Selector shows its empty state; inline creation is out of scope |
| 14 | A Product Option Value is renamed | Every variant carrying it is retitled |
| 15 | A variant's hand-written title predates decision 12 | Overwritten on the next reconciliation; no backfill |
| 16 | Wizard: admin edits SKUs, then adds a value | Rows keyed by `combination.key`; edits survive the re-enumeration |

---

## Tests

- `reconcile-variants.test.ts` — **done**, 12 tests, mutation-proven. Update for `reassign` and the
  dropped `retitleTo`.
- `product-module-service.test.ts` — the repro above, inverted: after adding an option every
  variant holds a full combination and `availableCombinations` is right. Plus the rename cascade.
- `set-product-options.test.ts`, `create-product.test.ts` — prices follow created variants, price
  sets and `active`-cart line items die with removed ones, completed carts untouched, each step
  compensates.
- `product-routes.test.ts` — `POST /admin/products` with options and variants; the ceiling refusal
  on both paths.
- Admin unit — re-enumerating rows after an option change preserves edited SKUs.
- Admin e2e — the wizard creates a product with the full matrix; the options drawer names the
  variants a value removal will delete before Save.

Every assertion must be able to fail — mutate the code to prove it bites.

---

## Phasing

1. Reconciler — **done**. Rename `move` → `reassign`, drop `retitleTo`.
2. Derived titles: `retitleVariantsCarrying`, the rename cascade, payload removals.
3. `setProductOptionsWorkflow` + cart eviction. Closes the data corruption.
4. Options drawer: selector plus the destructive-change confirm. Flow B ships.
5. `createProductWorkflow` + the wizard's Variants step. Flow A ships.
