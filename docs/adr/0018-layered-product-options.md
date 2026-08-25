# 18. Layered Product Options

Full feature spec: [Soft-Delete Cascade](../../.scratch/soft-delete-cascade/spec.md), ticket 06.
Reference: [Product Options](../product-options.md).

**Status:** Accepted

## Context

A shop defines options once — Size, Colour — and each product chooses which of them it offers and
which of their values. A variant then carries one value per option its product offers. Three tables
already expressed that: a global layer, a product layer, and the variant pivot.

The pivot pointed at the wrong one. `product_variant_option` referenced the **global** value, not
the product's, which made two deletion rules quietly do the wrong thing:

- Dropping an option from a product deleted the product's option rows and left every variant still
  claiming a value its product no longer offered.
- Dropping a value from an option on a product did the same.

Neither was noticed because both leave readable rows behind rather than raising anything. The
storefront picker for such a product silently goes dead, since the variant's values no longer
correspond to anything the product advertises.

And it produced a cascade ordering ambiguity the walker had to work around. The pivot declared
`option_id → cascade` alongside `option_value_id → restrict`, so one delete removed a guard and
needed that guard's permission at the same time. [ADR 0016](0016-derived-soft-delete-cascade.md)
resolved the ambiguity by checking every restriction against pre-cascade state; the conventions
check that warns about the shape flagged this pair as the only instance in the codebase.

## Decision

### The pivot points at the product's value

`product_variant_option` drops `option_id` and `option_value_id` for
`product_product_option_value_id`. It reaches the global layer through the product layer and never
directly.

Two consequences follow without anyone writing code for them. Dropping an option or a value from a
product now reaches the variant values under it, because they are its children. And the
guard/guarded overlap disappears: guards now point only upward across a layer boundary, so no
cascade closure can contain both a guard and the row it guards.

Existing rows are not migrated. The application is not deployed, so the product migration is
regenerated in place and the databases are re-created cold.

### The product layer stops at the module service

`product_variant_option` stores product-layer ids; every DTO, workflow, route and client keeps
speaking global `optionId` and `optionValueId`. The service resolves between them — four reads
translate back, one write translates forward — and `combinationKey`, `buildCombinations`,
`findCombination` and `buildPickerTargets` are untouched.

Threading the product-layer ids further was considered and rejected. It does not work:
`planProductOptionChange` runs before the option write, so a newly added option has no product-layer
id to key on; the create-product form authors a variant's `optionValues` before the product exists
at all; and the admin's option editor posts a product-scoped option's id straight back as a global
one. Each would need a translation step in a workflow or a client. And it buys nothing — the
deletion and integrity rules are properties of the schema and the service, not of which id a pure
function happens to key on. Keeping the translation in the one layer that already reads these tables
is both smaller and the only version that composes.

### Three rules stay in TypeScript

Three rules no foreign key can express:

- **A combination belongs to one variant.** It is uniqueness over a *set* of rows, so no unique
  index can state it.
- **No partial combination** — a variant valued for one of its product's options is valued for all
  of them. It is a count against another table.
- **An option a product offers offers at least one value.** Likewise.

Each could be backed by a deferred constraint trigger. We are not doing that: SQL functions and
triggers are a second place for business rules to live, in a language with no tests, no types and no
review path, and the alternative is three guards in a service that already has forty.

**The accepted cost is that these three are bypassable.** A caller reaching a repository directly,
or writing raw SQL, can produce a product violating any of them, and nothing will complain until a
read renders wrong. Where a rule could be pushed into the schema it was; these three could not.

### A partial combination is illegal; an empty one is not

What is forbidden is a *partial* combination. A variant carrying no values at all is a different
state — the ordinary shape of an option-less product's single variant, and what a variant becomes
when its product drops its last option. So `updateProductVariants` clearing a combination with an
empty `optionValues` map stays legal, and the test pinning it stays as it is.

The two states read alike from the outside, which is why this is written down: "a variant with
values for some of its product's options" is the illegal one, not "a variant with none".

### `setProductOptions` refuses a change its variants cannot follow

An older guard refused any option change on a product that had variants. It was removed, because
that made adding an option to a selling product impossible, and reconciliation replaced it: the
workflow moves the variants instead.

The guard comes back, narrowed. `setProductOptions` refuses exactly the changes that would leave a
variant nowhere to be — one carrying a value the change drops, or one collapsing onto a combination
another variant holds. A change the variants can follow is applied, and they are
moved. Dropping an option from a single-variant product succeeds and leaves that variant bare;
dropping it from a two-variant product is refused, because it would produce two identical variants.

It raises **`NOT_ALLOWED`**, not `INVALID_DATA`, even though it fires on a write. The payload is
not malformed — the same payload is accepted the moment the offending variants are gone — so what
is being reported is the state, which is the distinction the two types already carry elsewhere in
this service: `INVALID_DATA` for a combination the product cannot sell, `NOT_ALLOWED` for the
deletion pre-checks on options and values. This guard is the third of those, reached through a
write.

The reason the guard has to exist is that the pivot made the service reachable. Before, a raw
`setProductOptions` left a mess that nothing enforced; now it cascades, so an unguarded call is a
silent deletion. And the reason it cannot be the only path is that resolving a collision means
deleting variants, which reaches price sets, links and carts.

So there are two entry points. `applyProductOptionChange` does the same work without the refusal and
reports the variants it could not keep, and `setProductOptionsWorkflow` — its only caller — does the
cross-module cleanup and the removal, last, so nothing has to be put back.

Its write is incremental: an option or value the payload still names keeps its row and its id.
Wholesale replacement, which is what this did, would now cascade through every variant's option
values on any edit.

## Consequences

- Two deletion rules that silently corrupted a product are correct.
- The conventions check reports no guard/guarded overlap anywhere in the codebase.
- The three service-enforced rules can be bypassed by anything that skips the service.
- `valueIds: []` no longer means "every value the option has". It is refused, which is what the
  admin's option selector already assumed.
