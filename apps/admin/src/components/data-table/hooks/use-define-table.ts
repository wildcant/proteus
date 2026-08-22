import { useMemo } from 'react'
import type { ColumnDef, ColumnHelper, FilterHelper, TableConfig, TableDefinition } from '../types'

function createColumnHelper<T>(): ColumnHelper<T> {
  return {
    accessor(key, options) {
      return {
        id: key,
        type: 'accessor',
        accessorKey: key,
        header: options.header,
        sortable: options.sortable,
        render: options.render,
        cell: options.cell as ColumnDef<T>['cell'],
        sortLabel: options.sortLabel,
        sortAscLabel: options.sortAscLabel,
        sortDescLabel: options.sortDescLabel,
        align: options.align,
        size: options.size,
        minSize: options.minSize,
        maxSize: options.maxSize,
        truncateTooltip: options.truncateTooltip,
      }
    },
    display(id, options) {
      return {
        id,
        type: 'display',
        header: options.header,
        cell: ({ value: _, row }) => options.cell({ row }),
        align: options.align,
        size: options.size,
        minSize: options.minSize,
        maxSize: options.maxSize,
      }
    },
  }
}

function createFilterHelper<T>(): FilterHelper<T> {
  return {
    accessor(key, options) {
      return { id: key, ...options }
    },
  }
}

export function useDefineTable<T>(config: TableConfig<T>): TableDefinition<T> {
  const columns = useMemo(() => config.columns(createColumnHelper<T>()), [config.columns])

  const filterDefs = useMemo(() => (config.filters ? config.filters(createFilterHelper<T>()) : []), [config.filters])

  const rowSelection = useMemo(() => config.rowSelection?.(), [config.rowSelection])

  return useMemo(() => ({ config, columns, filterDefs, rowSelection }), [config, columns, filterDefs, rowSelection])
}
