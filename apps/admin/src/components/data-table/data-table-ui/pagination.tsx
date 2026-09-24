import { Trans, useLingui } from '@lingui/react/macro'
import { Button } from '@proteus/ui'
import { PaginationSkeleton } from './skeleton'

type PaginationProps = {
  currentPage: number
  totalPages: number | undefined
  canPrev: boolean
  canNext: boolean
  goNext: () => void
  goPrev: () => void
  isPending: boolean
  offset: number
  limit: number
  count: number | undefined
}

export function Pagination({
  currentPage,
  totalPages,
  canPrev,
  canNext,
  goNext,
  goPrev,
  isPending,
  offset,
  limit,
  count,
}: PaginationProps) {
  const { t } = useLingui()
  if (isPending) return <PaginationSkeleton />

  const rangeStart = offset + 1
  const rangeEnd = count != null ? Math.min(offset + limit, count) : offset + limit
  const resultInfo =
    count != null ? t`${rangeStart} \u2014 ${rangeEnd} of ${count} results` : `${rangeStart} \u2014 ${rangeEnd}`

  const page = currentPage + 1
  const pageInfo = totalPages != null ? t`${page} of ${totalPages} pages` : `${page}`

  return (
    <div className="flex items-center justify-between border-t px-6 py-3">
      <span className="text-muted-foreground text-sm">{resultInfo}</span>
      <div className="flex items-center gap-x-2">
        <span className="text-muted-foreground text-sm">{pageInfo}</span>
        <Button variant="outline" size="sm" disabled={!canPrev} onClick={goPrev}>
          <Trans>Prev</Trans>
        </Button>
        <Button variant="outline" size="sm" disabled={!canNext} onClick={goNext}>
          <Trans>Next</Trans>
        </Button>
      </div>
    </div>
  )
}
