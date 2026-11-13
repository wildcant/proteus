import { useLingui } from '@lingui/react/macro'
import { useNavigate } from '@tanstack/react-router'
import { SEARCH_PLACEHOLDER } from '#/components/header/constants'
import { SearchControl } from '#/components/store/search-control/search-control'
import { searchControlPlaceholder } from '#/components/store/search-control/search-control.variants'
import { Button } from '#/components/ui/button/button'
import { Icon } from '#/components/ui/icon/icon'
import type { LinkTarget } from '#/lib/link-target'

/**
 * The two ways into the search panel. Both live here so the pair stays in view together:
 * they are one affordance that changes shape at `lg`, not two independent controls, and
 * splitting them across files is how they drift apart.
 *
 * Each opens the panel itself rather than taking an `onClick`. The panel is URL state, so
 * "open it" is the same navigation from anywhere, the one the route hands down.
 */

/** Above `lg`: a button wearing the field's clothes. The real input is in the panel. */
type SearchBarTriggerProps = {
  /** OPEN_SEARCH, from the route. */
  openLink: LinkTarget
  className?: string
}

export function SearchBarTrigger({ openLink, className }: SearchBarTriggerProps) {
  const { t } = useLingui()
  const navigate = useNavigate()

  return (
    <SearchControl
      className={className}
      aria-label={t`Search products`}
      render={<button type="button" onClick={() => navigate(openLink)} />}
    >
      <span className={searchControlPlaceholder()}>{t(SEARCH_PLACEHOLDER)}</span>
    </SearchControl>
  )
}

/** Below `lg`, where a 280px control has nowhere to sit and the icon stands in for it. */
type SearchIconTriggerProps = {
  /** OPEN_SEARCH, from the route. */
  openLink: LinkTarget
  className?: string
}

export function SearchIconTrigger({ openLink, className }: SearchIconTriggerProps) {
  const { t } = useLingui()
  const navigate = useNavigate()

  return (
    <Button variant="ghost" size="icon" aria-label={t`Search`} className={className} onClick={() => navigate(openLink)}>
      <Icon name="search" className="h-5 w-5" />
    </Button>
  )
}
