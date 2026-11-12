import { useLingui } from '@lingui/react/macro'
import { SEARCH_PLACEHOLDER } from '#/components/header/constants'
import { SearchControl } from '#/components/store/search-control/search-control'
import { searchControlPlaceholder } from '#/components/store/search-control/search-control.variants'
import { Button } from '#/components/ui/button/button'
import { Icon } from '#/components/ui/icon/icon'
import { useModal } from '#/lib/modal-state'

/**
 * The two ways into the search panel. Both live here so the pair stays in view together:
 * they are one affordance that changes shape at `lg`, not two independent controls, and
 * splitting them across files is how they drift apart.
 *
 * Each opens the panel itself rather than taking an `onClick`. The panel is URL state, so
 * "open it" is the same call from anywhere and there is nothing for a parent to coordinate.
 */

/** Above `lg`: a button wearing the field's clothes. The real input is in the panel. */
type SearchBarTriggerProps = {
  className?: string
}

export function SearchBarTrigger({ className }: SearchBarTriggerProps) {
  const { t } = useLingui()
  const { setOpen } = useModal('search')

  return (
    <SearchControl
      className={className}
      aria-label={t`Search products`}
      render={<button type="button" onClick={() => setOpen(true)} />}
    >
      <span className={searchControlPlaceholder()}>{t(SEARCH_PLACEHOLDER)}</span>
    </SearchControl>
  )
}

/** Below `lg`, where a 280px control has nowhere to sit and the icon stands in for it. */
type SearchIconTriggerProps = {
  className?: string
}

export function SearchIconTrigger({ className }: SearchIconTriggerProps) {
  const { t } = useLingui()
  const { setOpen } = useModal('search')

  return (
    <Button variant="ghost" size="icon" aria-label={t`Search`} className={className} onClick={() => setOpen(true)}>
      <Icon name="search" className="h-5 w-5" />
    </Button>
  )
}
