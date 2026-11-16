# 40. On Sale Is Derived from the Price, per Currency

A variant's price can carry a compare-at price, the amount it was before a markdown. A shop wants its
marked-down products on the card, under a filter with a count and in the menu. That could be a sale
Collection filled from the CSV, or a flag kept in step with the prices. Both drift: a markdown that
ends in the price list stays "on sale" until someone resyncs the grouping, and a product marked down
in one market and not in another cannot be in a Collection for one market only.

## Decision

**On sale is read live from the prices.** A product is on sale in a market when a variant a shopper can
buy now (priced in the market's currency, and untracked, backordered or in stock) has a compare-at above
its price in that currency. It is answered in SQL at query time by the store catalogue listing, over the
same priced and stocked variants it lists and stocks by. Nothing is stored and nothing is resynced: a
markdown starts and ends with the price itself.

**The list item carries `salePrice`.** `GET /store/products` returns, per product, the cheapest variant a
shopper can buy now that is marked down, priced with its compare-at and named by its `variantId`
(`StoreSalePrice`), so a card opens on the variant marked down, or `null` when there is none. A cheaper
variant at full price does not hide the markdown, and a sold-out markdown does not count. `startingPrice`
stays the cheapest priced variant's, marked down or not.

**A built-in filter, `price.sale`, with the one value `on`.** `filter=price.sale:on` lists the products on
sale. The dot keeps the key out of the metafield key space (`[a-z0-9_-]`), as `option.<Title>` does. The
facet is counted like any other value, under every other selection and not its own, and is offered only
while its count is above 0, so it never leads to an empty list. The structure file offers it by listing
`price.sale` in `filters`. Its labels («Sale», «On sale») are Proteus's, not the file's, since the key names no
field; the API answers them in English, as it does every response label (only errors are translated), and a
storefront that knows the key says them in its own words.

**A link can filter by it; a rule cannot.** A link's `filter`, and a new top-level menu entry
`{ name, filter }` (the all-products list filtered, served as `{ type: 'products', label, filters }`),
accept `price.sale: [on]`. A Category's or Collection's `rule` does not: a rule picks a grouping's
members when the file is applied, and a price cannot decide membership that has to hold in every market.

## Consequences

- The menu's sale entry is a filtered list, not a Collection: it has no handle, page or badge of its own.
  A shop that wants a sale landing page with its own copy still makes a Collection by hand.
- The price sort orders by the cheapest price while a sale card shows its sale price, so a product can
  sort below the price its card shows.
- Shopify has no URL filter for a markdown, so the Shopify structure manifest leaves a sale entry out of
  the menu; a Shopify store links its own sale collection.
