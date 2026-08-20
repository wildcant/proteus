import { Checkbox, Input, Label } from '@proteus/ui'
import { useState } from 'react'

type MultiselectFilterProps = {
  options: { label: string; value: string }[]
  value: string[] | undefined
  onChange: (value: string[]) => void
  searchable?: boolean
}

export function MultiselectFilter({ options, value = [], onChange, searchable }: MultiselectFilterProps) {
  const [search, setSearch] = useState('')

  const filtered =
    searchable && search ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase())) : options

  const toggle = (optValue: string) => {
    const next = value.includes(optValue) ? value.filter((v) => v !== optValue) : [...value, optValue]
    onChange(next.length > 0 ? next : [])
  }

  return (
    <div className="flex flex-col gap-1.5">
      {!!searchable && (
        <Input
          type="search"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 text-xs"
        />
      )}
      <div className="flex max-h-48 flex-col gap-0.5 overflow-y-auto">
        {filtered.map((opt) => (
          <Label
            key={opt.value}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
          >
            <Checkbox checked={value.includes(opt.value)} onCheckedChange={() => toggle(opt.value)} />
            {opt.label}
          </Label>
        ))}
      </div>
    </div>
  )
}
