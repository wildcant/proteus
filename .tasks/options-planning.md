# Planning prompt: variant ↔ product-option link

Paste the block below into a new session to continue the design work.

---

Design the variant ↔ product-option link in proteus, from database to storefront UI.

## Problem

There is no link between a product variant and an option value. The schema has
product_option → product_option_value (global options, unique title), and
product_product_option / product_product_option_value for which options and values a
product offers. Nothing says "this variant is size M". A variant's identity lives only
in its `title` string.

Consequence: the storefront PDP cannot render option pickers. I previously shipped a
version that split `variant.title` on " / " to derive Size and Colour; it broke on a
product whose variants are titled "S", "M", "L" and was reverted in ceb13b3. The
storefront currently has a plain `<select>` of variant titles.

## Reference: how Medusa models it

`medusa-source/packages/modules/product/src/models/product-variant.ts`:

  options: model.manyToMany(() => ProductOptionValue, {
    pivotTable: "product_variant_option",
    mappedBy: "variants",
    joinColumn: "variant_id",
    inverseJoinColumn: "option_value_id",
  })

The variant points at option *values*; the option is reached via optionValue.option.
Medusa uses a bare pivotTable (no id/timestamps). Proteus models its analogous image
pivot as a full entity — see apps/backend/src/modules/product/models/product-variant-image.ts
(prefix pvimg_, timestamps, partial unique index on the pair) — and the new pivot should
follow that, not Medusa's bare table.

Also worth reading in that directory: product-option.ts (note `is_exclusive`, which
proteus lacks — proteus's unique title index is unconditional, so all options are global),
product-option-value.ts (metadata is model.json(), rank exists), and
product-product-option-value.ts.

## What already exists in proteus — reuse it, don't rebuild

- Full option CRUD on the backend: apps/backend/src/api/admin/product-options/**,
  apps/backend/src/api/admin/products/[id]/options/route.ts
- ProductModuleService.listProductOptionsForProduct(productId) already returns options
  with their product-scoped values, rank-ordered. The admin product detail route uses it.
  The store route should call the same method — no new option query logic needed.
- ProductModuleService.setProductOptions(productId, { options: [{ optionId, valueIds }] })
- Admin SPA screens: routes/_authed/_shell/product-options/** (global option CRUD) and
  products/$id/_detail/options.tsx (assign options to a product)
- Just landed (ceb13b3): the store product response carries `images` and per-variant
  `thumbnail` + `imageIds`, via the product_variant_image pivot. The PDP gallery already
  switches photos with the selected variant. Build the picker on top of this, don't disturb it.

Missing in the admin SPA: assigning option values to a variant, and any variant *creation*
form at all (only products/$id/variants/$variantId edit routes exist).

## Decisions already reached in discussion

- Add the pivot. It is the one thing blocking a generic renderer.
- Convert `metadata` from text() to jsonb().$type<Record<string, unknown> | null>() —
  the payment module already does this (7 tables jsonb, 17 still text). Scope the
  conversion coherently; don't leave one module internally split.
- A render hint (text row vs colour swatch) should be a real column with a pgEnum, not a
  key inside the metadata blob — metadata is the escape hatch, and a controlled enum in a
  blob gets no validation. pgEnum precedent: cart_status, customer_status.
- Colour swatches should come from the variant's linked images (real data, already
  available via variant.imageIds + product.images), with a metadata hex as an optional
  fallback for options that have no imagery. Don't make hex the primary source — it
  duplicates what the photos already say and will drift.

## Open questions to settle in planning

- Scope: does this change include admin UI for assigning option values to variants, and
  a variant creation form that generates the size × colour matrix? Both are in
  .tasks/next-todos. Or is it DB + service + seed + store API + store PDP, admin later?
- Whether to adopt Medusa's `is_exclusive` (per-product options) now or stay global-only.
- What the picker does for variants that carry no option values — flat title list
  fallback, or is that state disallowed once the admin enforces assignment?
- Availability: a value should be unselectable when no variant carries it alongside the
  current selections. Confirm this is computed from the pivot, not guessed.

## Constraints

- One migration per module, regenerated in place with the same tag — never add 0001_*.
  The product module's is apps/backend/src/modules/product/migrations/0000_create_product_tables.sql
- Backend tests are integration tests against a real Postgres; they share one database, so
  never run two test processes at once.
- Seed at apps/backend/scripts/seed-dev.ts already creates global Size (S/M/L/XL) and
  Color options and links them to products — it will need to link variants to values too.
- Read CLAUDE.md. No `any`, no non-null assertions, camelCase, `type` over `interface`.
- Gate: npm run verify, then the full backend suite and the store e2e separately.
- Known pre-existing failure, not yours: 4 tests in
  src/framework/scheduler/__tests__/bullmq-cron-scheduler.test.ts time out (BullMQ
  Postgres queue backend). Confirmed failing on a clean tree.

Plan this end to end before writing code.
