# Variant Options

Reference spec for how a product's variants relate to the options it offers. Merged from three
working documents written in sequence — the original planning prompt, the server-computed
projections redesign, and the option-driven-variants reconciliation work. Where they disagreed, this
records what shipped; the superseded positions are kept under [History](#history), because the
reasoning behind them still explains the shape of the code.

Vocabulary follows `CONTEXT.md`. Rationale for the projection layer is in
[ADR 0015](../adr/0015-server-computed-option-projections.md). The tables underneath, and the
deletion and integrity rules over them, are in [Product Options](../product-options.md) and
[ADR 0018](../adr/0018-layered-product-options.md) — which narrows two of the positions below.

**Status:** shipped.

---

## Problem Statement

A shopkeeper sells the same product in several variations — a t-shirt in Small Black, Medium White.
They need to describe those variations once, as options, and have the catalogue and storefront
follow.

Three things stood in the way.

**Nothing recorded which variation a variant was.** A variant's identity lived only in its title
string, so the storefront could not render option pickers. An earlier attempt split `variant.title`
on `" / "` to recover Size and Colour; it broke on a product whose variants were titled `S`, `M`,
`L`, and was reverted.

**Adding an option to a product that already sold silently corrupted it.** The system refused to
*remove* an option in use but accepted *adding* one, which left every existing variant standing for
an incomplete combination. Nothing reported this: the edit form saved without complaint, duplicate
variants became creatable, and the storefront picker went dead for that product.

**A product could not be born with variations.** The create form had no variants step, so a
shopkeeper made the product, then opened a drawer to attach options, then added variants one at a
time — for a Size × Colour matrix, a dozen round trips.

## Solution

A product's variants are **derived** from its options. The shopkeeper chooses which options the
product offers and which values of each; the variant set follows automatically.

Editing options reconciles the variants rather than being refused by them. Adding an option keeps
every existing variant — with its SKU, price and images intact — and fills in the rest of the
matrix. Removing a value deletes the variants carrying it, and the shopkeeper is told how many
before saving. Removing every option collapses back to a single variant.

The create form gains a Variants step: toggle "this product has variants", pick options and values,
and the full matrix appears as an editable grid for SKUs and prices. One save creates the product,
its options and every variant.

Variant titles are no longer typed at all. A variant is called after the combination it stands for,
so a title can never disagree with it.

The backend answers the questions users ask about combinations; the clients render the answers.

---

## User Stories

**Describing what a product varies along**

1. As a shopkeeper, I want to choose which options a product offers from the options my shop already
   defines, so that Size means the same thing across the catalogue.
2. As a shopkeeper, I want to choose which *values* of an option this particular product sells, so
   that a product available only in Red and Blue does not advertise the shop's full colour range.
3. As a shopkeeper, I want the options to appear in an order I control, so that the storefront reads
   "Size / Colour" rather than the reverse.
4. As a shopkeeper, I want deselecting an option's last value to drop the option entirely, so that I
   never leave a product offering a dimension it has no values for.
5. As a shopkeeper, I want to be told when my shop has no options defined yet, so that I understand
   why the picker is empty rather than assuming it is broken.

**Creating a product with variations**

6. As a shopkeeper, I want to say up front whether a product has variations, so that a product sold
   in exactly one configuration does not make me invent an option for it.
7. As a shopkeeper, I want a product without variations to still be purchasable, so that I do not
   have to know that a cart needs something to add.
8. As a shopkeeper, I want the full matrix of variants generated from the options I picked, so that
   I do not enumerate Small-Black, Small-White, Medium-Black by hand.
9. As a shopkeeper, I want to type a SKU and price against each generated variant in one grid, so
   that I am not opening a form per variant.
10. As a shopkeeper, I want to reorder the generated variants by dragging, so that they appear on the
    storefront in the order I intend.
11. As a shopkeeper, I want edits I have already typed to survive adding another option value, so
    that widening the matrix does not cost me the SKUs I entered.
12. As a shopkeeper, I want the product, its options and all its variants saved in one action, so
    that I never end up with a half-built product if something fails.
13. As a shopkeeper, I want a failed save to leave nothing behind, so that I can correct the problem
    and retry rather than clean up.

**Changing options on a product that already sells**

14. As a shopkeeper, I want to add an option to a product that already has variants, so that I can
    start selling an existing shirt in more sizes without rebuilding it.
15. As a shopkeeper, I want my existing variants to keep their SKUs, prices, images and order history
    when I add an option, so that adding a dimension is not a data loss event.
16. As a shopkeeper, I want the newly created variants to inherit a sensible price, so that I am not
    retyping the same figure across a matrix.
17. As a shopkeeper, I want the price inherited from the most similar existing variant, so that a
    product priced differently per colour keeps those differences when I add sizes.
18. As a shopkeeper, I want to be told how many variants a change will delete before I save it, so
    that I am never surprised by disappearing stock.
19. As a shopkeeper, I want removing an option value to delete exactly the variants carrying it, so
    that dropping Black removes the black shirts and touches nothing else.
20. As a shopkeeper, I want removing an entire option to merge the variants that only differed by it,
    so that I am not left with duplicates that all look the same.
21. As a shopkeeper, I want removing every option to leave me one variant, so that the product
    returns to the state it would have had if I had never added options.
22. As a shopkeeper, I want a variant that has landed on the wrong value to be correctable in one
    click, so that an automatic assignment I disagree with is cheap to fix.
23. As a shopkeeper, I want a change that would create an unreasonable number of variants refused,
    so that a mistyped option cannot generate thousands of rows.

**Working with an individual variant**

24. As a shopkeeper, I want to pick a variant's combination from a searchable list, so that a product
    with many combinations is still usable.
25. As a shopkeeper, I want combinations another variant already has left out of that list, so that I
    cannot create a duplicate.
26. As a shopkeeper, I want the variant I am editing to keep its own combination in the list, so that
    I can leave it alone or change my mind.
27. As a shopkeeper, I want to be told when every combination is taken, so that I understand why I
    cannot add another variant.
28. As a shopkeeper, I want a variant's title to follow its combination automatically, so that a
    variant moved from Medium-White to Large-White does not keep advertising the old name.
29. As a shopkeeper, I want a variant of a product with no options to be named after the product, so
    that it still reads sensibly on an order.
30. As a shopkeeper, I want renaming an option value to update every variant carrying it, so that
    correcting "Blk" to "Black" does not leave stale names across the catalogue.
31. As a shopkeeper, I want renaming a value to keep every variant's link to it, so that a typo fix
    is not a destructive operation.

**Shopping**

32. As a shopper, I want to pick a product's options on the product page, so that I can choose the
    size and colour I want rather than reading a list of variant names.
33. As a shopper, I want values that lead nowhere shown as unavailable, so that I do not select a
    combination the shop does not sell.
34. As a shopper, I want the option I am changing to always be selectable, so that switching size
    never dead-ends me.
35. As a shopper, I want as much of my selection preserved as possible when I change one option, so
    that changing size does not silently change colour.
36. As a shopper, I want colour options shown as the product's own photographs, so that I see the
    actual shade rather than an approximation.
37. As a shopper, I want a sold-out variant still selectable if I navigate to it, so that the page
    reflects what I am looking at.
38. As a shopper, I want a product whose variants carry no options to still be buyable, so that a
    simple product is not broken by machinery meant for complex ones.
39. As a shopper, I want the name of what I bought preserved on my order, so that my history stays
    readable even if the shopkeeper later restructures the product.
40. As a shopper, I want a variant the shop has withdrawn removed from my cart, so that I cannot
    check out with something that no longer exists.

**Building on it**

41. As a developer, I want the combination rules expressed as pure functions, so that I can test
    every rule without a database.
42. As a developer, I want one implementation of what a combination is called, so that a title cannot
    disagree with itself depending on which code path produced it.
43. As a developer, I want the same rules validating writes that generate the admin's choices, so
    that what the UI offers and what the API accepts cannot drift.

---

## Implementation Decisions

### Domain model

The variant-to-value link is a **full pivot entity** with its own id, timestamps and partial unique
indexes — not a bare join table. The option id is denormalised onto it so "one value per option per
variant" is a database constraint rather than a service convention.

Options are **global**, shared across products, with a per-product projection — the
**Product-Scoped Option** — carrying the subset of values that product sells and its display order.
That projection is its own named type, distinct from the global option.

`Option Combination` is the domain term throughout. `tuple`, `selection` and `selectedValueIds` are
retired.

Option and value metadata is `jsonb`, not text. A render hint (text row versus colour swatch) is a
real enum column rather than a key inside the metadata blob — metadata is the escape hatch, and a
controlled enum in a blob gets no validation.

### The rules are pure

Two dependency-free modules hold every rule. One computes what a product can sell:

```ts
buildCombinations({ options, variants }): OptionCombination[]
countCombinations(options): number       // multiplies value counts; never enumerates
combinationKey(optionValues): string     // sorted, order-independent
combinationLabel(values): string         // the one place a title is spelled
buildPickerTargets({ options, variants }): Record<variantId, Record<valueId, string | null>>
```

The other computes what an option change does to the variants:

```ts
planVariantReconciliation({ currentOptions, nextOptions, variants }): VariantReconciliationPlan

type VariantReconciliationPlan = {
  keep:     Array<{ variantId: string; combination: OptionCombination }>
  reassign: Array<{ variantId: string; fromLabel: string; combination: OptionCombination }>
  create:   Array<{ combination: OptionCombination; copyPricesFromVariantId: string | null }>
  remove:   Array<{ variantId: string; title: string; reason: 'value-dropped' | 'collapsed' }>
}
```

The product service holds only I/O, error mapping and pivot writes.

### Reconciliation rules

- A variant with no value for a newly added option takes that option's **first value in rank order**.
  Final — correction is a one-click reassignment afterwards.
- A variant whose carried value is no longer offered is **removed**, not reassigned. Reassigning
  silently relabels physical stock.
- Variants colliding after an option is dropped **collapse to the oldest**; the rest are removed.
- Dropping every option collapses to a **single** variant. A product offering no options can sell
  exactly one combination — the empty one.
- An option offering zero values is **not a dimension** and is filtered out. Left in, it multiplies
  the combination count to zero and plans a catalogue wipe.
- Missing combinations are created, priced from the **most-overlapping survivor**. This diverges from
  Shopify, which seeds every new row from one product-wide default.
- Every removal is a soft delete.

### Titles

A Variant Title is **always derived** — the combination's label, or the product's title when the
product offers no options. It is not accepted on write at all.

Because titles are derived, renaming an option value cascades a retitle to every variant carrying
it. That in turn required option values to be an **upsert**: a known id renames in place and keeps
every variant link, where matching by value string turned a rename into a delete-plus-insert and was
refused outright once any product used the value.

### Two flows, one set of rules

| | Create wizard | Edit options |
| --- | --- | --- |
| Product | Does not exist yet | Exists, may already sell |
| Variant set | Client enumerates the matrix from its own form state | Server reconciles against what exists |
| Destructive? | No — nothing exists to destroy | Yes; removals need consent |

The wizard enumerates client-side deliberately: a product that does not exist offers nothing, so
there is no server state to drift from, and the server validates every variant on create regardless.
It does not use the reconciler — there is nothing to reconcile against.

### No preview endpoint

Reconciliation happens **inside the save**. Creating variants is not destructive and needs no
consent; removing them does, and the per-value variant count already shipped on the product-scoped
read is enough to warn accurately.

This follows Shopify, where the options editor and the variants table are the same unsaved form —
the "New" badges are the page re-rendering its own state, not a server round-trip. There is one
Save. A dropped *value* is counted exactly; a dropped *option* is named but not counted, because
predicting the collapse would mean re-implementing the reconciler in the client.

### Cross-module effects belong in workflows

Both write paths are workflows with compensating steps, because both reach beyond the product
module into pricing, links and carts:

- **Setting options** — plan, write the option links, reassign variants, create the missing ones,
  copy their prices, remove what the change leaves no room for.
- **Creating a product** — create it, set its options, create its variants. A failed variant rolls
  the product back.

No new routes; the existing option and product endpoints run them.

Removing a variant also **soft-deletes its line items in active carts**, silently. Completed carts
are the record behind an order and stay intact; order line items are a separate table with their own
copies, so history is unaffected.

### Limits

Two separate ceilings, because listing and writing cost different things. One bounds *enumerating*
combinations for a searchable list; a much lower one bounds *writing* variants. The enumeration
ceiling is checked by multiplying value counts rather than building the matrix, so a pathological
product is refused without ever being expanded.

### API contracts

```ts
// Admin read — resolved and rank-ordered
type AdminVariantOptionValue = { optionId: string; optionTitle: string; valueId: string; value: string }

type AdminOptionCombination = {
  key: string                            // sorted, order-independent
  label: string                          // "M / White"
  values: AdminVariantOptionValue[]
  optionValues: Record<string, string>   // the exact write payload
  variantId: string | null               // taken by, or free
}

// Admin write — no title; it is derived
optionValues: Record<string, string>     // create: required. update: omit = leave, {} = clear

// Product create accepts the whole thing at once
options?: Array<{ optionId: string; valueIds: string[] }>   // valueIds: at least one (I4)
variants?: AdminCreateProductVariant[]

// Store — the id map, plus precomputed answers
optionValues: Record<string, string>
swatchImageUrl: string | null
pickerTargets: Record<string, Record<string, string | null>>
```

The storefront picker is **precomputed server-side** as `pickerTargets`: for each variant a shopper
could be looking at, where every option value would take them, or `null` when unreachable. It
resolves **left to right** — a value on option *k* is reachable when some buyable variant carries it
alongside the current selection for options before it. The first option is therefore always open,
which keeps every combination reachable. Constraining each option by *all* the others dead-ends:
given only Small-Blue and Medium-Black, sitting on Medium-Black would grey out both Small and Blue.

Colour swatches come from the variant's linked images, not a hex in metadata — a hex would duplicate
what the photographs already say and drift from them.

### Client-side

The combination picker is a **single searchable combobox**, server-searched and paginated. No
cascading selects, no draft state. It holds the selected **combination object**, not its id: over a
server-searched list the id would have to be resolved again at submit, by which time the page it
came from may have been replaced by whatever was typed next.

Wizard grid rows are keyed by combination, so re-enumerating after an option change carries edited
rows across. Medusa rebuilds the array positionally and loses them.

---

## Testing Decisions

A good test here asserts **external behaviour** — what a shopkeeper or shopper observes — not how
the code reaches it. Every assertion must be able to fail: mutate the rule it covers and confirm
that test, and ideally only that test, goes red. Sixteen mutations were run across the reconciler,
service, workflows and client logic; each failed the test claiming to cover it, and two workflow
compensation assertions turned out to be **vacuous** that way and were rewritten.

Five seams, all pre-existing. No new ones were introduced.

| Seam | What it proves | Prior art |
| --- | --- | --- |
| Pure rule modules | Every combination and reconciliation rule, no database | `build-variant-stock.ts` and its test |
| Product service against real Postgres | Pivot writes, error mapping, the rename cascade | the existing module service suite |
| Workflows with mocked module services | Cross-module effects and compensation | the existing image-variant workflow tests |
| Admin route handlers | Payload validation, ceilings, rollback | the existing product route tests |
| Playwright, one spec per domain | The combobox, the grid, the storefront picker | `products.spec.ts` in both apps |

Prefer the highest seam that can observe the behaviour. Combination rules are tested pure because
they need nothing else; cart eviction is tested at the workflow because that is the only place it is
observable; the picker is tested end to end because it is a rendering concern.

Backend tests are integration tests sharing one database, so two test processes must never run
concurrently. The admin's pure-logic suite is wired into the verification gate; the store has no
unit suite because it has no pure logic left.

---

## Out of Scope

- **Multi-currency.** Prices are written in one currency; there is no store or region module, so the
  variant grid has a single price column.
- **Inventory management from these flows.** Nothing in the API creates inventory items, so managed
  inventory and backorder toggles are omitted from the grid rather than shipped inert.
- **Creating option values inline.** Options are global entities with their own screens; the wizard
  links existing ones only. A shop with no options defined hits a dead end mid-wizard.
- **Per-product value ordering.** "The option's first value" means the global rank. Both reference
  platforms have the same gap.
- **Per-product exclusive options.** Medusa's equivalent was considered and not adopted; options stay
  global.
- **Per-row SKU conflict recovery.** A SKU collision fails the whole save.
- **Notifying a shopper** whose cart line was removed. The line disappears silently.
- **Backfilling hand-written titles** from before titles became derived. They are overwritten the
  next time their product is reconciled.

---

## Further Notes

### Edge-case register

| # | Case | Rule |
| --- | --- | --- |
| 1 | Option added to a product with variants | Each takes the new option's first value; rest of matrix created |
| 2 | Value dropped that variants carry | Those variants removed, not relabelled; count shown before saving |
| 3 | Option dropped, two variants collide | Oldest survives; rest removed as collapsed |
| 4 | Option offering zero values | Filtered out — otherwise the count multiplies to zero |
| 5 | All options removed | Collapses to one variant on the empty combination |
| 6 | Product created with variations off | One option-less variant, titled after the product |
| 7 | New variant needs a price | Copied from the most-overlapping survivor; none if there is no survivor |
| 8 | Write exceeds the variant ceiling | Refused on both paths |
| 9 | Two rows given the same SKU | Whole save fails — SKU is globally unique, not per-product |
| 10 | SKU already used by another product | Same |
| 11 | Removed variant sits in a live cart | Line items soft-deleted from active carts, silently |
| 12 | Removed variant in order history | Safe — no foreign key, title snapshotted |
| 13 | Shop has no options at all | Selector shows its empty state |
| 14 | An option value is renamed | Every variant carrying it is retitled; links survive |
| 15 | A hand-written title predates derived titles | Overwritten on next reconciliation |
| 16 | Wizard: SKUs typed, then a value added | Rows keyed by combination; edits survive |
| 17 | Storefront variant carrying no option values | Falls back to a plain select of variant titles |

### Known gaps

- **Option-less uniqueness is not enforced at create.** The API accepts an empty combination without
  checking whether the product already has a bare variant, so duplicates can be minted directly and
  are only corrected the next time options are edited. The UI cannot reach this.
- **Per-product value rank** does not exist, so the first value is a global fact shared by every
  product offering that option.
- **I2, I3 and I4 are service rules**, so anything reaching a repository directly can break them.
  [ADR 0018](../adr/0018-layered-product-options.md) records why they were not pushed into the
  schema, and what that costs.

### History

Six positions from the earlier documents were superseded:

| Superseded | By |
| --- | --- |
| Title optional on write, derived only when omitted | Always derived, removed from the payloads. A title that *can* disagree with its combination eventually will. |
| A guard refusing option or value removal | Refusing made it impossible to add an option to a selling product. The guard became reconciliation — then came back narrowed in [ADR 0018](../adr/0018-layered-product-options.md), refusing only a change that would leave a variant nowhere to be. |
| A service helper deriving titles, another expanding payload values | Both deleted; one label implementation, and the expansion moved into option resolution. |
| Admin and store unit configs deleted, all pure logic serverside | The wizard reintroduced pure client logic, so the admin suite is back and gated. The store still has none. |
| The combinations endpoint would also serve the create wizard | The wizard has no product id, and the drawer needs no preview. That endpoint remains, paginated and searched, for the comboboxes only. |
| Two option-less variants are "two saleable things, not a collision" | They collide on the empty combination. Shipping this wrong produced four variants all named after the product. |

Resolved along the way, and worth not rediscovering:

- The combination search parameter is `label`, not `q`. The framework consumes `q` into a database
  search filter; combinations are computed, so there is no column to filter on.
- Product-scoped schemas are written out in full rather than extended. An extended Zod schema becomes
  an OpenAPI `allOf`, and the client generator turns that into an intersection whose overridden
  fields go optional — silently reverting the scoped value type to the unscoped one.
- Payload schemas whose price fields run through a big-number pipeline must have those fields omitted
  before the parsed result is handed to a generated client; the pipeline's output type is not the
  wire type.
