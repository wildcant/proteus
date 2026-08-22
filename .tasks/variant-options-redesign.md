# Variant options — server-computed projections

Outcome of the grilling session. Glossary in `CONTEXT.md`, rationale in
`docs/adr/0015-server-computed-option-projections.md`. Reworks `feat/variant-options` (PR #14)
in place.

**Principle:** the backend answers the questions users ask about combinations; clients render the
answers. No option logic in either app.

---

## Decisions

| # | Decision |
| --- | --- |
| 1 | The product-scoped projection of an option is its own named type — `ProductScopedOption` — not `ProductOption`. |
| 2 | `Option Combination` is the domain term. `tuple` / `selection` / `selectedValueIds` are retired. |
| 3 | Admin variants carry **resolved, rank-ordered** option values. Store variants keep the **id map**. |
| 4 | `GET /admin/products/:id/option-combinations` returns every combination with `variantId: string \| null`. |
| 5 | Paginated + server-searched (`label`, `limit`, `offset`, `count`), with a hard ceiling on matrix size. |
| 6 | Create and edit are a **single searchable combobox** over combinations. No selects, no cascade, no draft state. |
| 7 | `title` is optional on write; the service derives it from the combination's label when omitted. |
| 8 | The combination math is a **pure module** in the product module, unit-tested without a database. |
| 9 | The store gets `pickerTargets: Record<variantId, Record<valueId, targetVariantId \| null>>`. |
| 10 | Rework PR #14 in place — Phase 1 (DB), the service write path and the seed all survive. |

---

## Wire shapes

### Admin

```ts
type AdminVariantOptionValue = {
  optionId: string
  optionTitle: string
  valueId: string
  value: string
}

// AdminProductVariant — read
optionValues: AdminVariantOptionValue[]        // rank-ordered

// AdminCreateProductVariant / AdminUpdateProductVariant — write, unchanged
optionValues?: Record<string, string>          // omit = leave; {} = clear
title?: string                                 // now optional — derived when omitted

type AdminOptionCombination = {
  key: string                                  // "opt_1=v_m|opt_2=v_wht", sorted
  label: string                                // "M / White"
  values: AdminVariantOptionValue[]            // rank-ordered
  optionValues: Record<string, string>         // the exact write payload
  variantId: string | null                     // taken by, or free
}

// AdminProductScopedOption.values[]
variantCount: number                           // locks a value in the manage-options drawer
```

### Store

```ts
// StoreProductVariant — unchanged
optionValues: Record<string, string>

// StoreProductScopedOptionValue
swatchImageUrl: string | null                  // precomputed, selection-independent

// StoreProductResponse.product
pickerTargets: Record<string, Record<string, string | null>>
```

---

## Backend

**`modules/product/utils/option-combinations.ts`** — pure, no DB, mirrors
`workflows/product/utils/build-variant-stock.ts`:

```ts
buildCombinations(scopedOptions, variants): OptionCombination[]
combinationKey(values): string
findCombination(combinations, optionValues): OptionCombination | undefined
buildPickerTargets(scopedOptions, variants): Record<string, Record<string, string | null>>
```

`ProductModuleService` keeps only I/O, error mapping and pivot writes:

- `resolveVariantOptionTuples` → resolves against `buildCombinations`; keeps its granular
  `INVALID_DATA` messages for incomplete tuples and unknown values.
- `checkVariantTuplesAreUniqueWithinBatch` → a `Set` over combination keys within the batch.
- `checkVariantTuplesAreUniqueOnProduct` → **deleted**; the check is `combination.variantId &&
  combination.variantId !== variant.id`.
- `tupleKey` → **deleted**, use `combinationKey`.
- `replaceVariantOptionValues` → unchanged.
- `checkProductOptionsStillCoverVariants` → reads scoped options rather than the raw payload, so
  "no value links means all values" stops being re-derived.
- New `resolveVariantTitle(data, combination)`, shaped like `resolveThumbnail`.
- Enrichment returns `AdminVariantOptionValue[]` instead of folding to a map.

**Routes**

- `GET /admin/products/:id/option-combinations` — list semantics, `operationId:
  listOptionCombinations`. Refuses with `NOT_ALLOWED` above `MAX_COMBINATIONS`.
- `GET /store/products/:id` — adds `pickerTargets` and `swatchImageUrl`; keeps the existing
  `Promise.all` batching and the `variantIds.length > 0` guard.
- `AdminProductScopedOption` gains `variantCount` — one grouped count, not N+1.

Then `npm run openapi:generate`.

---

## Admin

- `use-create-variant-form.ts` / `use-edit-variant-form.ts` — one `combinationKey` field plus
  optional `title` / `sku`. No draft, no completeness guard, no `titleFor`, no cascade. Edit sends
  `title` only when the field is dirty, so retitling follows the combination.
- `create-variant-form.tsx` / `edit-variant-form.tsx` — a searchable combobox with a debounced `q`.
  Empty state when every combination is taken; the existing link to `/products/$id/options` when
  the product has none.
- `variant-general-section.tsx` — renders `variant.optionValues` directly.
- `use-variant-table.tsx` — a column per scoped option, cell = the matching resolved value in a
  `Badge`. This is the screenshot.
- `manage-product-options-form.tsx` — `InUseNotice` computation deleted; values with
  `variantCount > 0` render locked with a tooltip.
- **Delete** `matrix.ts`, `matrix.test.ts`.
- Keep `POST /variants/batch` and `useCreateProductVariantsBatch` — the wizard's multi-select over
  combinations is exactly what it is for.

## Store

- **Delete** `variant-picker.ts` entirely.
- `variant-picker.tsx` — `pickerTargets[selected.id][value.id]`; disabled when `null`, pressed when
  it equals the selected id, navigates to it otherwise. Drops the `imageUrlById` map for
  `swatchImageUrl`. Keeps the `<select>` fallback for products whose variants carry no values.

---

## Tests

- `option-combinations.test.ts` — pure. Rank order preserved, `variantId` set correctly, keys stable
  under key reordering, picker targets unavailable vs self-targeting, ceiling enforced.
- `product-module-service.test.ts` — title derived when omitted and respected when sent; update
  without `optionValues` leaves the tuple; duplicate rejection via `variantId`; unlink guard.
- `store-product-routes.test.ts` — `pickerTargets` correctness, `swatchImageUrl`, no cross-product
  leakage.
- Admin + store e2e — combobox create flow, taken combinations absent, variants table columns,
  picker click-through, out-of-stock disabled.
- **`verify.sh`** — add a `JOBS` entry running the admin and store unit suites. They are not in the
  gate today.

Every assertion must be able to fail — mutate the code to prove it bites.

---

## Open implementation calls

_All resolved during implementation:_

- The search param is **`label`**, not `q`. The framework consumes `q` into a database search filter
  via `searchableColumns`; combinations are computed rather than stored, so there is no column for
  it to filter on.
- `MAX_OPTION_COMBINATIONS` is **10,000**, enforced with `countCombinations` — which multiplies the
  value counts rather than enumerating, so a pathological product is refused without building it.
- The scoped schemas are written out in full rather than `.extend()`-ed. An extended Zod schema
  becomes an OpenAPI `allOf`, and the client generator turns that into an intersection whose
  overridden fields go optional — which silently reverted `values` to the unscoped type.
- The admin and store unit-test configs were **deleted** rather than wired into `verify.sh`. The
  redesign moved both apps' pure logic to the backend, so neither had any tests left to run. The
  gate instead runs `test:gate`, which covers `src/api` plus the pure option-combination tests in
  one vitest process — one process because every backend test file pulls in `db-setup`, and the
  suite is not safe to run twice concurrently against the shared test database.
