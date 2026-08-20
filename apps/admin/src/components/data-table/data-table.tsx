import { Button, cn } from '@proteus/ui'
import { Link } from '@tanstack/react-router'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useEffect, useMemo, useRef } from 'react'
import { DataTableUi } from './data-table-ui/data-table-ui'
import { FilterBar } from './data-table-ui/filter-bar'
import { Pagination } from './data-table-ui/pagination'
import { Search } from './data-table-ui/search'
import { SortingMenu } from './data-table-ui/sorting-menu'
import { Toolbar, ToolbarRow, ToolbarSection } from './data-table-ui/toolbar'
import { useColumns } from './hooks/use-columns'
import { useFilters } from './hooks/use-filters'
import { usePagination } from './hooks/use-pagination'
import { useRowNavigation } from './hooks/use-row-navigation'
import { useTableSearch } from './hooks/use-search'
import { useSorting } from './hooks/use-sorting'
import { useUrlState } from './hooks/use-url-state'
import type { DataParams, TableDefinition } from './types'

type ActionConfig = {
  label: string
  to: string
}

type DataTableProps<T> = {
  use: TableDefinition<T>
  heading?: string
  actions?: ActionConfig[]
  className?: string
}

export function DataTable<T>({ use, heading, actions, className }: DataTableProps<T>) {
  const { config, columns, filterDefs } = use

  const urlState = useUrlState({
    prefix: config.prefix,
    filterDefs,
  })

  const search = useTableSearch(urlState)
  const sorting = useSorting(columns, urlState)
  const pageSize = config.pageSize ?? 20

  const filters = useFilters(urlState, filterDefs)

  // Compute params for useData
  const params = useMemo<DataParams>(() => {
    const base: DataParams = {
      offset: urlState.offset,
      limit: pageSize,
    }
    if (urlState.order) base.order = urlState.order
    if (urlState.q) base.q = urlState.q

    // Spread filter values, applying paramMap remapping
    for (const [id, value] of Object.entries(urlState.filters)) {
      const key = config.paramMap?.[id] ?? id
      base[key] = value
    }

    return base
  }, [urlState.offset, urlState.order, urlState.q, urlState.filters, pageSize, config.paramMap])

  // Call useData during render
  const { data, count, isPending, isFetching: isRefetching } = config.useData(params)
  const isFetching = isRefetching ?? isPending

  const pagination = usePagination(urlState, count, pageSize)

  // Determine empty state
  const hasActiveFilters = Object.keys(urlState.filters).length > 0 || !!urlState.q
  const emptyState = hasActiveFilters
    ? (config.filtered ?? { heading: 'No results found', description: 'Try changing your filters or search term.' })
    : (config.empty ?? { heading: 'No data' })

  const containerRef = useRef<HTMLDivElement>(null)
  const handleRowClick = useRowNavigation()

  // biome-ignore lint/correctness/useExhaustiveDependencies: currentPage is an intentional trigger — scroll to top whenever page changes
  useEffect(() => {
    containerRef.current?.scrollTo({ top: 0, left: 0 })
  }, [pagination.currentPage])

  const tanstackColumns = useColumns(columns, config.rowActions)

  const table = useReactTable({
    data,
    columns: tanstackColumns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    getRowId: config.getRowId,
  })

  const hasSecondRow = (actions && actions.length > 0) || filterDefs.length > 0

  return (
    <div className={cn('flex flex-col overflow-hidden rounded-lg border', className)}>
      <Toolbar>
        <ToolbarRow className="px-6">
          <ToolbarSection position="left">
            {!!heading && <h1 className="font-semibold text-lg">{heading}</h1>}
          </ToolbarSection>
          <ToolbarSection position="right">
            {!hasSecondRow && (
              <>
                <Search value={search.value} onChange={search.onChange} isPending={isFetching} />
                <SortingMenu
                  sortableColumns={sorting.sortableColumns}
                  current={sorting.current}
                  setField={sorting.setField}
                  setDirection={sorting.setDirection}
                  isPending={isPending}
                />
              </>
            )}
            {actions &&
              actions.length > 0 &&
              actions.map((action) => (
                <Button key={action.to} variant="outline" size="sm" render={<Link to={action.to} />}>
                  {action.label}
                </Button>
              ))}
          </ToolbarSection>
        </ToolbarRow>

        {!!hasSecondRow && (
          <ToolbarRow className="px-6">
            <ToolbarSection position="left">
              <FilterBar
                filterDefs={filterDefs}
                values={urlState.filters}
                pendingIds={filters.pendingIds}
                activeFilterIds={filters.activeIds}
                onAddFilter={filters.add}
                onSetFilter={filters.commit}
                onRemoveFilter={filters.remove}
                onClearAll={filters.clearAll}
                isPending={isPending}
              />
            </ToolbarSection>
            <ToolbarSection position="right">
              <Search value={search.value} onChange={search.onChange} isPending={isFetching} />
              <SortingMenu
                sortableColumns={sorting.sortableColumns}
                current={sorting.current}
                setField={sorting.setField}
                setDirection={sorting.setDirection}
                isPending={isPending}
              />
            </ToolbarSection>
          </ToolbarRow>
        )}
      </Toolbar>

      <DataTableUi
        table={table}
        isPending={isPending}
        columnCount={tanstackColumns.length}
        rowHref={config.rowHref}
        onRowClick={config.rowHref ? handleRowClick : undefined}
        emptyState={emptyState}
        containerRef={containerRef}
      />

      <Pagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        canPrev={pagination.canPrev}
        canNext={pagination.canNext}
        goNext={pagination.goNext}
        goPrev={pagination.goPrev}
        isPending={isPending}
        offset={pagination.offset}
        limit={pagination.limit}
        count={pagination.count}
      />
    </div>
  )
}
