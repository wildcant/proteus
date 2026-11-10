# 11 — Filter by tag on the storefront

**What to build:** A shopper narrows any product list — home, category or collection — by Tag. Above
the list, chips show the Tag values found on the products in view for the current search, Category or
Collection. Choosing a chip adds its value to the URL; several chips mean any of them; a chosen chip
can be removed. The values come from data, so the same code serves any shop.

Spec: `.scratch/product-discovery/spec.md` — Scope (Every filter and sort runs in SQL), Service (Tag
values in view), Store API, Storefront › Tag filter, Rules.

**Blocked by:** 05 — Shop by category on the storefront; 08 — Collection pages on the storefront;
10 — Tags in the admin.

**Status:** ready-for-agent

- [ ] The store product list accepts a repeatable `tag` by value: any of the values, ANDed with the
      other filters, in SQL.
- [ ] The "sellable in this market" step moves into a helper that both store product routes call; the
      product list behaves as before.
- [ ] A store endpoint takes the market's country code, search, Category and Collection, and returns the
      Tag values on the products that list would show, ignoring any tag filter — one distinct query.
- [ ] Chips on the home, category and collection lists; chosen chips are removable and survive search,
      sort and paging. Spanish entries for every string.
- [ ] Backend journey test: two tags match either, tag values ignore the tag filter itself, tag values
      follow the Category scope.
- [ ] E2E journey written, not run: choose two chips, then remove one.
- [ ] `pnpm run verify` is green.
