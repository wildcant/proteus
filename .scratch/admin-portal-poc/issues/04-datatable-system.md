# 04 — Admin: DataTable system + Product list page

**What to build:** A reusable, URL-driven DataTable following the spec at `.scratch/admin-portal-poc/table-spec.md` — proven end-to-end by a real product list page backed by live API data.

The consumer API is `useDefineTable<T>(config)` + `<DataTable use={table} />`. One config object defines data fetching, columns, filters, row actions, and empty states. The DataTable handles URL state internally via TanStack Router (`useSearch({ strict: false })` + `navigate({ search })`), TanStack Table with `manual*` flags, search debounce, auto page reset, and empty state derivation.

**Product list page (the proof):** Navigating to `/products` shows a fully functional table with real backend data — search, sorting, filtering, pagination all round-tripping through the URL and producing correct API calls.

**Blocked by:** 02 — Admin: App foundation and orval pipeline, 03 — Shell layout with layout groups

**Status:** ready-for-agent

## Primary reference

**`.scratch/admin-portal-poc/table-spec.md`** — the canonical spec. Covers the full consumer API, internal architecture, URL state encoding, filter rendering, toolbar/search/sorting, renderer system, and file structure. Read this first; it replaces the Medusa source files as the primary guide.

## Prerequisites — UI components to add to `@proteus/ui`

These components are needed by the DataTable but don't exist in `@proteus/ui` yet. Install via `pnpm dlx shadcn@latest add <name>` into `packages/ui`, then export from `packages/ui/src/index.ts`.

- [ ] `DropdownMenu` — used by SortingMenu, FilterMenu, per-row action menu (kebab)
- [ ] `Popover` — used by FilterPill to host filter content popovers
- [ ] `Badge` — used by status column renderer and filter display values
- [ ] `Checkbox` — used by multiselect filter content and row selection

Already available in `@proteus/ui`: `Table` (+ TableHeader, TableBody, TableRow, TableHead, TableCell), `Skeleton`, `Tooltip`, `Input`, `Button`, `Separator`.

## Acceptance criteria

### `useDefineTable<T>(config)` hook

- [ ] Accepts `useData`, `columns`, `filters`, `prefix`, `pageSize`, `paramMap`, `getRowId`, `rowHref`, `rowActions`, `empty`, `filtered`, `defaultSort`, `defaultFilters` — per spec
- [ ] Returns a memoized `TableDefinition<T>` consumed by `<DataTable>`
- [ ] `useData(params)` is called during render with computed `DataParams` (offset, limit, order, q, plus active filter values with `paramMap` remapping applied)
- [ ] `columns(col)` builder provides `col.accessor(key, opts)` with `DeepKeys<T>` type safety and `col.display(id, opts)` for computed columns
- [ ] `filters(filter)` builder provides `filter.accessor(key, opts)` with `DeepKeys<T>` type safety

### `<DataTable use={table} />` component

- [ ] Renders toolbar (heading, search, filter menu, sorting menu, action buttons), filter bar, table, and pagination
- [ ] Toolbar layout: heading left, controls right — matches spec diagram
- [ ] `heading` and `actions` props on `<DataTable>` for title text and action buttons

### URL state (via TanStack Router)

- [ ] `useUrlState` hook reads via `useSearch({ strict: false })`, writes via `navigate({ to: ".", search: (prev) => ... })` — uses TanStack Router natively, no `URLSearchParams`
- [ ] Each route using DataTable defines a `validateSearch` schema (reuse API query schemas from `@proteus/http-schemas` where possible, e.g. `AdminProductListParams`)
- [ ] Pagination as `offset` (integer), sorting as `field` or `-field`, search as `q`
- [ ] Filter values use TanStack Router's native JSON-first serialization — no custom string encoding
- [ ] Prefix namespacing: all URL keys can be prefixed as `{prefix}_{key}`
- [ ] Auto page reset: sort/filter/search changes reset offset to 0

### Search

- [ ] Debounced input (default 300ms), writes `q` to URL
- [ ] Syncs back when URL changes externally (browser back)

### Sorting menu

- [ ] Dropdown with two sections: sortable columns (from `sortable: true` on column defs), then direction (asc/desc)
- [ ] Labels from `sortLabel`, `sortAscLabel`, `sortDescLabel` on column defs with sensible defaults

### Filters

- [ ] `select` filter: single-select option list in a popover
- [ ] `multiselect` filter: searchable checkbox list in a popover
- [ ] `date` filter: preset buttons (if configured) + custom start/end date pickers
- [ ] `radio` filter: single-select list with dot indicator
- [ ] FilterPill: shared shell rendering `[label] [is] [displayValue] [x]` with popover for type-specific content
- [ ] FilterBar: renders active FilterPills + "Clear all" button
- [ ] FilterMenu: dropdown listing available (not yet active) filters; clicking one adds it and opens its popover

### Table rendering

- [ ] Uses `@proteus/ui` Table primitives (TableHeader, TableBody, TableRow, TableHead, TableCell)
- [ ] TanStack Table with `manualPagination`, `manualSorting`, `manualFiltering`
- [ ] Cell rendering resolves: `cell` function > `render` string (global registry) > text fallback
- [ ] `configureDataTable({ renderers })` for global renderer registry, called once at app boot
- [ ] Truncated cell tooltip: hover shows full value when text overflows (opt-out via `truncateTooltip: false`)
- [ ] Row click handling: normal click = client-side nav, Cmd/Ctrl+Click = new tab, Shift+Click = new window (when `rowHref` defined)
- [ ] Skeleton loading state while `isPending` is true (toolbar, table rows, pagination all show skeletons)

### Pagination

- [ ] Prev/Next buttons with page info (current page, total pages)
- [ ] Scroll-to-top on page change

### Empty states

- [ ] `EMPTY` state when no data at all (uses `empty` config)
- [ ] `FILTERED_EMPTY` state when search/filters active but no rows match (uses `filtered` config)

### Product list page (verification)

- [ ] Route at `_authed/_shell/products/index.tsx` with `validateSearch` reusing `AdminProductListParams` from `@proteus/http-schemas`
- [ ] Uses `useDefineTable<Product>()` with `useData` wrapping the generated `useProducts()` React Query hook
- [ ] Columns: title, handle, status (badge with color per status), createdAt (datetime renderer) — all via `col.accessor`
- [ ] Filters: status (select filter with draft/published/proposed/rejected options), createdAt (date filter with standard presets)
- [ ] Per-row action menu (`rowActions`) with "Edit" and "Delete" actions
- [ ] "Create Product" action button in toolbar
- [ ] Clicking a row navigates to `/products/$id` (via `rowHref`)
- [ ] Pagination, search, filters, and sorting all round-trip through the URL and produce correct API calls
- [ ] Empty and filtered-empty states render correctly

### Deferred (not in scope)

- [ ] Row selection + command bar (spec covers it, build when needed)
- [ ] `number` and `string` filter types (not needed for product list)
- [ ] `useOptions` async filter options (not needed for product list)
- [ ] View persistence, column reordering, column visibility
