import { Checkbox } from '@proteus/ui'

type CheckboxCellProps = {
  checked: boolean
  onToggle: () => void
}

export function CheckboxCell({ checked, onToggle }: CheckboxCellProps) {
  return (
    <div className="flex items-center justify-center">
      <Checkbox checked={checked} onCheckedChange={onToggle} tabIndex={-1} />
    </div>
  )
}
