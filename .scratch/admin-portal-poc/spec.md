# Admin Portal POC: Product domain with Medusa-style architecture on TanStack Router

## Problem Statement

The project needs an admin portal for managing commerce data (products, orders, customers, etc.). The existing `apps/admin` workspace was scaffolded with TanStack Start but has no functionality — no pages, no data layer, no layout. The team has documented a target architecture (ADMIN-ARCHITECTURE-TANSTACK.md) adapting Medusa's battle-tested admin dashboard patterns to TanStack Router, but none of it is implemented. Without a working POC that proves the core patterns end-to-end — DataTable, detail pages, route-based modals, query integration, shell layout — there is no foundation to build further domains on.

## Solution

Build a Product domain POC in `apps/admin` that proves every architectural building block from the target architecture. The POC uses TanStack Router (file-based, router-only), TanStack Query (with orval-generated client), TanStack Form + zod, TanStack Table (via a custom DataTable system), and shadcn/ui Base UI edition — all styled to match Medusa's admin aesthetic. The product domain exercises: list page with URL-driven DataTable, detail page with two-column layout, create form in a full-screen modal, edit form in a slide-in drawer, and a feature-complete shell (sidebar, topbar, breadcrumbs). Backend admin API routes for products are added to support the frontend.

## User Stories

1. As an admin user, I want to see a list of products in a paginated table, so that I can browse the product catalog
2. As an admin user, I want to search products by title or handle using a search input, so that I can quickly find specific products
3. As an admin user, I want to filter products by status (draft, published, proposed, rejected), so that I can focus on products in a particular state
4. As an admin user, I want to filter products by creation date range, so that I can find recently added products
5. As an admin user, I want to sort the product table by any sortable column, so that I can organize the list by what matters to me
6. As an admin user, I want the table's pagination, search, filters, and sort to be reflected in the URL, so that I can bookmark or share a specific view
7. As an admin user, I want to click a product row to navigate to its detail page, so that I can see full product information
8. As an admin user, I want to see product details in a two-column layout with sections (general info, metadata), so that information is organized clearly
9. As an admin user, I want to see breadcrumbs showing "Products / Product Title", so that I know where I am and can navigate back
10. As an admin user, I want a "Create Product" button that opens a full-screen overlay modal, so that I can add new products
11. As an admin user, I want to fill in a product title in the create form and submit it, so that a new product is created
12. As an admin user, I want to be warned if I try to close the create form with unsaved changes, so that I don't accidentally lose my input
13. As an admin user, I want an "Edit" action on the product detail page that opens a slide-in drawer, so that I can quickly update the product title
14. As an admin user, I want the edit drawer to warn me about unsaved changes before closing, so that I don't lose edits
15. As an admin user, I want a "Delete" action in the product detail page's action menu, so that I can remove products
16. As an admin user, I want the product list to automatically refresh after I create, edit, or delete a product, so that the data is always current
17. As an admin user, I want a persistent sidebar with navigation links, so that I can move between different admin sections
18. As an admin user, I want the sidebar to be collapsible, so that I can maximize content area when needed
19. As an admin user, I want a topbar with context information, so that the admin feels like a complete application
20. As an admin user, I want active filter chips displayed below the toolbar, so that I can see and remove active filters
21. As an admin user, I want the table to show an empty state when no products exist, so that I understand the page is working but has no data
22. As an admin user, I want the table to show a "no results" state when filters produce no matches, so that I know to adjust my filters
23. As an admin user, I want a per-row action menu (kebab) with edit and delete options, so that I can act on individual products from the list
24. As an admin user, I want the create and edit modals to be URL-addressable routes (`/products/create`, `/products/:id/edit`), so that I can link directly to them
25. As an admin user, I want a skeleton loading state while product data is being fetched, so that the page feels responsive
26. As an admin user, I want an auth layout group that will gate access to the admin, so that when auth is implemented next the route structure is ready
27. As an admin user, I want a login page stub under a public layout, so that the auth flow has a target route ready
28. As a developer, I want the DataTable component to support prefix namespacing for URL params, so that multiple tables can coexist on one page in the future
29. As a developer, I want type-safe column and filter helpers (`createDataTableColumnHelper`, `createDataTableFilterHelper`), so that table definitions are checked at compile time
30. As a developer, I want reusable date column and date filter helpers, so that every entity with timestamps gets consistent table behavior
31. As a developer, I want the orval pipeline to generate typed API client functions from the backend's OpenAPI spec, so that frontend-backend contracts are always in sync
32. As a developer, I want query key factory and React Query wrapper hooks per domain, so that cache invalidation is hierarchical and predictable

## Implementation Decisions

### Framework and Routing

- The admin app uses **TanStack Router** (router-only, no TanStack Start). The Start framework was removed because the admin is a pure client-side SPA that talks to an external backend via generated API functions — no server functions, no SSR needed.
- File-based routing with `@tanstack/router-plugin` (Vite plugin with `autoCodeSplitting: true`).
- Route files live at `src/routes/` (flat, matching TanStack Router defaults). No `src/app/` wrapper directory.

