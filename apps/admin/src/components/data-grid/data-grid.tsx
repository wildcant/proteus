import { cn, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@proteus/ui'
import { useCallback, useRef } from 'react'
import { CheckboxCell } from './cells/checkbox-cell'
import { CurrencyCell } from './cells/currency-cell'
import { TextCell } from './cells/text-cell'
import { DataGridSkeleton } from './data-grid-skeleton'
import type { DataGridColumn } from './types'
import { useGridNavigation } from './use-grid-navigation'

type DataGridProps<T> = {
  data: T[]
  columns: DataGridColumn<T>[]
  onChange: (data: T[]) => void
  onEditingChange?: (isEditing: boolean) => void
  isLoading?: boolean
  className?: string
}

export function DataGrid<T>({ data, columns, onChange, onEditingChange, isLoading, className }: DataGridProps<T>) {
  const {
    focused,
    editing,
    draftValue,
    setDraftValue,
    handleCellClick,
    handleCellDoubleClick,
    handleKeyDown,
    commitEdit,
  } = useGridNavigation({ data, columns, onChange, onEditingChange })

  const focusedRef = useRef(focused)
  focusedRef.current = focused
  const editingRef = useRef(editing)
  editingRef.current = editing

  const cellRefCallback = useCallback(
    (rowIndex: number, colIndex: number) => (element: HTMLTableCellElement | null) => {
      if (!element) return
      const current = focusedRef.current
      const currentEditing = editingRef.current
      // Skip td focus when editing — let the input inside the cell take focus
      if (currentEditing?.row === rowIndex && currentEditing?.col === colIndex) return
      if (current?.row === rowIndex && current?.col === colIndex) {
        element.focus()
      }
    },
    [],
  )

  if (isLoading) {
    return <DataGridSkeleton columns={columns} rows={data.length > 0 ? data.length : 10} />
  }

  return (
    <div className={cn('size-full overflow-auto bg-muted', className)}>
      <Table className="w-auto table-fixed" role="grid" aria-label="Editable data grid" onKeyDown={handleKeyDown}>
        <TableHeader className="txt-compact-small-plus sticky top-0 z-10 bg-muted">
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => (
              <TableHead key={column.accessorKey} className="w-37.5 border-r bg-background font-normal last:border-r-0">
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, rowIndex) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: row identity is positional in a controlled data array
            <TableRow key={rowIndex} className="hover:bg-transparent">
              {columns.map((column, colIndex) => {
                const isFocused = focused?.row === rowIndex && focused?.col === colIndex
                const isEditing = editing?.row === rowIndex && editing?.col === colIndex

                return (
                  <TableCell
                    key={column.accessorKey}
                    ref={cellRefCallback(rowIndex, colIndex)}
                    tabIndex={isFocused ? 0 : -1}
                    onClick={() => handleCellClick(rowIndex, colIndex)}
                    onDoubleClick={() => handleCellDoubleClick(rowIndex, colIndex)}
                    className={cn(
                      'cursor-default select-none border-r bg-background last:border-r-0',
                      (isFocused || isEditing) && 'ring-2 ring-blue-400 ring-inset',
                    )}
                    role="gridcell"
                  >
                    <CellRenderer
                      column={column}
                      row={row}
                      isEditing={isEditing}
                      draftValue={draftValue}
                      onDraftChange={setDraftValue}
                      onCommit={commitEdit}
                      onToggle={() => handleCellClick(rowIndex, colIndex)}
                    />
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

type CellRendererProps<T> = {
  column: DataGridColumn<T>
  row: T
  isEditing: boolean
  draftValue: string
  onDraftChange: (value: string) => void
  onCommit: () => void
  onToggle: () => void
}

function CellRenderer<T>({
  column,
  row,
  isEditing,
  draftValue,
  onDraftChange,
  onCommit,
  onToggle,
}: CellRendererProps<T>) {
  const rawValue = row[column.accessorKey]

  switch (column.type) {
    case 'text':
      return (
        <TextCell
          value={String(rawValue ?? '')}
          isEditing={isEditing}
          draftValue={draftValue}
          onDraftChange={onDraftChange}
          onCommit={onCommit}
        />
      )
    case 'checkbox':
      return <CheckboxCell checked={Boolean(rawValue)} onToggle={onToggle} />
    case 'currency':
      return (
        <CurrencyCell
          value={String(rawValue ?? '')}
          currencyCode={column.currencyCode}
          isEditing={isEditing}
          draftValue={draftValue}
          onDraftChange={onDraftChange}
          onCommit={onCommit}
        />
      )
  }
}
