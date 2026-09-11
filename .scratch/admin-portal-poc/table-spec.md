# DataTable Spec

## Design Principles

Built from lessons across 4 generations of Medusa's table system:

1. **One component, one config** — no 3-layer stack to understand
2. **URL state is automatic** — consumers never touch `navigate({ search })`
3. **Columns and filters are client-side, type-safe** — no server metadata to fetch, merge, and patch
4. **Filter values are typed** — TanStack Router's JSON-first serialization preserves types natively, no manual encode/decode
5. **View persistence is a separate concern** — compose it on top, don't bake it in
6. **Row actions are domain logic** — always a render prop, never generated
7. **Bring your own data hooks** — the table doesn't care how you fetch

---

## The Consumer Interface

### Minimal Example

```tsx
function CustomerList() {
  const table = useDefineTable<Customer>({
    useData: (params) => {
      const { customers, count, isPending } = useCustomers(params)
      return { data: customers ?? [], count, isPending }
    },
    columns: (col) => [
      col.accessor("email", { header: "Email" }),
      col.accessor("firstName", { header: "First Name" }),
      col.accessor("createdAt", { header: "Created", render: "datetime" }),
    ],
  })

  return <DataTable use={table} heading="Customers" />
}
```

### Full Example

```tsx
function CustomerList() {
  const table = useDefineTable<Customer>({
    prefix: "c",
    pageSize: 20,

    useData: (params) => {
      const { store } = useStore()
      const { customers, count, isPending } = useCustomers(params, {
        placeholderData: keepPreviousData,
      })
      const data = customers?.map((c) => ({
        ...c,
        isVip: store?.vipGroupId === c.groupId,
      })) ?? []
      return { data, count, isPending }
    },

    columns: (col) => [
      col.accessor("email", { header: "Email", sortable: true }),
      col.accessor("firstName", { header: "First Name", sortable: true }),
      col.accessor("lastName", { header: "Last Name", sortable: true }),
      col.accessor("hasAccount", { header: "Account", render: "boolean" }),
      col.accessor("createdAt", {
        header: "Created", render: "datetime", sortable: true,
        sortAscLabel: "Oldest first", sortDescLabel: "Newest first",
      }),
      col.accessor("updatedAt", {
        header: "Updated", render: "datetime", sortable: true,
        sortAscLabel: "Oldest first", sortDescLabel: "Newest first",
      }),
    ],

    filters: (filter) => [
      filter.accessor("hasAccount", {
        type: "radio",
        label: "Has Account",
        options: [
          { label: "Yes", value: "true" },
          { label: "No", value: "false" },
        ],
      }),
      filter.accessor("createdAt", { type: "date", label: "Created" }),
      filter.accessor("updatedAt", { type: "date", label: "Updated" }),
    ],

    // Map filter IDs to different API param keys
    paramMap: {
      "groups.id": "groupId",
    },

    // Row-level concerns
    getRowId: (row) => row.id,
    rowHref: (row) => `/customers/${row.id}`,
    rowActions: (row) => <CustomerActions customer={row} />,

    // Empty states
    empty: {
      heading: "No customers yet",
      description: "Create your first customer to get started.",
    },
    filtered: {
      heading: "No customers found",
      description: "Try changing your filters or search term.",
    },
  })

  return (
    <DataTable
      use={table}
      className="flex-1"
      heading="Customers"
      actions={[{ label: "Create", to: "create" }]}
    />
  )
}
```

---

## The `useDefineTable<T>(config)` API

A hook that returns a memoized `TableDefinition<T>`. Called inside your component — the config object is referentially stable across re-renders. The `<DataTable>` component consumes it.

### Config Shape

```typescript
interface TableConfig<T> {
  /**
   * Data fetching hook. Called inside the component during render.
   * Receives the fully-computed params (offset, limit, order, q, filters).
   * Use your existing React Query hooks — the table doesn't care how you fetch.
   */
  useData: (params: DataParams) => DataResult<T>

  /**
   * Column definitions. Builder function receives a type-safe column helper
   * bound to T — col.accessor("typo") is a compile error.
   */
  columns: (col: ColumnHelper<T>) => ColumnDef<T>[]

  /**
   * Filter definitions. Builder function receives a type-safe filter helper.
   * Only fields defined here become filterable — no "disable everything the
   * server auto-detected" dance.
   */
  filters?: (filter: FilterHelper<T>) => FilterDef[]

  /**
   * URL param prefix for multi-table pages.
   * e.g. "c" -> ?c_offset=20&c_q=foo
   */
  prefix?: string

  /**
   * Rows per page. Default 20.
   */
  pageSize?: number

  /**
   * Remap filter IDs to different query param keys.
   * Only affects the outgoing API request — URL and UI still use the original ID.
   */
  paramMap?: Record<string, string>

  /** Extract row ID. Default: (row) => row.id */
  getRowId?: (row: T) => string

  /** Make rows navigable. */
  rowHref?: (row: T) => string

  /** Per-row action menu. */
  rowActions?: (row: T) => ReactNode

  /** Empty state when there's no data at all. */
  empty?: {
    heading: string
    description?: string
  }

  /** Empty state when filters/search are active but no rows match. */
  filtered?: {
    heading: string
    description?: string
  }

  /** Default sort on first load (before user interacts). */
  defaultSort?: { field: keyof T & string; desc?: boolean }

  /** Default filters applied on first load. Values are always strings. */
  defaultFilters?: Record<string, string | string[]>

  /** Row selection + bulk commands. */
  selection?: {
    enabled: boolean | ((row: T) => boolean)
    commands?: Command[]
  }
}

interface Command {
  /** The label shown in the command bar. */
  label: string
  /** The action to perform. Receives the current selection state. */
  action: (selection: Record<string, boolean>) => void | Promise<void>
  /**
   * Keyboard shortcut key (e.g. "d" for delete).
   * Rendered as a <Kbd> hint in the command bar and auto-registered as a
   * keydown listener while the bar is visible. Suppressed when an editable
   * element is focused.
   */
  shortcut: string
}
```

