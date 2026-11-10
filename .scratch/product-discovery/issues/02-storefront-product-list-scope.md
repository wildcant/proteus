# 02 — Storefront product list takes a scope

**What to build:** The storefront's product list and its header stop assuming they render on the home
page. They take the list's scope (extra query parameters, such as a category or collection handle), the
heading and the empty-state link as inputs, and the list's search parameter schema lives with the
products feature instead of the home route. The home page passes today's values, so it looks and
behaves exactly as before. This is a refactor that the category, collection and tag tickets build on.

Spec: `.scratch/product-discovery/spec.md` — Storefront › Product list.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] The home page is unchanged: heading, search, sort, paging and both empty states.
- [ ] Another route can render the product list with its own scope, heading and empty-state link,
      without reaching into the home route's search params.
- [ ] Scope parameters are sent with the product list request and survive search, sort and paging.
- [ ] Store-only gate: `pnpm exec biome check --write apps/store/src` and
      `pnpm --filter store run typecheck` pass, then a visual check of `/`.
