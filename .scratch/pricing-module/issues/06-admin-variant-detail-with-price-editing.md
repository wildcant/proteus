# 06 — Admin variant detail page with price editing

**What to build:** Admin can click a variant row in the product detail page to navigate to a variant detail page, see the current USD price in the sidebar, and click "Edit prices" to open a DataGrid-based modal where they can change the price and save.

**Variant detail page** (new route `/products/$id/variants/$variantId`): two-column layout. Main column has a general section showing the variant title, SKU, barcode, and options. Sidebar has a Prices section displaying "USD $XX.XX" with a "..." action menu containing "Edit prices".

**Price edit modal** (child route `/products/$id/variants/$variantId/prices`): opens a `RouteFocusModal` containing a DataGrid with a single "Price USD" column (for MVP). Pre-populated from existing variant prices. On save, diffs current vs initial and calls the variant update endpoint with the `prices` payload. Unsaved changes guard via `RouteModalForm`.

**Variant table changes**: variant rows in the product detail page become clickable (rowHref linking to the detail page) and get rowActions with Edit/Delete options.

File structure:

```
apps/admin/src/routes/_authed/_shell/products/$id/variants/$variantId/
  route.tsx                    (variant detail page)
  prices/route.tsx             (price edit modal)

apps/admin/src/features/products/
  components/variant-prices-section.tsx    (sidebar prices display)
  hooks/use-variant-prices-form.ts         (price edit form logic)
  api/product-variant-prices.ts            (React Query hooks for price mutations)
```

Modified files:

- `apps/admin/src/features/products/hooks/use-variant-table.tsx` — add `rowHref: (row) => \`variants/${row.id}\`` and `rowActions` with Edit/Delete
- `apps/admin/src/features/products/api/product-variants.ts` — ensure variant detail query returns prices

Follow the product detail route pattern (`apps/admin/src/routes/_authed/_shell/products/$id/route.tsx`) for `beforeLoad`, `pendingComponent`, and breadcrumb setup.

**Blocked by:** 03 — Admin variant API with inline prices, 05 — DataGrid component

**Status:** ready-for-agent

- [ ] Variant detail route created at `routes/_authed/_shell/products/$id/variants/$variantId/route.tsx` with two-column layout (main + sidebar)
- [ ] General section displays variant title, SKU, barcode, options
- [ ] Prices sidebar section (`variant-prices-section.tsx`) shows current USD price with "..." action menu
- [ ] "Edit prices" action navigates to the prices child route
- [ ] Price edit modal at `variants/$variantId/prices/route.tsx` uses `RouteFocusModal` with DataGrid (single "Price USD" column for MVP)
- [ ] DataGrid pre-populated from existing variant prices via the variant detail API
- [ ] On save: diff produces correct create/update/delete payload, calls variant update endpoint
- [ ] Unsaved changes guard via `RouteModalForm` + `useBlocker()`
- [ ] Variant table in product detail page: `rowHref: (row) => \`variants/${row.id}\``, `rowActions` with Edit/Delete
- [ ] React Query hook `useUpdateVariantPrices(productId, variantId)` in `api/product-variant-prices.ts` with cache invalidation (variant detail, variant list, product detail)
- [ ] Route tree regenerated (`generate-routes`)