### `DataParams` — What `useData` Receives

```typescript
interface DataParams {
  offset: number
  limit: number
  order?: string          // "field" or "-field"
  q?: string              // search term
  [filterId: string]: any // active filter values, already decoded
}
```

The table computes this from URL state + config, applies `paramMap` remapping, and passes it to `useData`. Your hook just forwards it to your API client:

```tsx
useData: (params) => {
  const { customers, count, isPending } = useCustomers(params)
  return { data: customers ?? [], count, isPending }
}
```

### `DataResult<T>` — What `useData` Returns

```typescript
interface DataResult<T> {
  data: T[]
  count: number | undefined
  isPending: boolean
}
```

Errors are not handled by the table. If the data fetch fails, throw from `useData` — the error bubbles up to the app's nearest error boundary (e.g., React Router's `errorElement`). This matches Medusa's pattern: `if (isError) { throw error }`.

---

## Type-Safe Column Builder

The `columns` function receives a `ColumnHelper<T>` with two methods:

```typescript
interface ColumnHelper<T> {
  /**
   * Define a column for a field on T. The key is type-checked against
   * DeepKeys<T> — referencing a field that doesn't exist is a compile error.
   */
  accessor<K extends DeepKeys<T>>(
    key: K,
    options: {
      header: string
      sortable?: boolean
      /** Built-in renderer name or custom renderer key */
      render?: string
      /** Custom cell render function — overrides `render` */
      cell?: (props: { value: DeepValue<T, K>; row: T }) => ReactNode
      /** Sort label shown in sort menu (defaults to header) */
      sortLabel?: string
      /** Label for ascending direction (e.g. "Oldest first", "A-Z"). @default "Ascending" */
      sortAscLabel?: string
      /** Label for descending direction (e.g. "Newest first", "Z-A"). @default "Descending" */
      sortDescLabel?: string
      /** Alignment for both header and body cell. @default "left" */
      align?: "left" | "center" | "right"
      /** Column width in px. Columns without size share remaining space equally. */
      size?: number
      /** Minimum column width in px. */
      minSize?: number
      /** Maximum column width in px. */
      maxSize?: number
      /**
       * Whether a hover tooltip shows the full value when the cell content
       * is truncated. Disable for cells that manage their own overflow
       * (badges, images, status pills). @default true
       */
      truncateTooltip?: boolean
    }
  ): ColumnDef<T>

  /**
   * Define a non-data column (computed values, composite cells).
   * Unlike accessor, this doesn't map to a field on T.
   */
  display(
    id: string,
    options: {
      header: string
      cell: (props: { row: T }) => ReactNode
      align?: "left" | "center" | "right"
      size?: number
      minSize?: number
      maxSize?: number
    }
  ): ColumnDef<T>
}
```

### Usage

```tsx
columns: (col) => [
  col.accessor("email", { header: "Email", sortable: true }),
  col.accessor("status", {
    header: "Status",
    align: "center",
    cell: ({ value }) => (
      <StatusBadge
        value={value}
        variants={{ active: "green", disabled: "grey" }}
      />
    ),
    truncateTooltip: false, // badges manage their own overflow
  }),
  col.accessor("total", { header: "Total", render: "currency", align: "right", size: 120 }),
  col.accessor("createdAt", { header: "Created", render: "datetime", sortable: true }),
  col.display("fullName", {
    header: "Name",
    cell: ({ row }) => `${row.firstName} ${row.lastName}`,
  }),
]
```

**Why a builder function instead of a plain array?**

A plain array can't infer the generic `T` for accessor type checking. The builder function receives a helper already bound to `T`, so `col.accessor("emayl")` fails at compile time. This is the same pattern TanStack Table and Medusa's `createDataTableColumnHelper<T>()` use.

---

## Type-Safe Filter Builder

The `filters` function receives a `FilterHelper<T>`:

```typescript
interface FilterHelper<T> {
  /**
   * Define a filter for a field on T. Key is type-checked.
   */
  accessor<K extends DeepKeys<T>>(
    key: K,
    options: FilterOptions
  ): FilterDef
}

type FilterOptions =
  | { type: "radio"; label: string; options: { label: string; value: string }[] }
  | { type: "select"; label: string; options: { label: string; value: string }[] }
  | { type: "multiselect"; label: string; options: { label: string; value: string }[]; searchable?: boolean }
  | {
      type: "date"; label: string
      /** Preset date ranges shown above the custom picker. */
      presets?: { label: string; value: { $gte?: string; $lte?: string } }[]
    }
  | { type: "number"; label: string; operators?: boolean }
  | { type: "string"; label: string }
```

### Usage

