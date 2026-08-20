import { cn, Input } from '@proteus/ui'
import { LoaderIcon, SearchIcon } from 'lucide-react'

type SearchProps = {
  value: string
  onChange: (value: string) => void
  isPending: boolean
}

export function Search({ value, onChange, isPending }: SearchProps) {
  return (
    <div className="relative">
      {isPending ? (
        <LoaderIcon className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : (
        <SearchIcon className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      )}
      <Input
        type="search"
        placeholder="Search..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn('h-7 w-40 pl-7 text-xs', isPending && 'opacity-70')}
      />
    </div>
  )
}
