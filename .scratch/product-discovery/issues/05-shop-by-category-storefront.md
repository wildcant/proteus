# 05 — Shop by category on the storefront

**What to build:** A shopper browses by Category. The header rail lists the top-level visible
Categories; one with children opens a panel listing its visible children and "Shop all <name>", one
without children links straight to its page. On a phone, the side menu nests the same items, and the
footer's Shop column lists "Shop all" and the top-level Categories. `/categories/<handle>` shows the
Category's name and description, a breadcrumb from its ancestors, chips for its visible children, and
the products in it and in its visible descendants, with search, sort and paging. A hidden or unknown
handle shows a not-found state inside the store's header and footer. No category name or handle is
written in storefront code.

Spec: `.scratch/product-discovery/spec.md` — Scope (No shop data in storefront code, Every filter and
sort runs in SQL), Store API, Service › Category rules (Visible), Storefront, Rules.

**Blocked by:** 02 — Storefront product list takes a scope; 04 — Assign products to categories.

**Status:** ready-for-agent

- [ ] A store endpoint returns the visible tree — active, not internal, every ancestor visible — nested,
      with no params.
- [ ] The store product list accepts `category` by handle and includes visible descendants through a
      recursive query in SQL, ANDed with the sellable ids. A hidden Category matches nothing.
- [ ] The tree is fetched once in the main layout's loader and reused by the category page, which makes
      no request of its own for the Category.
- [ ] Rail (large screens only), panel, side menu and footer per the spec. The only Store Copy is "Shop
      all" and "Shop all <name>", with Spanish entries.
- [ ] The category page is server-rendered. Its empty state links to "Shop all", and "Clear search"
      keeps the Category.
- [ ] The not-found state is modelled on the product page's error state, with its own copy.
- [ ] ADR 0013's statement that layout routes have no loaders is updated.
- [ ] Backend journey test: the visible tree, an inactive parent hiding its subtree, the store
      `category` filter including descendants.
- [ ] E2E journey written, not run: nav → category → child chip → product.
- [ ] `pnpm run verify` is green.