```tsx
filters: (filter) => [
  filter.accessor("hasAccount", {
    type: "radio",
    label: "Has Account",
    options: [
      { label: "Yes", value: "true" },
      { label: "No", value: "false" },
    ],
  }),
  filter.accessor("status", {
    type: "select",
    label: "Status",
    options: [
      { label: "Active", value: "active" },
      { label: "Disabled", value: "disabled" },
    ],
  }),
  filter.accessor("tags", {
    type: "multiselect",
    label: "Tags",
    searchable: true,
    options: [
      { label: "VIP", value: "vip" },
      { label: "Wholesale", value: "wholesale" },
      { label: "Retail", value: "retail" },
    ],
  }),
  filter.accessor("createdAt", {
    type: "date",
    label: "Created",
    presets: [
      { label: "Today", value: { $gte: startOfToday().toISOString() } },
      { label: "Last 7 days", value: { $gte: subDays(new Date(), 7).toISOString() } },
      { label: "Last 30 days", value: { $gte: subDays(new Date(), 30).toISOString() } },
      { label: "Last 12 months", value: { $gte: subMonths(new Date(), 12).toISOString() } },
    ],
  }),
]
```

### Async Filter Options (Relationships)

For filters whose options come from another API (e.g., "filter by region"), pass an async options loader:

```tsx
filter.accessor("regionId", {
  type: "multiselect",
  label: "Region",
  searchable: true,
  useOptions: () => {
    const { regions } = useRegions({ limit: 100 })
    return regions?.map((r) => ({ label: r.name, value: r.id })) ?? []
  },
})
```

`useOptions` is a hook — called by the filter component when the filter dropdown opens. Lazy-loaded, not fetched upfront. Available on both `select` and `multiselect` types.

---

## Filter Rendering

Each `FilterDef` from the builder drives its own UI. The `type` field determines three things: which popover content to render, how to display the current value in the pill, and how to encode/decode the URL value.

### Component Structure

```
FilterBar
  ├── FilterPill (one per active filter)
  │     ├── pill: [label] [is] [displayValue] [×]
  │     └── Popover
  │           └── FilterContent (switches on type)
  │                 ├── RadioFilterContent
  │                 ├── SelectFilterContent
  │                 ├── MultiselectFilterContent
  │                 ├── DateFilterContent
  │                 ├── NumberFilterContent
  │                 └── StringFilterContent
  └── "Clear all" button
```

### FilterPill — same for every type

The pill is a shared shell. It renders the label, a formatted display value, and a remove button. Clicking the value opens a popover with type-specific content:

```tsx
function FilterPill({ def, value, onChange, onRemove }) {
  return (
    <Popover>
      <div className="flex items-center rounded-md shadow-borders-base">
        <span className="px-2 py-1 text-muted">{def.label}</span>
        {value != null && (
          <>
            <span className="border-x px-2 py-1 text-muted">is</span>
            <Popover.Trigger className="px-2 py-1">
              {formatDisplayValue(value, def)}
            </Popover.Trigger>
            <button onClick={onRemove}>×</button>
          </>
        )}
      </div>
      <Popover.Content>
        <FilterContent def={def} value={value} onChange={onChange} />
      </Popover.Content>
    </Popover>
  )
}
```

### FilterContent — one component per type

A switch routes to the right content component. Each is small and self-contained:

```tsx
function FilterContent({ def, value, onChange }) {
  switch (def.type) {
    case "radio":
      return <RadioFilterContent options={def.options} value={value} onChange={onChange} />
    case "select":
      return <SelectFilterContent def={def} value={value} onChange={onChange} />
    case "multiselect":
      return <MultiselectFilterContent def={def} value={value} onChange={onChange} />
    case "date":
      return <DateFilterContent value={value} onChange={onChange} />
    case "number":
      return <NumberFilterContent value={value} onChange={onChange} />
    case "string":
      return <StringFilterContent value={value} onChange={onChange} />
  }
}
```

Each content component is a separate file, not one 1200-line file like Medusa's `data-table-filter.tsx`.

**What each renders:**

| Type | Popover content | Display value in pill |
|------|----------------|---------------------|
| `radio` | List of options, dot indicator on selected | Selected option label |
| `select` | List of options, single selection (static `options` or lazy `useOptions`) | Selected option label |
| `multiselect` | Searchable checkbox list (static `options` or lazy `useOptions`) | Comma-joined labels |
| `date` | Preset buttons (if configured) + custom start/end date pickers | `"Today"`, `"Last 7 days"`, or `"Jan 1 - Dec 31, 2024"` |
| `number` | Operator dropdown (=, >, >=, <, <=) + number input | `"≥ 100"` |
| `string` | Debounced text input | The raw value |

### Display value formatting

Type-driven, like encoding:

```typescript
function formatDisplayValue(value: any, def: FilterDef): string {
  switch (def.type) {
    case "radio":
    case "select":
      return def.options.find((o) => o.value === value)?.label ?? value
    case "multiselect":
      const options = def.options ?? []
      return value.map((v) => options.find((o) => o.value === v)?.label ?? v).join(", ")
    case "date":
      // Check presets first — if value matches a preset, show its label
      const preset = def.presets?.find((p) =>
        p.value.$gte === value.$gte && p.value.$lte === value.$lte
      )
      return preset?.label ?? formatDateRange(value) // "Today" or "Jan 1 - Dec 31, 2024"
    case "number":
      return formatNumberOp(value)  // "≥ 100"
    case "string":
      return value
  }
}
```

### FilterBar — renders active filters

```tsx
function FilterBar({ filters, values, onSetFilter, onRemoveFilter, onClearAll }) {
  const activeFilters = filters.filter((def) => values[def.id] != null)

  if (activeFilters.length === 0) return null

  return (
    <div className="flex items-center gap-2 border-t px-6 py-2">
      {activeFilters.map((def) => (
        <FilterPill
          key={def.id}
          def={def}
          value={values[def.id]}
          onChange={(v) => onSetFilter(def.id, v)}
          onRemove={() => onRemoveFilter(def.id)}
        />
      ))}
      <button onClick={onClearAll}>Clear all</button>
    </div>
  )
}
```

