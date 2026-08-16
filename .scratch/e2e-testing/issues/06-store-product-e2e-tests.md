# 06 — Store product E2E tests

**What to build:** E2E tests for the store product browsing pages. After this ticket, the store test suite covers the customer product browsing journey: viewing the product list and viewing a product detail page.

**Blocked by:** 04 — Store E2E setup + auth tests

**Status:** ready-for-agent

- [ ] Create `apps/store/tests/e2e/products.spec.ts` using `test` and `expect` from `@proteus/testing` fixtures:
  - Test: product list page — authenticate as customer, seed products via `createProduct()` with `await using`, navigate to `/products`, assert seeded product titles are visible
  - Test: product detail page — authenticate as customer, seed a product via `createProduct()`, navigate to `/products/$productId`, assert correct product title and details are displayed
- [ ] All tests use the customer persona, faker-generated data, and `await using` for teardown
- [ ] Verify: `npm run --workspace=store test:e2e` passes with both auth and product tests
