import { useNavigate } from '@tanstack/react-router'
import { XIcon } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { SEARCH_PLACEHOLDER } from '#/components/header/constants'
import { SearchControl } from '#/components/header/search-control'

type SearchFormProps = {
  className?: string
  /** For the drawer, where the field is the only reason the panel opened. */
  focusOnMount?: boolean
  value: string
  onChange: (value: string) => void
}

/**
 * The one real search input in the app. Everywhere else that looks like a search field is a
 * `SearchControl` rendered as a button that opens the drawer this lives in.
 *
 * Controlled, because the results below the field read the same term. The panel owns it.
 *
 * Deliberately not FloatingLabelInput: that control is bordered, 56px tall and floats its
 * label into the box. It still needs a real associated label, so one is rendered sr-only.
 */
export function SearchForm({ className, focusOnMount, value, onChange }: SearchFormProps) {
  const navigate = useNavigate()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  // Focused through a ref rather than the autoFocus attribute, which biome's a11y rules
  // reject outright — the distinction it cannot make is that the panel only opened because
  // the shopper asked to search, so landing the cursor anywhere else would be the surprise.
  useEffect(() => {
    if (focusOnMount) inputRef.current?.focus()
  }, [focusOnMount])

  return (
    <SearchControl
      className={className}
      render={
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const trimmed = value.trim()
            // No explicit close: this search carries no `modal`, so landing on it is what
            // shuts the panel. One navigation, not two racing each other.
            navigate({ to: '/products', search: trimmed ? { q: trimmed } : {} })
          }}
        />
      }
    >
      <label htmlFor={inputId} className="sr-only">
        Search products
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="search"
        name="q"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={SEARCH_PLACEHOLDER}
        // 16px on small screens so iOS does not zoom the page on focus. The ring lives on
        // the control, via focus-within, so the input itself carries none.
        //
        // WebKit draws its own clear button on type="search"; ours is the one that keeps focus
        // in the field, so the native one is suppressed rather than left to sit beside it.
        className="h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-muted md:text-sm [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
      />
      {!!value && (
        <button
          type="button"
          aria-label="Clear search"
          // Focus goes back to the field: clearing is something you do mid-search, not the
          // end of one.
          onClick={() => {
            onChange('')
            inputRef.current?.focus()
          }}
          className="shrink-0 text-ink-muted hover:text-ink"
        >
          <XIcon className="size-4" />
        </button>
      )}
    </SearchControl>
  )
}
