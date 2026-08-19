import { cn, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@proteus/ui'
import type { Table as ReactTable } from '@tanstack/react-table'
import { flexRender } from '@tanstack/react-table'
import type { RefObject } from 'react'
import { EmptyState } from './empty-state'
import { TableSkeleton } from './skeleton'
import { TruncatedCell } from './truncated-cell'

type DataTableUiProps<T> = {
  table: ReactTable<T>
  isPending: boolean
  columnCount: number
  rowHref?: (row: T) => string
  onRowClick?: (event: React.MouseEvent, href: string) => void
  emptyState?: { heading: string; description?: string }
  containerRef: RefObject<HTMLDivElement | null>
}

function alignClass(align?: 'left' | 'center' | 'right') {
  if (align === 'center') return 'text-center'
  if (align === 'right') return 'text-right'
  return 'text-left'
}

export function DataTableUi<T>({
  table,
  isPending,
  columnCount,
  rowHref,
  onRowClick,
  emptyState,
  containerRef,
}: DataTableUiProps<T>) {
  if (isPending) {
    return <TableSkeleton columnCount={columnCount} />
  }

  return (
    <div ref={containerRef} className="overflow-auto">
      {/* table-fixed so column size/minSize/maxSize are respected — without it the
          browser's auto-sizing algorithm ignores configured widths */}
      <Table className="table-fixed">
        <TableHeader className="sticky top-0 z-1 bg-muted/50">
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => (
                <TableHead
                  key={header.id}
                  style={{ width: header.getSize() }}
                  className={alignClass(header.column.columnDef.meta?.align)}
                >
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length > 0 ? (
            table.getRowModel().rows.map((row) => {
              const href = rowHref?.(row.original)
              return (
                <TableRow
                  key={row.id}
                  className={cn(href && 'cursor-pointer')}
                  onClick={href && onRowClick ? (e) => onRowClick(e, href) : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={alignClass(cell.column.columnDef.meta?.align)}>
                      <TruncatedCell disabled={cell.column.columnDef.meta?.truncateTooltip === false}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TruncatedCell>
                    </TableCell>
                  ))}
                </TableRow>
              )
            })
          ) : (
            <TableRow>
              <TableCell colSpan={table.getAllColumns().length} className="h-24">
                {!!emptyState && <EmptyState {...emptyState} />}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
