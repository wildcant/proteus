# 08 — Collection pages on the storefront

**What to build:** A shopper opens `/collections/<handle>` and sees a hero with the Collection's title
and thumbnail, then its products with search, sort and paging. An unknown handle shows the store's
not-found state. Nothing links to collection pages from the navigation yet — that arrives with the
Navigation Menu spec — so the page is reached by its URL or by links merchants place elsewhere.

Spec: `.scratch/product-discovery/spec.md` — Store API, Storefront › Collection page.

**Blocked by:** 02 — Storefront product list takes a scope; 05 — Shop by category on the storefront
(reuses its not-found state and route patterns); 07 — Collections in the admin.

**Status:** ready-for-agent

- [ ] The store collections endpoint accepts one handle or several.
- [ ] The store product list accepts `collection` by handle, in SQL, ANDed with the sellable ids and the
      other filters.
- [ ] The collection page is server-rendered and loads the Collection and its products in parallel. Its
      empty state links to "Shop all".
- [ ] An unknown handle shows the not-found state from ticket 05, with collection copy and Spanish
      entries.
- [ ] Backend journey test covers the store `collection` filter.
- [ ] E2E journey written, not run: open a collection page and see its products.
- [ ] `pnpm run verify` is green.
