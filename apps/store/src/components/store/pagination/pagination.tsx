import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import {
  pagination,
  paginationNext,
  paginationNextLabel,
  paginationPage,
  paginationPrevious,
  paginationPreviousLabel,
} from '#/components/store/pagination/pagination.variants'

/** The label's own colour turns on its button's hover, so it carries the fade the button's text has. */
const LABEL_FADE = 'transition-[color] ease-[ease]'

type PaginationProps = {
  /** Index of the first item on the current page, as the API reports it. */
  offset: number
  limit: number
  count: number
  onOffsetChange: (offset: number) => void
  className?: string
}

/**
 * Previous / page-of-pages / Next. Offset-based rather than page-based because that is what
 * every list endpoint takes, so no surface has to convert between the two.
 *
 * Renders nothing when everything fits on one page — a pager that can never move is chrome.
 */
export function Pagination({ offset, limit, count, onOffsetChange, className }: PaginationProps) {
  const { t } = useLingui()
  if (count <= limit) return null

  return (
    <nav aria-label={t`Pagination`} className={cn(pagination(), className)}>
      <button
        type="button"
        // h-11 is the 44px tap target; the pager is thumb-reachable on a phone.
        className={paginationPrevious()}
        disabled={offset === 0}
        onClick={() => onOffsetChange(Math.max(0, offset - limit))}
      >
        <span className={cn(paginationPreviousLabel(), LABEL_FADE)}>
          <Trans>Previous</Trans>
        </span>
      </button>
      <span className={paginationPage()}>
        {Math.floor(offset / limit) + 1} / {Math.ceil(count / limit)}
      </span>
      <button
        type="button"
        className={paginationNext()}
        disabled={offset + limit >= count}
        onClick={() => onOffsetChange(offset + limit)}
      >
        <span className={cn(paginationNextLabel(), LABEL_FADE)}>
          <Trans>Next</Trans>
        </span>
      </button>
    </nav>
  )
}
