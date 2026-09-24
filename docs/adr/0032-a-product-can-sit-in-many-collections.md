# 32. A Product Can Sit in Many Collections

A Collection is a hand-picked merchandising group — a season, a campaign, a story — and those overlap:
the same bracelet belongs in "Summer 2026" and "Gifts under $200" at once. So a product joins
Collections through a `product_collection_product` pivot, many-to-many, the same shape as Categories
and Tags. This diverges from Medusa, whose `product.collection_id` is a single nullable foreign key
("A product can be in a single collection"), and follows Shopify, whose `Product.collections` is a
list. Sources are in `docs/research/product-grouping-vocabulary.md`.

## Considered Options

**One Collection per product, as in Medusa.** Rejected: it forces the merchant to pick one story per
product and pushes every second grouping onto Tags or Categories, which blurs what those words mean
(`CONTEXT.md` — Product grouping).

## Consequences

- **No `productCollection` snapshot on line items.** Medusa copies the one collection's title onto
  the line; with several there is no single value to copy, so the column is not added.
- **Soft-deleting a Collection hides its memberships** through the derived cascade, like Tags,
  instead of leaving a dangling `collection_id` on the product.
- **Assigning a product to a Collection never removes it from another.**
