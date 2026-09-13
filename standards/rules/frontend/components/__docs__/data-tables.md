# Data tables

Every list of records in the admin — products, orders, users, a region's countries — is one
`<DataTable>` driven by a definition the feature writes. This covers writing that definition. The
storefront has no equivalent and needs none; nothing here applies to `apps/store`.

The table is a thin shell over TanStack Table whose real job is **URL state**: paging, sorting,
filtering and search all live in the route's search params, so a merchant's view of a list is
linkable, survives a refresh, and comes back on hardware back.
[ADR-0019](../../../../../docs/adr/0019-modals-are-url-state.md) names this table as the prior art it
generalised from; read it for why URL state is the default, not for how this table works.

## Structure

```
apps/admin/src/components/data-table/
  data-table.tsx      — <DataTable>: definition → URL state → TanStack instance → UI
  types.ts            — TableConfig, ColumnDef, FilterDef, and the DeepKeys accessor typing
  config.tsx          — setupDataTable(): the one call registering the global cell renderers
  table.d.ts          — module augmentation adding align/truncateTooltip to TanStack's ColumnMeta
  hooks/              — use-define-table, use-columns, use-url-state, use-sorting, use-filters, …
  data-table-ui/      — the presentational half: toolbar, filter bar, pagination, cells
  filters/            — one widget per filter type: date, select, multiselect, radio
  utils/              — the renderer registry and the filter-pill value formatter
```

A table definition is **a hook in the feature that owns the records**, named for what it lists:

```
apps/admin/src/features/orders/hooks/use-order-table.tsx
apps/admin/src/features/products/hooks/use-variant-table.tsx
```

All twelve definitions follow that shape. The route imports the hook and renders the component; it
holds no column list of its own.

## Shape

```tsx
// features/users/hooks/use-user-table.tsx
export const useUserTable = () =>
  useDefineTable<AdminUser>({
    useData: (params) => {
      const { data, isPending, isFetching } = useUsers(params)
      return { data: data?.users ?? [], count: data?.count, isPending, isFetching }
    },

    columns: (col) => [
      col.accessor('name', { header: 'Name', sortable: true }),
      col.accessor('email', { header: 'Email' }),
      col.accessor('createdAt', { header: 'Joined', render: 'datetime' }),
    ],

    getRowId: (row) => row.id,

    empty: { heading: 'No users yet', description: 'Invite someone to get started.' },
    filtered: { heading: 'No users found' },
  })
```

```tsx
// routes/_authed/settings/users/route.tsx
<DataTable use={users} heading="Users" actions={[{ label: 'Invite Users', to: 'invite' }]} />
```

## Rules

### The server does the paging, sorting and filtering

`manualPagination`, `manualSorting` and `manualFiltering` are hardcoded `true` in `data-table.tsx`.
TanStack Table never reorders or filters a row here — it renders what `useData` returned, in the
order it arrived.

So `useData` receives `{ offset, limit, order, q, …filters }` and **has to pass all of them through**
to the query hook. Ignoring one is the failure this design invites and the type system cannot see:
the sorting menu writes `order` to the URL, the URL changes, the rows come back identical, and
nothing anywhere is red. When a column is `sortable: true`, check that the endpoint behind `useData`
sorts on that field before shipping it.

`order` is one string — `createdAt` ascending, `-createdAt` descending. There is no second direction
param.

### `useData` is a hook, called on every render

`DataTable` calls `config.useData(params)` during its own render, unconditionally. It is therefore
subject to the rules of hooks: no branching around it, no early return, and it must tolerate whatever
`params` the URL currently holds. A definition cannot decide to skip the fetch — if a query should
not run yet, that belongs in the query hook's own `enabled`.

### A cell is an inline function, a registered name, or nothing

Resolution order, in `hooks/use-columns.tsx`:

1. `cell: ({ value, row }) => …` — an inline function, which always wins
2. `render: 'datetime'` — a name looked up in the global registry
3. `String(value)`, with `null` and `undefined` rendering as empty

Reach for `render` when the formatting is the same everywhere a value of that kind appears — a date
is a date on every screen. Reach for `cell` when the rendering is about *this* list: the order
table's status pill, a variant's computed option value. `config.tsx` registers five names today:
`text`, `datetime`, `date`, `boolean`, `thumbnail`.

**Setting both is always a mistake.** `cell` wins silently and the `render` is dead. So is a typo in
a `render` name: `render` is a plain `string`, so `'datetim'` type-checks, finds no renderer, and
falls through to `String(value)` — a date rendered as an ISO string is what that looks like on
screen.