### How it connects to `useUrlState`

Inside `<DataTable>`, the filter bar reads from and writes to URL state:

```tsx
// Inside <DataTable>
const { filters: filterValues, setFilter } = useUrlState(prefix, filterDefs)

<FilterBar
  filters={filterDefs}
  values={filterValues}
  onSetFilter={(id, value) => setFilter(id, value)}
  onRemoveFilter={(id) => setFilter(id, null)}
  onClearAll={() => filterDefs.forEach((f) => setFilter(f.id, null))}
/>
```

No intermediate local filter state layer. Medusa maintains a separate `localFilters` array synced with the TanStack Table instance to handle "new filter" open/dismiss behavior — ~60 lines of effect-driven sync. We skip that: adding a filter from the toolbar menu sets the URL param to empty and opens the popover. Dismissing without a value removes the param. The URL is the single source of truth.

---

## Toolbar, Search & Sorting

The toolbar is the bar above the table containing heading, search, sort, filter controls, and actions. Medusa composes this from `@medusajs/ui` sub-components (`DataTable.Toolbar`, `DataTable.Search`, `DataTable.SortingMenu`, `DataTable.FilterMenu`). We keep the same layout but enforce the rule: **logic lives in hooks, components are dumb renderers**.

### Toolbar Layout

```
┌──────────────────────────────────────────────────────────┐
│ [Heading / SubHeading]        [Filters▾] [Sort▾] [Search] [Actions] │
├──────────────────────────────────────────────────────────┤
│ [filter pill] [filter pill] ... [Clear all]                │  ← FilterBar
└──────────────────────────────────────────────────────────┘
│ table rows ...                                            │
├──────────────────────────────────────────────────────────┤
│ [← Prev]                                    [Next →]      │  ← Pagination
└──────────────────────────────────────────────────────────┘
```

### Search

A debounced text input. Writes `q` to URL state on change.

```tsx
// useSearch hook owns the debounce logic
function useSearch(urlState: UrlState, delay = 300) {
  const [draft, setDraft] = useState(urlState.q)

  useEffect(() => {
    const timer = setTimeout(() => urlState.setSearch(draft), delay)
    return () => clearTimeout(timer)
  }, [draft, delay])

  // Sync back when URL changes externally (e.g. browser back)
  useEffect(() => { setDraft(urlState.q) }, [urlState.q])

  return { value: draft, onChange: setDraft }
}

// Search component is just an input + skeleton
function Search({ value, onChange, isPending }) {
  if (isPending) return <Skeleton className="h-7 w-[128px]" />

  return <Input type="search" size="small" value={value} onChange={(e) => onChange(e.target.value)} />
}
```

### Sorting Menu

A dropdown with two sections. The available sort fields come from columns that have `sortable: true`. Labels come from `sortLabel` on the column def (falls back to `header`).

```tsx
// useSorting reads columns + URL state, no logic in the component
function useSorting(columns: ColumnDef[], urlState: UrlState) {
  const sortableColumns = columns.filter((c) => c.sortable)
  const current = urlState.order // { field, desc } | null

  const setField = (field: string) =>
    urlState.setOrder({ field, desc: current?.desc ?? false })
  const setDirection = (desc: boolean) =>
    urlState.setOrder({ field: current?.field ?? "", desc })

  return { sortableColumns, current, setField, setDirection }
}

// SortingMenu just renders the dropdown
function SortingMenu({ sortableColumns, current, setField, setDirection, isPending }) {
  if (isPending) return <Skeleton className="size-7" />

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <IconButton size="small"><SortIcon /></IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        {/* Section 1: field selection */}
        <DropdownMenu.RadioGroup value={current?.field} onValueChange={setField}>
          {sortableColumns.map((col) => (
            <DropdownMenu.RadioItem key={col.id} value={col.id}>
              {col.sortLabel ?? col.header}
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>

        {/* Section 2: direction (only when a field is selected) */}
        {/* Labels come from the selected column's sortAscLabel/sortDescLabel */}
        {current && (
          <>
            <DropdownMenu.Separator />
            <DropdownMenu.RadioGroup value={String(current.desc)} onValueChange={(v) => setDirection(v === "true")}>
              <DropdownMenu.RadioItem value="false">
                {currentCol?.sortAscLabel ?? "Ascending"}
              </DropdownMenu.RadioItem>
              <DropdownMenu.RadioItem value="true">
                {currentCol?.sortDescLabel ?? "Descending"}
              </DropdownMenu.RadioItem>
            </DropdownMenu.RadioGroup>
          </>
        )}
      </DropdownMenu.Content>
    </DropdownMenu>
  )
}
```

### Filter Menu

A dropdown listing all defined filters. Clicking one adds it to the filter bar (sets URL param to empty) and auto-opens its popover. Only shows filters that aren't already active.

```tsx
function FilterMenu({ filterDefs, activeFilterIds, onAdd, isPending }) {
  if (isPending) return <Skeleton className="size-7" />

  const available = filterDefs.filter((f) => !activeFilterIds.includes(f.id))
  if (available.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <IconButton size="small"><FilterIcon /></IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        {available.map((def) => (
          <DropdownMenu.Item key={def.id} onClick={() => onAdd(def.id)}>
            {def.label}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  )
}
```

### Pagination

