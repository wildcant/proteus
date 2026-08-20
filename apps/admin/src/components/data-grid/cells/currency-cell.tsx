import { formatAmount, getCurrencySymbol } from '@proteus/ui'
import { useCallback } from 'react'

type CurrencyCellProps = {
  value: string
  currencyCode: string
  isEditing: boolean
  draftValue: string
  onDraftChange: (value: string) => void
  onCommit: () => void
}

export function CurrencyCell({
  value,
  currencyCode,
  isEditing,
  draftValue,
  onDraftChange,
  onCommit,
}: CurrencyCellProps) {
  const inputRef = useCallback((element: HTMLInputElement | null) => {
    if (element) {
      element.focus()
      element.select()
    }
  }, [])

  const symbol = getCurrencySymbol(currencyCode)

  if (!isEditing) {
    const amount = value ? formatAmount(value, currencyCode) : ''
    return (
      <div className="flex items-center gap-x-2">
        <span className="text-muted-foreground">{symbol}</span>
        <span className="ml-auto tabular-nums">{amount}</span>
      </div>
    )
  }

  return (
    <div className="flex h-full items-center gap-x-2">
      <span className="text-muted-foreground text-sm">{symbol}</span>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={draftValue}
        onChange={(event) => onDraftChange(event.target.value)}
        onBlur={onCommit}
        className="h-full w-full bg-transparent text-right text-sm tabular-nums outline-none"
      />
    </div>
  )
}
