import { Button, Input, Label } from '@proteus/ui'

type DateValue = { $gte?: string; $lte?: string }

type DateFilterProps = {
  value: DateValue | undefined
  onChange: (value: DateValue) => void
  presets?: { label: string; value: DateValue }[]
}

export function DateFilter({ value, onChange, presets }: DateFilterProps) {
  const toDateInput = (iso: string | undefined | Date) => {
    if (!iso) return ''
    if (iso instanceof Date) {
      return iso.toISOString().slice(0, 10)
    }
    return iso.slice(0, 10)
  }

  const fromDateInput = (dateStr: string) => {
    if (!dateStr) return undefined
    return new Date(dateStr).toISOString()
  }

  return (
    <div className="flex flex-col gap-2">
      {!!presets && presets.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {presets.map((preset) => (
            <Button
              key={preset.label}
              variant="ghost"
              size="sm"
              className="justify-start"
              onClick={() => onChange(preset.value)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-3">
        <Label className="flex flex-col gap-1 text-xs text-muted-foreground">
          From
          <Input
            type="date"
            value={toDateInput(value?.$gte)}
            onChange={(e) => onChange({ ...value, $gte: fromDateInput(e.target.value) })}
            className="h-7 text-xs"
          />
        </Label>
        <Label className="flex flex-col gap-1 text-xs text-muted-foreground">
          To
          <Input
            type="date"
            value={toDateInput(value?.$lte)}
            onChange={(e) => onChange({ ...value, $lte: fromDateInput(e.target.value) })}
            className="h-7 text-xs"
          />
        </Label>
      </div>
    </div>
  )
}
