import { XIcon } from 'lucide-react'
import { forwardRef, type KeyboardEvent, useState } from 'react'
import { cn } from '#/lib/utils.ts'
import { Badge } from './badge.tsx'

export type TagInputItem = { id: string; label: string }

type TagInputProps = Omit<React.ComponentProps<'input'>, 'value' | 'onChange'> & {
  value: TagInputItem[]
  onChange: (items: TagInputItem[]) => void
}

const TagInput = forwardRef<HTMLInputElement, TagInputProps>(({ value, onChange, className, ...props }, ref) => {
  const [pending, setPending] = useState('')

  const addTag = () => {
    const trimmed = pending.trim()
    if (trimmed && !value.some((item) => item.id === trimmed)) {
      onChange([...value, { id: trimmed, label: trimmed }])
    }
    setPending('')
  }

  const removeTag = (id: string) => {
    onChange(value.filter((item) => item.id !== id))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addTag()
    } else if (event.key === 'Backspace' && pending === '' && value.length > 0) {
      const lastItem = value[value.length - 1]
      if (lastItem) removeTag(lastItem.id)
    }
  }

  return (
    <div
      className={cn(
        'flex min-h-8 w-full flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-1 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
        className,
      )}
    >
      {value.map((item) => (
        <Badge key={item.id} variant="secondary" className="gap-0.5 pr-1">
          {item.label}
          <button
            type="button"
            onClick={() => removeTag(item.id)}
            className="ml-0.5 rounded-full hover:text-foreground"
          >
            <XIcon className="size-3" />
          </button>
        </Badge>
      ))}
      <input
        ref={ref}
        value={pending}
        onChange={(event) => setPending(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addTag}
        className="min-w-[80px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        {...props}
      />
    </div>
  )
})

TagInput.displayName = 'TagInput'

export { TagInput }
