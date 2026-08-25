import { cn } from '@proteus/ui'

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
  if (count <= limit) return null

  return (
    <nav
      aria-label="Pagination"
      className={cn('flex items-center justify-center gap-6 text-ink-muted text-sm', className)}
    >
      <button
        type="button"
        // h-11 is the 44px tap target; the pager is thumb-reachable on a phone.
        className="h-11 hover:text-ink disabled:opacity-40"
        disabled={offset === 0}
        onClick={() => onOffsetChange(Math.max(0, offset - limit))}
      >
        Previous
      </button>
      <span>
        {Math.floor(offset / limit) + 1} / {Math.ceil(count / limit)}
      </span>
      <button
        type="button"
        className="h-11 hover:text-ink disabled:opacity-40"
        disabled={offset + limit >= count}
        onClick={() => onOffsetChange(offset + limit)}
      >
        Next
      </button>
    </nav>
  )
}