Reads offset + count from URL state and data result. Shows page info and prev/next buttons.

```tsx
function usePagination(urlState: UrlState, count: number | undefined, pageSize: number) {
  const currentPage = Math.floor((urlState.offset ?? 0) / pageSize)
  const totalPages = count != null ? Math.ceil(count / pageSize) : undefined
  const canPrev = currentPage > 0
  const canNext = totalPages != null ? currentPage < totalPages - 1 : false

  const goNext = () => urlState.setOffset((currentPage + 1) * pageSize)
  const goPrev = () => urlState.setOffset(Math.max(0, (currentPage - 1) * pageSize))

  return { currentPage, totalPages, canPrev, canNext, goNext, goPrev }
}
```

### Scroll-to-Top on Page Change

When the page changes (via `goNext` / `goPrev`), the table container scrolls to `{ top: 0 }`. Without this, clicking "Next" leaves the user staring at the bottom of the previous page.

```tsx
// Inside the table container component
const containerRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  containerRef.current?.scrollTo({ top: 0, left: 0 })
}, [currentPage])
```

### Skeletons

Every toolbar piece shows a skeleton while `isPending` is true (from `useData`). This prevents layout shift when the table first renders:

- **Search**: `<Skeleton className="h-7 w-[128px]" />`
- **SortingMenu**: `<Skeleton className="size-7" />`
- **FilterBar**: one `<Skeleton className="h-7 w-[180px]" />` per active filter
- **Table**: rows of `<Skeleton>` cells matching the column count
- **Pagination**: `<Skeleton className="h-7 w-[200px]" />`

---

## Two-Layer Architecture

### Layer 1 — shadcn `<Table>` primitives (presentation only)

Installed via `pnpm dlx shadcn@latest add table`. Pure styled HTML table elements — no state, no TanStack, no logic:

```tsx
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
```

These are thin wrappers around `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>` with consistent styling. We don't modify or extend them.

### Layer 2 — Our `<DataTable>` (everything else)

Everything above Layer 1 lives here:

- **TanStack Table** — `useReactTable`, `flexRender`, `getCoreRowModel`. Configured with `manualPagination`, `manualSorting`, `manualFiltering` since all data comes from the server.
- **URL state hooks** — `useUrlState`, `useSearch`, `useSorting`, `useFilters`, `usePagination`
- **Config** — `useDefineTable` memoizes the consumer's config
- **Toolbar components** — `Search`, `SortingMenu`, `FilterMenu`, `FilterBar`, `FilterPill`, filter content components
- **Table rendering** — translates our `ColumnDef[]` into TanStack columns (resolving `render` strings via global renderers, `cell` functions), calls `useReactTable()`, renders with Layer 1 primitives
- **Pagination, empty state, skeletons**

```tsx
// Inside our Table.tsx component (pseudocode)
function TableView({ columns, data, isPending, emptyState, ... }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const table = useReactTable({
    data,
    columns: toTanStackColumns(columns),  // resolve render/cell, alignment, sizing
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  })

  if (isPending) return <TableSkeleton columnCount={columns.length} />

  return (
    <div ref={containerRef} className="overflow-auto">
      <Table className="table-fixed">
        <TableHeader className="sticky top-0 z-[1] bg-background">
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => (
                <TableHead
                  key={header.id}
                  style={{ width: header.getSize() }}
                  className={alignClass(header.column.columnDef.meta?.align)}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length > 0 ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={alignClass(cell.column.columnDef.meta?.align)}
                  >
                    <TruncatedCell disabled={cell.column.columnDef.meta?.truncateTooltip === false}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TruncatedCell>
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <EmptyState {...emptyState} />
          )}
        </TableBody>
      </Table>
    </div>
  )
}
```

### Why two layers

Medusa has a similar split — `@medusajs/ui` provides the TanStack + styled primitives, and the dashboard builds on top. But they bundled TanStack into the UI library layer, coupling it to a specific version and config. We keep TanStack in our layer so:

- **shadcn primitives stay generic** — just styled HTML, usable outside of DataTable if needed
- **TanStack config is ours** — we control `manual*` flags, column translation, row models
- **Upgrades are independent** — updating shadcn table styles doesn't touch table logic, updating TanStack doesn't touch styles

---

## Row Click Handling

When `rowHref` is defined, each row becomes navigable. The click handler must respect keyboard modifiers — without this, basic browser behavior (Cmd+Click to open in a new tab) breaks:

```typescript
function handleRowClick(event: MouseEvent, href: string, navigate: NavigateFn) {
  // Middle-click or Cmd/Ctrl+Click → new tab
  if (event.metaKey || event.ctrlKey || event.button === 1) {
    window.open(href, "_blank", "noreferrer")
    return
  }
  // Shift+Click → new window
  if (event.shiftKey) {
    window.open(href, undefined, "noreferrer")
    return
  }
  // Normal click → client-side navigation
  navigate(href)
}
```

This is applied to each `<TableRow>` in the table body. Clicks on interactive elements inside the row (buttons, links, inputs) should not trigger row navigation — use `event.target` / `closest` checks or stop propagation in the action cell.

---

## Row Selection & Command Bar

When `selection` is configured, a checkbox column is prepended and a command bar appears at the bottom when rows are selected.

### Keyboard selection

Pressing **X** while hovering a row toggles its selection without needing to click the checkbox. This is suppressed when an editable element (input, textarea, contenteditable) is focused, checked via `getIsEditableElementFocused()`.

### Command bar