### Layout Groups

- Three pathless layout route groups: `_authed` (auth guard via `beforeLoad`), `_shell` (sidebar + topbar + breadcrumbs), `_public` (minimal layout for login stub).
- `_authed` includes a placeholder `beforeLoad` that always passes — ready for real auth implementation (next on the roadmap).
- `_shell` is nested inside `_authed`. Product routes live at `_authed/_shell/products/`.

### Shell Layout

- Feature-complete shell using **shadcn/ui Base UI edition** components: `Sidebar` (collapsible), `Breadcrumb`, and custom topbar.
- Styled to match Medusa's admin aesthetic — clean, minimal, professional.
- Breadcrumbs use `staticData` for static labels ("Products") and `beforeLoad` context for dynamic labels (product title).

### Data Layer — Backend

- Five admin API endpoints added to the existing backend:
  - `GET /admin/products` — list with pagination, sorting, search (`q` via ILIKE on title/handle), status filter, created_at filter
  - `POST /admin/products` — create (title only for POC, handle auto-generated)
  - `GET /admin/products/:id` — retrieve single product
  - `PATCH /admin/products/:id` — update (title only for POC)
  - `DELETE /admin/products/:id` — soft delete
- **Product HTTP schemas** added to `packages/http-schemas/src/product/` following the existing customer pattern: entities, payloads, queries, responses with `.openapi()` annotations.
- **Free-text search** implemented as a utility function `buildSearchFilter(q, searchableColumns)` that tokenizes the query by whitespace and produces `$and`/`$or`/`$ilike` filter shapes compatible with the existing `buildFilters` system. Multi-word queries require each token to match at least one searchable column. No changes to `BaseRepository` or `buildFilters` needed.
- OpenAPI spec regenerated via `openapi-dump.ts` (add product middleware imports) to produce updated `openapi-admin.json`.

### Data Layer — Frontend

