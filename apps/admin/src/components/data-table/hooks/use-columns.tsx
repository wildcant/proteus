import { Checkbox } from '@proteus/ui'
import type { ColumnDef as TanStackColumnDef } from '@tanstack/react-table'
import { type ReactNode, useMemo } from 'react'
import type { CellValue, ColumnDef } from '../types'
import { getRenderer } from '../utils/configure'

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc != null && typeof acc === 'object') return (acc as Record<string, unknown>)[key]
    return undefined
  }, obj)
}

export function useColumns<T>(columns: ColumnDef<T>[], rowActions?: (row: T) => ReactNode, selectable = false) {
  return useMemo<TanStackColumnDef<T>[]>(() => {
    const cols: TanStackColumnDef<T>[] = columns.map(({ accessorKey, ...col }) => ({
      id: col.id,
      accessorFn: accessorKey ? (row: T) => getNestedValue(row as Record<string, unknown>, accessorKey) : undefined,
      header: col.header,
      size: col.size,
      minSize: col.minSize,
      maxSize: col.maxSize,
      meta: { align: col.align, truncateTooltip: col.truncateTooltip },
      // Cell resolution priority: inline cell fn → named render string → plain text.
      // Order matters — inline always wins so consumers can override global renderers per-column.
      cell: (info) => {
        const value = info.getValue() as CellValue
        const row = info.row.original

        if (col.cell) return col.cell({ value, row })

        if (col.render) {
          const renderer = getRenderer(col.render)
          if (renderer) return renderer({ value })
        }

        if (value == null) return ''
        return String(value)
      },
    }))

    if (selectable) {
      cols.unshift({
        id: '_select',
        size: 40,
        meta: { align: 'center' as const, truncateTooltip: false },
        // Select-all only reaches the current page: with manual pagination the table never
        // holds the rows it has not fetched.
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected()}
            onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked)}
            aria-label="Select all rows on this page"
          />
        ),
        cell: (info) => (
          <Checkbox
            checked={info.row.getIsSelected()}
            onCheckedChange={(checked) => info.row.toggleSelected(checked)}
            aria-label="Select row"
          />
        ),
      })
    }

    if (rowActions) {
      cols.push({
        id: '_actions',
        header: '',
        // Every cell carries `px-6`, so 48 of this is gutter before the 24px trigger gets any.
        // Sized under that, the button is clipped rather than the column merely being snug —
        // which is what happens on a table wide enough that `table-fixed` has no slack to hand out.
        size: 80,
        meta: { align: 'right' as const, truncateTooltip: false },
        cell: (info) => rowActions(info.row.original),
      })
    }

    return cols
  }, [columns, rowActions, selectable])
}