The bar shows the selected count and the configured commands. Each command renders its `shortcut` as a `<Kbd>` hint. The shortcut key is auto-registered as a `keydown` listener while the bar is visible:

```tsx
// Pseudocode — the hook, not the component
function useCommandShortcuts(commands: Command[], selection: RowSelectionState) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (getIsEditableElementFocused()) return
      const cmd = commands.find((c) => c.shortcut === e.key)
      if (cmd) cmd.action(selection)
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [commands, selection])
}
```

---

## Truncated Cell Tooltip

Every cell is wrapped in a truncation-aware tooltip. On `mouseEnter`, the component checks `scrollWidth > clientWidth` — if the text overflows, hovering shows the full value in a tooltip. This prevents data from being unreadable in dense tables with many columns.

Renderers that manage their own overflow (badges, images, status pills) opt out via `truncateTooltip: false` on the column definition. The global renderer registry can also set a default — e.g., `boolean` and `image` renderers default to `truncateTooltip: false`.

```tsx
function TruncatedCell({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [overflows, setOverflows] = useState(false)

  const onMouseEnter = () => {
    if (ref.current) setOverflows(ref.current.scrollWidth > ref.current.clientWidth)
  }

  return (
    <Tooltip open={disabled ? false : undefined}>
      <Tooltip.Trigger asChild>
        <div ref={ref} className="truncate" onMouseEnter={onMouseEnter}>
          {children}
        </div>
      </Tooltip.Trigger>
      {overflows && <Tooltip.Content>{children}</Tooltip.Content>}
    </Tooltip>
  )
}
```

---

## URL State Encoding

Identical conventions to what Medusa settled on (they got this right):

| State | Key | Format | Absent means |
|-------|-----|--------|--------------|
| Pagination | `offset` | Integer (absolute row offset) | Page 0 |
| Sort asc | `order` | `fieldName` | No sort / default |
| Sort desc | `order` | `-fieldName` | -- |
| Search | `q` | Raw string | No search |
| Filter | `{filterId}` | See below | Filter inactive |

### Filter Value Encoding

TanStack Router handles serialization natively — search params are JSON-first. Scalar values stay flat and readable (`?status=active`), complex values (arrays, objects) are automatically JSON-serialized into the URL and deserialized back with type preservation.

| Filter type | In-memory value | URL example |
|-------------|----------------|-------------|
| radio | `"active"` | `?status=active` |
| select | `"usd"` | `?currency=usd` |
| multiselect | `["reg_1","reg_2"]` | `?regionId=%5B%22reg_1%22%2C%22reg_2%22%5D` |
| date | `{ $gte: "2024-01-01" }` | `?createdAt=%7B%22%24gte%22%3A%222024-01-01%22%7D` |

No custom encode/decode logic needed — TanStack Router does it. The route's `validateSearch` schema (ideally reused from `@proteus/http-schemas`) validates and provides defaults on parse.

---

## Internal Architecture (What the Consumer Doesn't See)

```
useDefineTable(config) — memoizes config, returns stable TableDefinition
  |
  v
<DataTable use={table}>
  |
  +-- useUrlState(prefix, filterDefs)
  |    Composes the pure read/write functions below.
  |    Returns { offset, order, q, filters, set* }.
  |
  +-- table.columns(columnHelper)
  |    Called once (memoized). Returns ColumnDef[].
  |    No async, no metadata fetch — pure synchronous config.
  |
  +-- table.filters?.(filterHelper)
  |    Called once (memoized). Returns FilterDef[].
  |
  +-- computeParams(urlState, paramMap)
  |    Merges URL state into DataParams for useData.
  |    Applies paramMap remapping.
  |
  +-- table.useData(computedParams)
  |    Consumer's React Query hook. Returns { data, count, isPending }.
  |
  +-- renders TanStack Table + UI components
       All state is manualPagination/Sorting/Filtering.
       Cell renderers resolve from column `cell` → `render` string → text fallback.
```

### File Structure

Logic lives in hooks, components are dumb renderers. Each piece gets its own file.

```
apps/admin/src/components/data-table/
  hooks/
    use-url-state.ts            — reads useSearch(), writes navigate({ search }), prefix namespacing
    use-search.ts               — debounced search draft state
    use-sorting.ts              — sortable columns + current sort from URL
    use-filters.ts              — active filters, add/remove/update via URL
    use-pagination.ts           — page math from offset + count
  filters/
    radio-filter.tsx            — list of options, dot indicator
    select-filter.tsx           — single-select option list
    multiselect-filter.tsx      — searchable checkbox list
    date-filter.tsx             — preset buttons + start/end date pickers
    number-filter.tsx           — operator dropdown + number input
    string-filter.tsx           — debounced text input
  utils/
    format.ts                   — formatDisplayValue, formatDateRange, formatNumberOp
    configure.ts                — configureDataTable (global renderer registry)
  data-table.tsx                — root, composes hooks + components
  toolbar.tsx                   — layout shell: heading left, controls right
  search.tsx                    — input + skeleton
  sorting-menu.tsx              — dropdown: field radio + direction radio
  filter-menu.tsx               — dropdown: add available filters
  filter-bar.tsx                — renders active FilterPills + clear all
  filter-pill.tsx               — pill shell: label | is | value | × + popover
  table.tsx                     — TanStack table with cell renderer resolution, truncation tooltips
  pagination.tsx                — prev/next + page info + scroll-to-top
  empty-state.tsx               — empty vs filtered-empty states
  command-bar.tsx               — selection count + command buttons with keyboard shortcuts
  skeleton.tsx                  — shared skeleton primitives
```

### URL State Internals

