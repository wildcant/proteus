import { useNavigate } from '@tanstack/react-router'
import { useEffect, useId, useRef, useState } from 'react'
import { SEARCH_PLACEHOLDER } from '#/components/header/constants'
import { SearchControl } from '#/components/header/search-control'

type SearchFormProps = {
  className?: string
  /** For the drawer, where the field is the only reason the panel opened. */
  focusOnMount?: boolean
}

/**
 * The one real search input in the app. Everywhere else that looks like a search field is
 * a `SearchControl` rendered as a button that opens the drawer this lives in.
 *
 * Deliberately not FloatingLabelInput: that control is bordered, 56px tall and floats its
 * label into the box. It still needs a real associated label, so one is rendered sr-only.
 */
export function SearchForm({ className, focusOnMount }: SearchFormProps) {
  const navigate = useNavigate()
  const inputId = useId()
  const [term, setTerm] = useState('')
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
            const trimmed = term.trim()
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
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder={SEARCH_PLACEHOLDER}
        // 16px on small screens so iOS does not zoom the page on focus. The ring lives on
        // the control, via focus-within, so the input itself carries none.
        className="h-full w-full bg-transparent text-base text-ink outline-none placeholder:text-ink-muted md:text-sm"
      />
    </SearchControl>
  )
}
