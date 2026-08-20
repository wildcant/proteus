import { useMemo } from 'react'
import type { UrlState } from './use-url-state'

export function usePagination(urlState: UrlState, count: number | undefined, pageSize: number) {
  return useMemo(() => {
    const currentPage = Math.floor(urlState.offset / pageSize)
    const totalPages = count != null ? Math.ceil(count / pageSize) : undefined
    const canPrev = currentPage > 0
    const canNext = totalPages != null ? currentPage < totalPages - 1 : false

    return {
      currentPage,
      totalPages,
      canPrev,
      canNext,
      goNext: () => urlState.setOffset((currentPage + 1) * pageSize),
      goPrev: () => urlState.setOffset(Math.max(0, (currentPage - 1) * pageSize)),
      offset: urlState.offset,
      limit: pageSize,
      count,
    }
  }, [urlState, count, pageSize])
}
