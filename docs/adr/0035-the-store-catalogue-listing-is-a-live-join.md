# 35. The Store Catalogue Listing Is a Live Join

**Status:** Accepted

The store's product list (`GET /store/products`) and its filters (`GET /store/product-filters`) are read
by one link-modules repository, `storeCatalogListing`, that joins product, variant, pricing and inventory
tables per request. Postgres filters, sorts, pages and counts; the route reads back one page of ids and
draws the cards from page-scoped reads. The rule it serves is in
[routes](../../standards/rules/backend/api/__docs__/routes.md#a-store-list-filters-sorts-pages-and-counts-in-sql).

## Context

Price and stock decide what the store list holds and in what order, and neither is a product column. A
price is a `price` row reached through the variant's price set in the market's currency; a stock answer
is a sum over Inventory Levels against each link's required quantity. Each lives in its own module
(ADR 0001), and modules do not import each other's tables.

Asked module by module, the list had to read every variant in the catalogue, look up every price set,
price them in JavaScript, and then hand the product query an `id IN (...)` list of everything sellable —
on every request. The price range, the price sorts and the relevance sort ran in memory over every
matching product, and the count was the length of an array. A ten-thousand-product shop paid thirty
thousand variant rows per list request, and the cost grew with the catalogue rather than the page.

## Decision

**A live join, under the ADR 0004 escape hatch.** `link-modules/repositories/store-catalog-listing.ts`
is a readonly link repository, the same kind of cross-module read as `listVariantStockAndCount`:

- `listStoreProducts` — one query. A `priced_variant` subquery joins variant, price-set link and price
  in the market's currency; the product rows are narrowed by the product module's own `WHERE`
  (`productWhere`, so a grouping filter or search matches here exactly what the product list would),
  grouped per product for the starting price, kept by a `HAVING` when any priced variant is in the
  price range, ordered (`relevance`, `newest`, `priceAsc`, `priceDesc`, each ending newest then id),
  and cut with `LIMIT/OFFSET`, the count from `COUNT(*) OVER ()`. Whether each product can be bought is
  read after the cut, for the page alone.
- `listStoreFacets` — the parts of the filters that read price, stock or colour: the price slider's
  bounds, the option values some purchasable variant in scope still carries, and each colour family's
  count.
- `sellableProductIds` — the market's catalogue as a SQL subquery. The product module's facet counts,
  the navigation's values and the tag chips take it as `sellableProductIds` / `selectedProductIds`
  instead of an id list, so they stay in the product module and still never load the catalogue.

## Considered options

**A projection table** — one row per product and market with its starting price, stock answer and
colour families, kept fresh by subscribers. Reads would be a single-table scan. It needs a refresh on
every price, variant, status, option, grouping and stock change, and none of those emits an event
today; a missed one serves a stale list with no error anywhere. Rejected for now.

**Pricing and inventory answering by id list.** What the route did: each module stays ignorant of the
others, and the route stitches. It is the design that cost a catalogue read per request.

## Consequences

- **Always fresh, no new table, no refresh events.** The query reads the rows the admin writes.
- **The cost is a scan of the market's priced variants per request.** Measured on 10 000 products ×
  3 variants: ~75 ms for a deep page under any sort, ~90 ms for the facets. That is fine at this
  catalogue size and grows linearly with it.
- **A SQL fragment crosses the product service boundary.** `sellableProductIds` is built in
  link-modules and passed through `FilterableProductProps` to the product repository. It keeps the
  facet counts in one query each without the product module knowing pricing exists; the product
  module only ever embeds it as `id IN (subquery)`.
- **Revisit** when a list page's query passes ~200 ms at the shop's real catalogue size, or when
  price rules or price lists make a price more than a row per currency. A projection can then replace
  the subquery behind the same repository methods, and the routes do not change.
