import { XIcon } from 'lucide-react'
import { forwardRef, type KeyboardEvent, useState } from 'react'
import { cn } from '#/lib/utils.ts'
import { Badge } from './badge.tsx'

type TagInputProps = Omit<React.ComponentProps<'input'>, 'value' | 'onChange'> & {
  value: string[]
  onChange: (tags: string[]) => void
}

const TagInput = forwardRef<HTMLInputElement, TagInputProps>(({ value, onChange, className, ...props }, ref) => {
  const [pending, setPending] = useState('')

  const addTag = () => {
    const trimmed = pending.trim()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
    }
    setPending('')
  }

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addTag()
    } else if (event.key === 'Backspace' && pending === '' && value.length > 0) {
      const lastTag = value[value.length - 1]
      if (lastTag) removeTag(lastTag)
    }
  }

  return (
    <div
      className={cn(
        'flex min-h-8 w-full flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-1 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
        className,
      )}
    >
      {value.map((tag) => (
        <Badge key={tag} variant="secondary" className="gap-0.5 pr-1">
          {tag}
          <button type="button" onClick={() => removeTag(tag)} className="ml-0.5 rounded-full hover:text-foreground">
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
