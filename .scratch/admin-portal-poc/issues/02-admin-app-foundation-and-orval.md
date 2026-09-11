# 02 — Admin: App foundation and orval pipeline

**What to build:** The admin app boots as a router-only SPA with all infrastructure in place to build features. TanStack Start is fully removed and replaced with TanStack Router + `@tanstack/router-plugin` (file-based routing with `autoCodeSplitting`). UI components come from the shared `@proteus/ui` workspace package (shadcn/ui with Base UI adapter) — no local shadcn init needed. An orval config generates typed product API client functions from the backend's OpenAPI spec. A Web Fetch fetcher, query key factory, and QueryClient are configured. Product React Query wrapper hooks are created with hierarchical cache invalidation. Visiting the app shows the root route with devtools — proving the pipeline from backend OpenAPI spec to generated client to query hooks works end-to-end.

**Blocked by:** 01 — Backend: Product admin API and tests

**Status:** ready-for-agent

**Reference files to study:**

- Proteus — shared UI package (use, don't reinitialize):
  - `packages/ui/package.json` — `@proteus/ui` workspace package with shadcn/ui + Base UI adapter
  - `packages/ui/src/index.ts` — exported components (Button, Card, Field, Input, Label, Separator, cn)
  - `packages/ui/src/styles.css` — shadcn theme variables (light + dark)
- Proteus — existing frontend patterns (replicate for admin):
  - `apps/frontend/src/styles.css` — how frontend imports `@proteus/ui/styles.css` and uses `@source` for Tailwind scanning
  - `apps/frontend/orval.config.ts` — orval config to copy and adapt (change target to `openapi-admin.json`)
  - `apps/frontend/src/api/fetcher.ts` — Web Fetch client to replicate
  - `apps/frontend/src/lib/query-key-factory.ts` — query key factory to replicate
- Proteus — existing admin app files (already partially set up):
  - `apps/admin/src/main.tsx` — SPA entry point (already created)
  - `apps/admin/src/router.tsx` — router with QueryClient in context (already created)
  - `apps/admin/src/routes/__root.tsx` — root route with devtools (already created)
  - `apps/admin/package.json` — dependencies to verify/update

- [ ] TanStack Start fully removed: no `@tanstack/react-start` in dependencies, vite config uses `tanstackRouter()` from `@tanstack/router-plugin/vite` instead of `tanstackStart()`
- [ ] `index.html` exists with `<div id="app">` and `<script type="module" src="/src/main.tsx">`
- [ ] `src/main.tsx` renders `RouterProvider` via `ReactDOM.createRoot`
- [ ] `src/router.tsx` creates router with `QueryClient` in context (`staleTime: 90_000, retry: 1`)
- [ ] `src/routes/__root.tsx` uses `createRootRouteWithContext<{ queryClient: QueryClient }>()`, renders `QueryClientProvider` and devtools
- [ ] `@proteus/ui` added as workspace dependency — components imported from `@proteus/ui`, no local shadcn init or `components.json`
- [ ] `src/styles.css` imports `@proteus/ui/styles.css` and adds `@source` pointing to the UI package (same pattern as `apps/frontend/src/styles.css`)
- [ ] `orval.config.ts` targets `../backend/openapi/openapi-admin.json`, generates to `src/api/generated/admin/`, uses custom fetcher, mode `tags-split`
- [ ] `src/lib/fetcher.ts` implements Web Fetch client with `VITE_BACKEND_URL` resolution (same pattern as frontend's fetcher)
- [ ] `src/lib/query-key-factory.ts` exports `queryKeysFactory(globalKey)` returning `all`, `lists`, `list`, `details`, `detail` key builders
- [ ] Generated client functions exist at `src/api/generated/admin/products/`
- [ ] `src/features/products/api/products.ts` exports `productQueryOptions(id)`, `productsListQueryOptions(params)`, `useProducts()`, `useProduct()`, `useCreateProduct()`, `useUpdateProduct()`, `useDeleteProduct()`
- [ ] Mutation hooks auto-invalidate relevant query keys on success (lists after create/delete, detail + lists after update)
- [ ] `pnpm run dev` starts the admin app and renders the root route without errors
