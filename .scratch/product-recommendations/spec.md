# Related Products

**Status:** built on `feat/product-recommendations`. Drafted from the Shopify Product Recommendations
API and Search & Discovery app docs, Medusa v2 source and the current codebase. Where they diverge, the
choice is named. Nothing here is open.

## Scope

A product page's related row: the products most like the one in view, as a Computed List — derived
on every read, never stored. "Like" is a weighted list of what two products share, written in the
structure file, so a sneaker shop relates by model and style and a hardware shop by type and brand
with the same code.

Out of scope:

- Complementary products ("pairs well with"), which a merchant picks by hand.
- Any purchase or browsing signal (bought together, viewed together). Sales-ranked lists stay
  deferred with Best Sellers.
- A row per Category or Collection page. The parameter works on any list, but only the product page
  asks for it.

## Why

The storefront's product page draws a related row ("También te puede gustar", and "Parecidos con
tallas disponibles" when the pair is sold out). No read could fill it.

## How Medusa does it

It doesn't. Medusa v2 has no recommendations module or endpoint; storefronts list the same
Collection or Category through the product list.

## How Shopify does it

`/recommendations/products.json?product_id=…&intent=related|complementary`, up to 10 products.
`related` is automatic (purchase history, then description and collections); `complementary` is
hand-picked in Search & Discovery, which can also override the related list. Sold-out products are
left out by default.

**Divergence, named:** related products here are rule-based, not learned, because a new shop has no
history to learn from and a rule is predictable. Sold-out products stay in unless the caller asks
(`available=true`), because the list's own rule is that a sold-out product keeps its place; the page
asks when the pair in view is sold out.

## Design

### Structure file

```yaml
related:
  - { key: modelo, weight: 4 }
  - { key: estilo, weight: 2 }
  - { key: category, weight: 1 }
  - { key: option.Color, weight: 1 }
```

Each match adds its `weight` when the two products share it:

| `key` | Shared when |
|---|---|
| a field's key | a value of that field, through its source (metafield value, brand, type), as the filter reads it |
| `category` | a Category both are direct members of |
| `type` | the same Product Type |
| `brand` | the same brand, ignoring case |
| `option.<Title>` | a value of that option both offer, by bucket where it has buckets |

Stored on `store.related` (jsonb, `null` = no `related` in the file), written and compensated by
`apply-catalog-structure` with `filters` and `card`.

**Default match** when the file names none: `category` 2, `type` 1, `brand` 1
(`core/utils/related-match.ts`). The Category is the merchant's own shelf, so it weighs most; type and
brand exist in every catalogue, so a shop gets a sensible row with no configuration.

### API

Two parameters on `GET /store/products`, rather than a second route: the related row is a product
list, and every list parameter (pagination, `filter`, price, market) already applies.

| Param | Meaning |
|---|---|
| `similarTo=<handle>` | Ranks by likeness to that product, then by `order`. Leaves out the product itself and any product sharing nothing. An unknown handle matches nothing. |
| `available=true` | Lists only products with a variant a shopper can buy now. |

The response is the list's: same cards, `count` of the ranked list.

### SQL

`productSimilarity(sourceId, match)` (`modules/product/utils/product-similarity.ts`, beside
`productWhere`) is a score expression over `product`: one `CASE WHEN <shares> THEN weight` per match.
`StoreCatalogListingRepository.listStoreProducts` adds it to the `WHERE` (`> 0`, not the source) and
leads the `ORDER BY` with it, so ranking, paging and counting stay one query. `available` reuses the
purchasable-variant `EXISTS` the page already computes.

## Rules

- A `related` key is listed once; it is a declared field key, `category`, `type`, `brand` or
  `option.<Title>`; its weight is a whole number of at least 1.
- Ties fall back to the list's order (`newest` without a search), then id.
- The source product needs no price in the market; the related products do.

## Testing

- `product.api.test.ts`, "GET /store/products similarTo": one journey — the default match, then a
  configured one (field, Category, option bucket), `available=true`, `filter=`, paging, the market and
  an unknown handle.
- `catalog-structure.test.ts`: reading `related`, and refusing a repeated, unknown or weightless match.
