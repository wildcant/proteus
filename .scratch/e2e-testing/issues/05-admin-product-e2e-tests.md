# 05 — Admin product E2E tests

**What to build:** E2E tests for the admin product management pages. After this ticket, the admin test suite covers the core product CRUD journey: listing products, creating a new product, viewing product details, and navigating to variants.

**Blocked by:** 03 — Admin E2E setup + auth tests

**Status:** ready-for-agent

- [ ] Create `apps/admin/tests/e2e/products.spec.ts` using `test` and `expect` from `@proteus/testing` fixtures:
  - Test: product list page — authenticate as admin, seed products via `createProduct()` with `await using`, navigate to `/products`, assert seeded product titles are visible in the list
  - Test: create product — authenticate as admin, navigate to `/products/create`, fill the product form, submit, assert success feedback and the new product appears (use `cleanup` fixture for the app-created product)
  - Test: product detail page — authenticate as admin, seed a product via `createProduct()`, navigate to `/products/$id`, assert correct product title and details are displayed
  - Test: variant navigation — authenticate as admin, seed a product, navigate to its detail page, navigate to a variant page, assert the variant view loads
- [ ] All tests use the admin persona (no re-login), faker-generated data (no collisions), and `await using` or `cleanup` for teardown
- [ ] Verify: `npm run --workspace=admin test:e2e` passes with both auth and product tests
