import { Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@proteus/ui'
import type { DataGridColumn } from './types'

type DataGridSkeletonProps<T> = {
  columns: DataGridColumn<T>[]
  rows?: number
}

export function DataGridSkeleton<T>({ columns, rows: rowCount = 10 }: DataGridSkeletonProps<T>) {
  const rows = Array.from({ length: rowCount }, (_, i) => i)

  return (
    <div className="size-full overflow-auto bg-muted">
      <Table className="table-fixed" aria-label="Loading data grid">
        <TableHeader className="txt-compact-small-plus sticky top-0 z-10 bg-muted">
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => (
              <TableHead key={column.accessorKey} className="border-r bg-background font-normal last:border-r-0">
                <Skeleton className="h-3.5 w-24" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((rowIndex) => (
            <TableRow key={rowIndex} className="hover:bg-transparent">
              {columns.map((column) => (
                <TableCell key={column.accessorKey} className="border-r bg-background last:border-r-0">
                  <Skeleton className="h-3.5 w-full max-w-41" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
