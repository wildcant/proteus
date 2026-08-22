# 15. Server-Computed Option Projections

**Status:** Accepted

## Context

A variant is identified by its Option Combination — one Product Option Value per Product-Scoped
Option (see `CONTEXT.md`). Everything users do with options is a question *about* combinations:
which ones does this product already sell, which could it still sell, which are buyable right now,
and what does this one read as.

The first implementation shipped the raw relation — `product.options` plus
`variant.optionValues: Record<optionId, optionValueId>` — and let each client answer those
questions itself. That produced ten distinct transformations across roughly twenty
implementations, split over the product module service, both apps and the seed script. Two of
them mattered: the admin decided which combinations were still free by enumerating the whole
cartesian product and subtracting, while the service decided the same thing by scanning sibling
variants. One rule, two algorithms, on opposite sides of the wire — free to disagree, and when
they did the UI offered a combination the save then rejected.

## Decision

The backend answers the questions; clients render the answers.

- **Admin** gets `GET /admin/products/:id/option-combinations` — a paginated, searchable list of
  every combination the product could sell, each carrying a stable `key`, a `label`, its
  rank-ordered resolved values, the `optionValues` map to POST back, and `variantId` naming the
  variant that has it or `null` if it is still free. Creating a variant is picking a free one;
  editing is picking a free one or your own, so `scope=available` (with `variantId` when editing)
  does that narrowing server-side — otherwise a page of taken combinations arrives empty.
- **The response carries two product-level totals**, `totalCombinations` and
  `availableCombinations`, both measured before the search narrows anything. "Does this product
  have options" and "is every combination taken" are questions about the product, not about the
  query, and a client reading them off the searched `count` announces that a product has no
  options the moment a search matches nothing.
- **Admin variants** carry resolved, rank-ordered option values rather than an id map, because
  every admin surface renders labels.
- **Store** keeps the id map, because the picker only ever compares ids and never renders a label
  off a variant — and gets `pickerTargets: Record<variantId, Record<valueId, targetVariantId |
  null>>`, which is the entire selection rule precomputed. A value is unavailable when its target
  is `null` and selected when its target is the current variant.
- The combination math is a pure module inside the product module
  (`modules/product/utils/option-combinations.ts`), unit-tested without a database, and is the
  single source for both the endpoint and the service's duplicate rejection.

## Consequences

The two BFF surfaces deliberately diverge: the same concept has a rich shape on `/admin` and a
lean one on `/store`. That is the point — they ask different questions of it — but it does mean
there is no single wire type for "a variant's options", and any future shared client helper would
have to pick one.

Responses grow. `option-combinations` is `∏ |values|` rows, so it is paginated and searched
server-side like any other list endpoint, with a hard ceiling above which the service refuses
rather than enumerating. `pickerTargets` is variants × values, which is why it ships as a compact
target map instead of expanded picker rows — roughly 60 KB rather than 450 KB for a 100-variant
product.

A variant's title defaults to its combination's label and is only overridden when the caller sends
one, matching how `resolveThumbnail` already defaults a product's thumbnail. Because the title is
copied onto cart line items and order items, deriving it server-side keeps what a shopper sees in
their order history consistent with what the catalogue says.
