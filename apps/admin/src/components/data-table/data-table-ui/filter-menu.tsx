import { Trans } from '@lingui/react/macro'
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@proteus/ui'
import type { FilterDef } from '../types'

type FilterMenuProps = {
  filterDefs: FilterDef[]
  activeFilterIds: string[]
  onAdd: (id: string) => void
  isPending: boolean
}

export function FilterMenu({ filterDefs, activeFilterIds, onAdd, isPending }: FilterMenuProps) {
  const available = filterDefs.filter((f) => !activeFilterIds.includes(f.id))
  if (isPending || available.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <Trans>Add filter</Trans>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {available.map((def) => (
          <DropdownMenuItem key={def.id} onClick={() => onAdd(def.id)}>
            {def.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
