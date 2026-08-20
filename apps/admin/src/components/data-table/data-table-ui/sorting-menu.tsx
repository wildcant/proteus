import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@proteus/ui'
import { ArrowUpDownIcon } from 'lucide-react'
import type { ColumnDef } from '../types'

type SortingMenuProps<T> = {
  sortableColumns: ColumnDef<T>[]
  current: { field: string; desc: boolean } | null
  setField: (field: string) => void
  setDirection: (desc: boolean) => void
  isPending: boolean
}

export function SortingMenu<T>({ sortableColumns, current, setField, setDirection, isPending }: SortingMenuProps<T>) {
  if (isPending || sortableColumns.length === 0) return null

  const currentCol = current ? sortableColumns.find((c) => c.id === current.field) : null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" />}>
        <ArrowUpDownIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={current?.field ?? ''} onValueChange={setField}>
          {sortableColumns.map((col) => (
            <DropdownMenuRadioItem key={col.id} value={col.id}>
              {col.sortLabel ?? col.header}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        {!!current && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={String(current.desc)} onValueChange={(v) => setDirection(v === 'true')}>
              <DropdownMenuRadioItem value="false">{currentCol?.sortAscLabel ?? 'Ascending'}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="true">{currentCol?.sortDescLabel ?? 'Descending'}</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
