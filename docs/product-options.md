# Product Options

How a shop's option catalogue, the options a product offers, and the values a variant carries relate
to one another — and where each rule about them is enforced.

Vocabulary follows `CONTEXT.md`. The behaviour these tables serve is specified in
[Variant Options](specs/variant-options.md); the reasoning behind the shape is in
[ADR 0018](adr/0018-layered-product-options.md). The cascade machinery is described in
[Soft-Delete Cascade](soft-delete-cascade.md).

## The five tables

Three layers. Each row points at the layer above it, never across.

```
global      product_option ──────────< product_option_value
                  ▲                            ▲
                  │ restrict                   │ restrict
product     product_product_option ──────────< product_product_option_value
                  ▲                            ▲
                  │ cascade                    │ cascade
variant                    product_variant_option
```

| Layer | Table | What one row is |
| --- | --- | --- |
| global | `product_option` | An option the shop defines once — "Size". Shared across products. |
| global | `product_option_value` | A value that option can take — "M". Shared across products. |
| product | `product_product_option` | This product offers that option. |
| product | `product_product_option_value` | This product offers that value of it. Not every product offers every value. |
| variant | `product_variant_option` | This variant is that value — "this variant is size M". |

`product_variant_option` names two things: the variant, and the **product's** value. Pointing at the
product's value rather than the global one is what makes the deletion rules below expressible. It
reaches the global ids through the product layer, never directly.

> **Reduced for now.** It also used to carry `product_id` and `product_product_option_id`, which is
> what I1 and I5 were enforced with. Both are out while the schema is re-checked — see the TODO in
> `.scratch/soft-delete-cascade/issues/06-layered-product-option-schema.md`.

### The denormalised option, and why it will come back

`product_product_option_id` is derivable — it is
`product_product_option_value.product_product_option_id` for the value a pivot row names. Storing it
anyway is the only way I1 can be an index at all: the option is two hops from the variant and
Postgres cannot index across a join. A composite foreign key back to
`product_product_option_value (id, product_product_option_id)` is what would keep it from drifting
from the value it accompanies.

It is not on the table today, so I1 is not enforced.

## Deletion rules

| | Rule | Enforced by |
| --- | --- | --- |
| D1 | Deleting a global option is refused while any product offers it | `product_product_option.option_id` restricts, plus a pre-check in `softDeleteProductOptions` for the shopkeeper-facing wording |
| D2 | Deleting a global value is refused while any product offers it | `product_product_option_value.option_value_id` restricts, plus a pre-check in `replaceOptionValues` |
| D3 | Deleting a product option cascades to its values and to the variant values under them | `product_product_option_value.product_product_option_id` cascades, and each of those values owns the pivot rows naming it |
| D4 | Deleting a product value cascades to the variant values carrying it | `product_variant_option.product_product_option_value_id` cascades |
| D5 | Deleting a variant leaves both the product and global layers alone | nothing above a variant points down at it |
| D6 | Deleting a product takes its product layer and leaves the global one alone | `product_product_option.product_id` cascades |

Every rule holds for a hard delete because the database performs it, and for a soft delete because
the cascade walker derives the same graph from the same declarations.

**D3 travels through the product's values.** Deleting a product option cascades to the values it
offers, and each of those owns the pivot rows naming it — so the variant values go two hops down. It
used to travel a second, direct way as well, through the denormalised option column; with that
column gone there is one path, and the test still passes either way.

**Why the variant no longer guards the global value.** Before the pivot,
`product_variant_option.option_value_id` restricted the global value, so a variant being size M is
what made "M" un-deletable. Two rules were wrong as a consequence: dropping an option from a
product, or a value from an option on a product, left every variant still claiming a value its
product no longer offered. Now the variant guards nothing — it is *owned* by the row below it, and
that row is what guards the global value. Deleting "M" is refused because a product sells something
in medium, which is the true reason.

## Integrity rules

| | Rule | Enforced by |
| --- | --- | --- |
| I1 | One value per option per variant | **not enforced yet** — a weaker `UNIQUE (variant_id, product_product_option_value_id)` stops the same value twice, not two values of one option |
| I2 | A combination belongs to one variant | service |
| I3 | No partial combination — a variant valued for one of its product's options is valued for all of them | service |
| I4 | An option a product offers offers at least one value | service |
| I5 | A variant only uses options its own product offers | **not enforced yet** |

I2, I3 and I4 are service rules by decision, not by oversight. See
[ADR 0018](adr/0018-layered-product-options.md) for why, and for what it costs.

> **I1 and I5 are not enforced right now.** Both need denormalised columns and composite foreign
> keys that are off the table while the schema is re-checked. The three tests that prove them are
> `test.skip`; I2, I3 and I4 are unaffected. See the TODO in
> `.scratch/soft-delete-cascade/issues/06-layered-product-option-schema.md`.

### I3 does not forbid a bare variant

I3 is about *partial* combinations. A product offering Size and Colour must not hold a variant
valued for Size alone — that variant stands for nothing the product sells and the storefront cannot
render it. A variant carrying **no** values is a different state: it is the ordinary shape of every
option-less product's single variant, and it is what a variant becomes when its product drops its
last option. Clearing a combination with an empty `optionValues` map stays legal for that reason.

### Where each service rule is enforced

| Path | I2 | I3 | I4 |
| --- | --- | --- | --- |
| `createProductVariants` | every combination is matched against the product's, and against the others in the same batch | an incomplete map is refused | — |
| `updateProductVariants` | a combination another variant holds is refused | an incomplete map is refused; an empty one clears | — |
| `setProductOptions` | refused when the change would collapse two variants onto one combination | refused when the change would strand a variant on a value the product drops | refused when an option names no values |
| `applyProductOptionChange` | resolved: the collapsed variant is reported for removal | resolved: surviving variants are moved onto the combinations they land on | refused |

## Changing a product's options

Adding an option leaves every existing variant needing a value for it; dropping one leaves variants
standing for combinations that no longer exist. Neither intermediate state is legal, and no ordering
of separate calls avoids it. So the option write and the variant moves it forces happen in one
transaction, or not at all.

That is the whole reason there are two entry points rather than one.

- **`setProductOptions`** is for a change the product's variants can already follow. It writes the
  options, moves the variants that need moving, and **refuses** anything that would leave a variant
  nowhere to be. Any caller can use it and cannot break I2 or I3 with it.
- **`applyProductOptionChange`** is for a change that costs variants. It does the same work without
  the refusal and *reports* the variants it could not keep, because removing one reaches price sets,
  links and carts — modules this one may not touch, and work that has to happen last so nothing has
  to be put back. `setProductOptionsWorkflow` is its only caller.
- **`revertProductOptionChange`** puts a captured state back, for that workflow's compensation. It
  is the one case where what the variants should be is known rather than derived, so skipping the
  guard is not skipping a check.

### The write is incremental

An option or value the payload still names keeps its row and its id. Replacing them wholesale — what
this did before the pivot — now cascades straight through every variant's option values, so an
unrelated edit would strip a product's variants of their identity. Keeping ids stable is also what
lets a plan computed before the write still name what it meant afterwards.

## Where the product layer stops

At the module service. `product_variant_option` stores product-layer ids and the service resolves
them on the way in and out; every DTO, workflow, route and client speaks global `optionId` and
`optionValueId`. `combinationKey` and everything built on it are unchanged.

The reads that translate back are `listVariantOptionMaps`, `listOptionValuesForVariant`,
`countVariantsByOptionValue` and `retitleVariantsCarrying`. The one write that translates forward is
`replaceVariantOptionValues`.
