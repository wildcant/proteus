import { useCallback } from 'react'

type TextCellProps = {
  value: string
  isEditing: boolean
  draftValue: string
  onDraftChange: (value: string) => void
  onCommit: () => void
}

export function TextCell({ value, isEditing, draftValue, onDraftChange, onCommit }: TextCellProps) {
  const inputRef = useCallback((element: HTMLInputElement | null) => {
    if (element) {
      element.focus()
      element.select()
    }
  }, [])

  if (!isEditing) {
    return <span className="block truncate">{value}</span>
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={draftValue}
      onChange={(event) => onDraftChange(event.target.value)}
      onBlur={onCommit}
      className="h-full w-full bg-transparent text-sm outline-none"
    />
  )
}