A new global renderer goes in `config.tsx` and nowhere else. `configureDataTable()` merges into a
module-level registry, and `setupDataTable()` runs as the first statement of `main.tsx`, before the
router is built — a second call site would be a registration order to reason about.

### Two tables on one page need different prefixes

Every param a table owns is prefixed with `config.prefix`: `pv_offset`, `pv_order`, `pv_q`,
`pv_<filterId>`. Without a prefix the params are bare — `offset`, `order`, `q` — which is right for
the one list that *is* the page, and wrong the moment a second table mounts beside it.

Nothing detects a collision. A product detail page shows its variants (`pv`) and its image variants
(`iv`); the regions page keeps its list unprefixed and its country card on `rc` precisely because the
list stays mounted behind it. Pick a prefix for any table that is not the page's subject, and pick it
by looking at what else that route renders.

The prefix is also a name in the URL the merchant can bookmark, so renaming one silently breaks saved
links. It is not a variable.

### Every setter but paging resets to page one

Changing sort, search or a filter clears `offset`. That is in `use-url-state.ts` and not something a
definition opts into — it is here because the alternative is page four of a list that now has two
rows.

### `@tanstack/react-table` is imported inside `components/data-table/` and nowhere else

A feature never names the library. If typing a callback seems to require it, the type belongs in
`types.ts` and the table's own vocabulary — `ColumnDef<T>`, `FilterDef`, `TableConfig<T>` — is what a
feature writes against. This is the one claim here a check holds; see below.

## Enforcement

| Rule id | The paragraph it enforces |
|---|---|
| *(none)* | — |

No rule under `standards/rules/` checks anything on this page. One claim is held elsewhere:

### Already enforced, somewhere that is not here

| Claim | Held by |
|---|---|
| `@tanstack/react-table` is imported only from `src/components/data-table/` | `no-tanstack-table-outside-data-table`, a dependency-cruiser rule in `apps/admin/structure/.dependency-cruiser.cjs` — the `structure` gate. A feature importing it compiles, lints and tests clean, and fails there |

`standards/README.md` covers how rules run, how their tests work, and how to suppress one.

## What is deliberately not enforced

- **That `useData` honours every param it is handed.** This is the rule most worth checking and the
  one furthest out of reach of a rule: `useData` is an arbitrary function wrapping an arbitrary query
  hook, and "forwards `order` to something that sorts by it" is a claim about the backend at the
  other end of a generated client. The shape that would catch it is an e2e assertion — sort a list,
  assert the first row changed — not a rule.

- **That a `render` name is registered.** `render?: string` could be a union of the registered names,
  which would make a typo a type error. It is not, because the registry is populated by a runtime
  call and a union would be a second list to keep in step with it. The cost is a silent fallback to
  `String(value)`; the tell is an ISO string on screen.

- **That two tables on a page hold different prefixes.** A rule sees one file. Which tables end up
  mounted together is a property of the route tree, which is where the collision happens and where
  nothing is looking.

- **That a prefixed param survives the route's `validateSearch`.** Top-level tables run on routes
  whose zod search schema happens to name the same keys the filter ids use; the prefixed ones sit on
  routes with no `validateSearch` at all, so those params are unvalidated. Nothing ties a filter id to
  a schema field, and renaming either is a runtime change rather than a type error.

- **`defaultSort` and `defaultFilters` do nothing.** Both are declared on `TableConfig<T>` and read
  by no one. Setting either type-checks and has no effect. Documented here rather than quietly, so
  the next person to reach for them does not have to find that out by experiment.

## Examples

| File | Why look at it |
|---|---|
| `features/users/hooks/use-user-table.tsx` | the floor — three columns, no filters, no selection |
| `features/orders/hooks/use-order-table.tsx` | filters (`date` with presets, two `select`s), an inline `cell` for the status pill, `rowHref` |
| `features/products/hooks/use-variant-table.tsx` | columns built at runtime, one `col.display` per product option |
| `features/regions/hooks/use-region-country-table.tsx` | row selection owned by the card rather than the table, so it survives paging — and the comment explaining its `prefix` |

`docs/DATATABLE-DEEP-DIVE.md` describes Medusa's admin table, which this one is modelled on. It is
reference material about someone else's code, not a description of ours.

## Relationship with forms

A toolbar `action` is `{ label, to }` and a row action is an `ActionMenu` of links, because in the
admin a create or edit form is a route rather than a modal held in state — see
[route modals](./route-modals.md).
