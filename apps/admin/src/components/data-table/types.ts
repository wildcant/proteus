import type { ReactNode } from 'react'

// ---------------------------------------------------------------------------
// DeepKeys — type-safe accessor key extraction
// ---------------------------------------------------------------------------

type Primitive = string | number | boolean | bigint | symbol | null | undefined | Date

// Scalar value type for type-erased cell accessors and global renderers.
// Matches the leaf types reachable via DeepKeys<T>.
export type CellValue = string | number | boolean | Date | null | undefined

type DeepKeys<T> = T extends Primitive
  ? never
  : T extends (infer U)[]
    ? DeepKeys<U>
    : {
        [K in keyof T & string]: T[K] extends Primitive | null | undefined
          ? K
          : K | `${K}.${DeepKeys<NonNullable<T[K]>>}`
      }[keyof T & string]

type DeepValue<T, K extends string> = K extends `${infer Head}.${infer Tail}`
  ? Head extends keyof T
    ? DeepValue<NonNullable<T[Head]>, Tail>
    : never
  : K extends keyof T
    ? T[K]
    : never

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

type ColumnAccessorOptions<T, K extends string> = {
  header: string
  sortable?: boolean
  render?: string
  cell?: (props: { value: DeepValue<T, K>; row: T }) => ReactNode
  sortLabel?: string
  sortAscLabel?: string
  sortDescLabel?: string
  align?: 'left' | 'center' | 'right'
  size?: number
  minSize?: number
  maxSize?: number
  truncateTooltip?: boolean
}

type ColumnDisplayOptions<T> = {
  header: string
  cell: (props: { row: T }) => ReactNode
  align?: 'left' | 'center' | 'right'
  size?: number
  minSize?: number
  maxSize?: number
}

export type ColumnDef<T> = {
  id: string
  header: string
  type: 'accessor' | 'display'
  accessorKey?: string
  sortable?: boolean
  render?: string
  cell?: (props: { value: CellValue; row: T }) => ReactNode
  sortLabel?: string
  sortAscLabel?: string
  sortDescLabel?: string
  align?: 'left' | 'center' | 'right'
  size?: number
  minSize?: number
  maxSize?: number
  truncateTooltip?: boolean
}

export type ColumnHelper<T> = {
  accessor: <K extends DeepKeys<T> & string>(key: K, options: ColumnAccessorOptions<T, K>) => ColumnDef<T>
  display: (id: string, options: ColumnDisplayOptions<T>) => ColumnDef<T>
}

// ---------------------------------------------------------------------------
// Filter definitions
// ---------------------------------------------------------------------------

type RadioFilterOptions = {
  type: 'radio'
  label: string
  options: { label: string; value: string }[]
}

type SelectFilterOptions = {
  type: 'select'
  label: string
  options: { label: string; value: string }[]
}

type MultiselectFilterOptions = {
  type: 'multiselect'
  label: string
  options: { label: string; value: string }[]
  searchable?: boolean
}

type DateFilterOptions = {
  type: 'date'
  label: string
  presets?: { label: string; value: { $gte?: string; $lte?: string } }[]
}

export type FilterOptions = RadioFilterOptions | SelectFilterOptions | MultiselectFilterOptions | DateFilterOptions

export type FilterDef = FilterOptions & {
  id: string
}

// Union of all possible filter values across filter types
export type FilterValue = string | string[] | { $gte?: string; $lte?: string }

export type FilterHelper<T> = {
  accessor: <K extends DeepKeys<T> & string>(key: K, options: FilterOptions) => FilterDef
}

// ---------------------------------------------------------------------------
// Data params & result
// ---------------------------------------------------------------------------

export type DataParams = {
  offset: number
  limit: number
  order?: string
  q?: string
  // biome-ignore lint/suspicious/noExplicitAny: DataParams is passed directly to consumer API types (e.g., ListProductsParams). The index must remain `any` to stay assignable to arbitrary API parameter shapes without requiring casts in every consumer.
  [key: string]: any
}

export type DataResult<T> = {
  data: T[]
  count: number | undefined
  isPending: boolean
  isFetching?: boolean
}

// ---------------------------------------------------------------------------
// Table config & definition
// ---------------------------------------------------------------------------

/** Controlled row selection, keyed by `TableConfig.getRowId`. State is owned by the consumer so
 * it survives pagination and search — the table only ever holds one page of server data. */
export type RowSelection = {
  value: Record<string, boolean>
  onChange: (next: Record<string, boolean>) => void
}

export type TableConfig<T> = {
  useData: (params: DataParams) => DataResult<T>
  columns: (col: ColumnHelper<T>) => ColumnDef<T>[]
  filters?: (filter: FilterHelper<T>) => FilterDef[]
  prefix?: string
  pageSize?: number
  paramMap?: Record<string, string>
  getRowId: (row: T) => string
  /** Opt-in checkbox column, keyed by `getRowId`. */
  rowSelection?: () => RowSelection
  rowHref?: (row: T) => string
  rowActions?: (row: T) => ReactNode
  empty?: { heading: string; description?: string }
  filtered?: { heading: string; description?: string }
  defaultSort?: { field: string; desc?: boolean }
  defaultFilters?: Record<string, string | string[]>
}

export type TableDefinition<T> = {
  config: TableConfig<T>
  columns: ColumnDef<T>[]
  filterDefs: FilterDef[]
  rowSelection?: RowSelection
}

// ---------------------------------------------------------------------------
// Cell renderer
// ---------------------------------------------------------------------------

export type CellRenderer = (props: { value: CellValue }) => ReactNode