Medusa bundles all URL read/write logic into the `<DataTable>` component body — pagination, sorting, search, and filter handlers are all inline. This makes each concern hard to test and hard to read.

We use TanStack Router's search params natively. `useSearch({ strict: false })` reads the current search state as a typed object (route-agnostic — works on any route). `navigate({ to: ".", search: (prev) => ... })` writes updates. TanStack Router handles serialization to/from the URL automatically.

The route's `validateSearch` schema defines what params are valid and provides defaults. Reuse the API query schemas from `@proteus/http-schemas` — same schema validates the URL and types the API call:

```tsx
// In the route file (e.g. products/index.tsx)
import { AdminProductListParams } from '@proteus/http-schemas/admin'

export const Route = createFileRoute('/_authed/_shell/products/')({
  validateSearch: AdminProductListParams,  // Zod v4 works natively
})
```

The `useUrlState` hook reads and writes search params. Two internal helpers keep it clean:

```typescript
function useUrlState({ prefix, filterDefs }: UrlStateConfig) {
  const search = useSearch({ strict: false })
  const navigate = useNavigate()

  // Namespace keys for multi-table pages: "offset" → "c_offset"
  const prefixed = (name: string) => (prefix ? `${prefix}_${name}` : name)

  // Navigate with a partial search update, merging with existing state
  const update = (patch: Record<string, unknown>) =>
    navigate({ to: ".", search: (prev) => ({ ...prev, ...patch }) })

  // Navigate + reset to first page (prevents empty-page-after-filter-change)
  const updateAndResetPage = (patch: Record<string, unknown>) =>
    update({ ...patch, [prefixed("offset")]: undefined })

  // --- Reads ---

  const offset = search[prefixed("offset")] ?? 0
  const order  = search[prefixed("order")]
  const q      = search[prefixed("q")]

  const filters = Object.fromEntries(
    (filterDefs ?? [])
      .map((f) => [f.id, search[prefixed(f.id)]] as const)
      .filter(([, value]) => value != null),
  )

  // --- Writes ---

  return {
    offset,
    order,
    q,
    filters,
    setOffset: (v: number) => update({ [prefixed("offset")]: v || undefined }),
    setOrder:  (v: string | null) => updateAndResetPage({ [prefixed("order")]: v }),
    setSearch: (v: string) => updateAndResetPage({ [prefixed("q")]: v || undefined }),
    setFilter: (id: string, v: unknown) => updateAndResetPage({ [prefixed(id)]: v }),
  }
}
```

### Auto-Reset Page Index

When sorting, filtering, or search changes, offset is automatically reset to 0. Without this, changing a filter while on page 3 can leave the user stranded on an offset that exceeds the new result count — showing an empty table even though matching rows exist.

This is handled by `updateAndResetPage` — every setter except `setOffset` uses it, which spreads `[prefixed("offset")]: undefined` into the patch. Setting a search param to `undefined` removes it from the URL, and the route's `validateSearch` schema provides the default (0).

### No Async Column Loading

Unlike Medusa's configurable tables, there is no loading state for columns. Columns are defined synchronously in code — the table can render its header row immediately. The only loading state is for data (from `useData`).

### No Intermediate Layer

There is no separate "URL-stateful wrapper" component vs "headless UI" component. One component does both because:

- The URL encoding is simple enough to be internal (not a reusable abstraction)
- Splitting forces the "controlled state" `{ state, onChange }` contract at the boundary, which is only useful if someone wants non-URL state — and in practice, nobody does for list tables
- The split created the most confusion in Medusa's codebase (3 things named "DataTable")

If you need a table without URL state (e.g., in a modal), provide a `urlState={false}` prop that falls back to `useState` internally. Same component, same API.

For layout control, the component accepts a `className` prop passed to its root container — no bespoke `layout` enum needed:

```tsx
<DataTable use={customers} className="flex-1" />   // fill viewport
<DataTable use={orders} className="max-h-[500px]" /> // constrained
<DataTable use={items} />                            // auto (sizes to content)
```

---

## Renderer System

Cell rendering resolves in priority order:

1. **`cell` function on the column** — full control, inline JSX
2. **`render` string on the column** — looks up a named renderer from the global defaults
3. **Fallback** — renders the value as text

### Global Default Renderers

Configured once at app startup via `configureDataTable`. These are the shared renderers available to every table:

```typescript
// app entry point (e.g. main.tsx)
import { configureDataTable } from "./lib/data-table"

configureDataTable({
  renderers: {
    text:     ({ value }) => <span>{value}</span>,
    date:     ({ value }) => <DateTooltip date={value} />,
    datetime: ({ value }) => <DateTimeTooltip date={value} />,
    status:   ({ value, meta }) => <StatusBadge value={value} variants={meta?.variants} />,
    currency: ({ value, meta }) => <CurrencyCell amount={value} currency={meta?.currency} />,
    boolean:  ({ value }) => <Badge>{value ? "Yes" : "No"}</Badge>,
    badge:    ({ value }) => <Badge>{value}</Badge>,
    image:    ({ value }) => <Thumbnail src={value} />,
  },
})
```

### Per-Column Override

If a global renderer doesn't fit a specific column, use `cell` directly on the column definition — no per-table registry needed:

```tsx
const table = useDefineTable<Product>({
  // ...
  columns: (col) => [
    col.accessor("title", { header: "Title" }),
    col.accessor("status", {
      header: "Status",
      // Override: don't use the global "status" renderer, do something custom
      cell: ({ value }) => (
        <StatusBadge
          value={value}
          variants={{ published: "green", draft: "grey", rejected: "red" }}
        />
      ),
    }),
    col.accessor("createdAt", { header: "Created", render: "datetime" }),
  ],
})
```