- **Orval config** in `apps/admin/orval.config.ts` targeting `../backend/openapi/openapi-admin.json` (admin spec only). Self-contained pipeline independent from `apps/frontend`.
- **Custom fetcher** at `src/lib/fetcher.ts` using Web Fetch API (same pattern as frontend's fetcher).
- Generated client functions at `src/api/generated/admin/`.
- **Query key factory** at `src/lib/query-key-factory.ts` — hierarchical cache keys (`[domain, "list", query]`, `[domain, "detail", id]`).
- **React Query wrappers** at `src/features/products/api/products.ts` — `productQueryOptions()`, `productsListQueryOptions()`, `useProducts()`, `useProduct()`, `useCreateProduct()`, `useUpdateProduct()`, `useDeleteProduct()`. Mutations auto-invalidate relevant cache keys. Wrappers import and call orval-generated functions.

### DataTable System

- Custom three-layer DataTable inspired by Medusa's architecture (documented in DATATABLE-DEEP-DIVE.md), built from scratch using shadcn/ui Base UI components — not a port of Medusa's code:

  - **Layer 1 — `useDataTable` hook + compound components**: Creates a TanStack Table instance with manual sorting, pagination, filtering. State bridging between TanStack Table's internal formats and flat app-level state. Compound components: `DataTable`, `DataTable.Toolbar`, `DataTable.Search`, `DataTable.FilterMenu`, `DataTable.FilterBar`, `DataTable.SortingMenu`, `DataTable.Table`, `DataTable.Pagination`. Empty state derivation (POPULATED / FILTERED_EMPTY / EMPTY).

  - **Layer 2 — URL-stateful wrapper**: The `DataTable` component owns URL state via `Route.useSearch()` and `navigate({ search })` (coupled to TanStack Router — this is an app component, not a library). Handles parsing/serializing pagination (offset ↔ pageIndex), sorting (`-field` for desc), search (`q`), and filtering (JSON stringified values). Supports prefix namespacing for multi-table pages.

  - **Layer 3 — Route-level composition**: Each domain provides `useProductTableColumns()`, `useProductTableFilters()` hooks. Route defines `validateSearch` with a Zod schema. Route renders `<ProductListTable>` which calls the hooks and renders `<DataTable>`.

- **Type-safe builders**: `createDataTableColumnHelper<T>()` (wraps TanStack's `createColumnHelper`, adds `.action()` for per-row kebab menus), `createDataTableFilterHelper<T>()` (returns `.accessor()` with `DeepKeys<T>` type safety).

- **Shared helpers**: `useDataTableDateColumns<T>()` and `useDataTableDateFilters()` for reusable timestamp columns and filters.

- **Filter types included**: `select` (multi-select checkbox list), `date` (presets + custom range), `radio` (single-select). Other types (string, number, custom) deferred.

- **Features cut**: Row selection, CommandBar (bulk actions), column visibility menu, column ordering/DnD, feature flag gating, view selector.

### Route-Based Modals

- Both modal types built on **shadcn Drawer** component:
  - **RouteFocusModal** — full-screen overlay variant (for product create at `/products/create`)
  - **RouteDrawer** — slide-in panel via `swipeDirection="right"` (for product edit at `/products/$id/edit`)
- **RouteModalForm** wrapper provides dirty-form blocking via TanStack Router's `useBlocker({ shouldBlockFn, withResolver, enableBeforeUnload })`. Shows a confirmation dialog when navigating away from dirty form.
- Modal close navigates via `navigate({ to: ".." })`.

### Forms

- **TanStack Form** + **zod** (validation schemas imported from `@proteus/http-schemas`).
- No compound Form component — use `form.Field` directly with the `TextField` pattern established in `apps/frontend/src/components/form/text-field.tsx` (field context + shadcn Input + FieldError).
- POC forms are dead simple: single title field for both create and edit. Complex form architecture to be designed later with real requirements.

### Detail Page

- Two-column layout component (`TwoColumnPage` with `.Main` and `.Sidebar` compound children).
- `ProductGeneralSection` showing title, handle, status, description in a section with `SectionRow` components.
- `ActionMenu` with Edit (navigates to `./edit`) and Delete actions.
- Product data loaded via route `loader` using `queryClient.ensureQueryData(productQueryOptions(id))`.
- `pendingComponent` renders a skeleton while the loader runs.

### UI Components

- All UI primitives from **shadcn/ui Base UI edition** (`pnpm dlx shadcn@latest init` with Base UI adapter).
- Components needed: Button, Input, Badge, Table, DropdownMenu (for ActionMenu), Drawer (for modals), Sidebar, Breadcrumb, Popover (for filter chips), Select, Skeleton.
- `ActionMenu` component wraps shadcn DropdownMenu with discriminated union action type: `{ to: string }` (link) or `{ onClick }` (handler), plus `icon`, `label`, optional `disabled`.
- `SectionRow` component: title/value grid for detail page sections.

### Project Structure

Follows Bulletproof React: shared (`src/components/`, `src/hooks/`, `src/lib/`) → features (`src/features/products/`) → app (`src/routes/`). No dependency-cruiser enforcement for the POC (deferred until multiple features exist). No barrel files.

## Testing Decisions

- **Good tests** test external behavior through the service interface, not implementation details like repository SQL or internal state. They use realistic data via factory fixtures and assert on return values and side effects (e.g., soft-deleted records excluded from subsequent list calls).

- **Backend product service tests**: Test `ProductModuleService` methods (`listProducts`, `createProducts`, `updateProducts`, `deleteProducts`) using the existing Vitest fixtures pattern (`getDb`, `dto.generate`, `logger`). Key scenarios: list with pagination, list with `q` search (multi-word tokenization), list with status filter, list with created_at range filter, create with auto-generated handle, update, soft delete (verify excluded from list), retrieve by ID. Prior art: `user-module-service.test.ts`, `customer-module-service.test.ts`.

- **No frontend tests for the POC**: The admin app has no test infrastructure yet and the POC is primarily composition (wiring generated client to query hooks, rendering shadcn components). A frontend test seam will be added when there is meaningful business logic to test beyond rendering.

## Out of Scope

- **Real authentication** — `_authed` layout has a placeholder guard. Auth is next on the roadmap and will use the `beforeLoad` + `throw redirect()` pattern already stubbed.
- **Complex product forms** — variants, options, images, multi-section forms. The POC uses title-only forms intentionally so real form architecture can be designed from scratch with actual requirements.
- **Row selection and bulk actions** — CommandBar, `columnHelper.select()`, bulk delete/update.
- **Column visibility and ordering** — DnD column reorder, visibility toggles.
- **String, number, and custom filter types** — only select, date, and radio filters included.
- **dependency-cruiser** — import boundary enforcement deferred until multiple features exist.
- **i18n** — no internationalization in the POC.
- **Multiple domains** — only the product domain is implemented. Orders, customers, etc. will follow the same patterns.
- **Shared UI package extraction** — form primitives and common components stay duplicated in admin for now, to be extracted when patterns stabilize.

## Further Notes

- The backend product module already exists with full service layer, 5 tables, and store API routes. The backend work for this POC is limited to: adding admin route handlers, adding product HTTP schemas, updating the OpenAPI dump script, and implementing the `buildSearchFilter` utility.
- The `buildSearchFilter` utility generates filter shapes compatible with the existing `buildFilters` system — no changes to `BaseRepository` needed. Searchable columns are declared as a constant array at the service level, not via model decorators.
- The orval pipeline for admin is independent from frontend's. Both read from the same `openapi-admin.json` artifact but have separate configs, fetchers, and generated output directories.
- The DataTable's URL state management uses TanStack Router's `validateSearch` (Zod schema on the route) instead of Medusa's `useQueryParams` hook. This eliminates the need for per-domain `useXxxTableQuery` hooks — the Zod schema handles all parsing and coercion. The `@tanstack/zod-adapter`'s `fallback()` function provides defaults for missing URL params.
- Route files are thin orchestrators. Domain logic (components, query options, column definitions, filter definitions) lives in `src/features/products/`. This separation is the Bulletproof React principle: shared → features → app.