### `configureDataTable` API

```typescript
interface DataTableGlobalConfig {
  /** Named cell renderers available to all tables via column `render` field. */
  renderers?: Record<string, CellRenderer>
}

function configureDataTable(config: DataTableGlobalConfig): void
```

Called once at app boot. The library ships with sensible built-in renderers (`text`, `date`, `datetime`, `boolean`, `currency`, `number`). `configureDataTable` merges into / overrides those defaults — you only need to call it if you want to add custom renderers or replace a built-in one.

---

## What We Deliberately Omit

These are things Medusa built that add complexity without proportional value for v1:

| Feature | Why omit | Compose later? |
|---------|----------|----------------|
| View persistence (save/load named views) | Separate concern, adds ~200 lines of state + UI | Yes — wrap `<DataTable>` in a `<ViewProvider>` |
| Column reordering (drag & drop) | Nice-to-have, not essential | Yes — `columnOrder` prop |
| Column visibility toggle | Same | Yes — `columnVisibility` prop |
| Server-side column metadata | Every consumer patches it with `transformColumns` anyway | Not needed — client-side columns are type-safe and explicit |
| Async filter resolution from API metadata | Adds loading state and merge complexity | `useOptions` on individual filters covers the async case |
| Per-table renderer overrides | Inline `cell` on the column is simpler | Not needed |
| Feature flags gating table capabilities | Application-level concern | Conditional props at the callsite |

---

## Comparison: Medusa's `TableAdapter` vs This Spec

| Concern | Medusa `TableAdapter` | This spec |
|---------|----------------------|-----------|
| Define a table | `createTableAdapter({ entity, useData, ... })` + `useMemo` wrapper | `useDefineTable({ useData, columns, ... })` — one call, memoized |
| Render it | `<ConfigurableDataTable adapter={adapter} heading="..." />` | `<DataTable use={table} heading="..." />` |
| Data fetching | `useData(fields, params)` — two args, `fields` leaked | `useData(params)` — one arg, flat params |
| Columns | Server-generated from GraphQL schema + `transformColumns` patches | Client-side builder, type-safe: `col.accessor("email", {...})` |
| Filters | Auto-derived from server column metadata + no client override | Client-side builder, type-safe: `filter.accessor("status", {...})` |
| Async filter options | `useRelationshipFilterOptions` bulk-fetches all on mount | `useOptions` per-filter, lazy-loaded on dropdown open |
| Param remapping | `filterParamMap: { "a": "b" }` | `paramMap: { "a": "b" }` (same) |
| Row actions | `renderRowActions: (row) => <X />` | `rowActions: (row) => <X />` |
| Row navigation | `getRowHref: (row) => "/path"` | `rowHref: (row) => "/path"` |
| Empty state | `emptyState: { empty: {}, filtered: {} }` | `empty: { heading, description }` + `filtered: { heading, description }` |
| Bulk selection | `enableRowSelection + commands[]` | `selection: { enabled, commands }` |
| View persistence | Built into ConfigurableDataTable | Not included (compose externally) |
| URL prefix | `queryPrefix: "c"` | `prefix: "c"` |
| Type safety | None — `AdminColumn.field` is `string` | Compile-time — accessor keys checked against `T` |

---

## Key Differences in Philosophy

### 1. `useData` receives one flat params object

Medusa's `useData(fields, params)` passes a computed `fields` string as a separate first argument because the configurable table needs to tell the API which columns to return. This leaks an optimization concern into every adapter.

In this spec, `useData(params)` receives a single flat object. The consumer's hook just forwards it:

```tsx
useData: (params) => {
  const { customers, count, isPending } = useCustomers(params)
  return { data: customers ?? [], count, isPending }
}
```

### 2. Columns and filters are defined, not discovered

Medusa fetches column metadata from the server, then every adapter patches it with `transformColumns` to disable wrong filters and fix render modes. The "auto-discovery" creates work instead of saving it.

This spec defines columns and filters explicitly in client code with type-safe builders. You only define what you want — no allowlist/denylist dance. A new API field doesn't appear until you add a column for it, which is when you'd write the render config anyway.

### 3. Filter values are typed, not string-encoded

Medusa stores filter values as `JSON.stringify(value)` in the URL, then has special cases for booleans. This creates ambiguity.

In this spec, TanStack Router handles serialization natively. Filter values are typed in-memory (strings, arrays, objects) and the framework serializes/deserializes them to/from the URL automatically. No custom encode/decode logic, no special cases.

### 4. One component, not three

Medusa has `_DataTable`, `DataTable`, and `ConfigurableDataTable` all importable. This spec has one `<DataTable>` that handles URL state internally and renders UI directly. No intermediate layers.

### 5. Renderers are global defaults, overridden inline

Medusa's `defineCellRenderer()` mutates a module-level `Map` and also passes per-table `renderers` config — two ways to register, unclear which wins. This spec has one global config (`configureDataTable`) for shared renderers, and inline `cell` functions on individual columns when you need to override. Two layers, clear precedence.

---

## Resolved Decisions

| Decision | Answer | Rationale |
|----------|--------|-----------|
| Prefix: config or component? | Config | In practice no table is reused with a different prefix. Two sections = two `useDefineTable` calls. |
| Columns: builder or plain array? | Builder only | One way to define columns. Minimal overhead, compile-time type checking on every accessor key. |
