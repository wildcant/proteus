import { Card, cn, Skeleton } from '@proteus/ui'
import type { CSSProperties } from 'react'

type SkeletonBlockProps = {
  className?: string
  style?: CSSProperties
}

function SkeletonBlock({ className, style }: SkeletonBlockProps) {
  return <Skeleton aria-hidden className={cn('h-3 w-3', className)} style={style} />
}

type HeadingSkeletonProps = {
  level?: 'h1' | 'h2' | 'h3'
  characters?: number
}

export function HeadingSkeleton({ level = 'h1', characters = 10 }: HeadingSkeletonProps) {
  const charWidth = level === 'h1' ? 11 : level === 'h2' ? 10 : 9

  return (
    <SkeletonBlock
      className={cn({
        'h-7': level === 'h1',
        'h-6': level === 'h2',
        'h-5': level === 'h3',
      })}
      style={{ width: `${charWidth * characters}px` }}
    />
  )
}

type TextSkeletonProps = {
  size?: 'xsmall' | 'small' | 'base' | 'large' | 'xlarge'
  leading?: 'compact' | 'normal'
  characters?: number
}

export function TextSkeleton({ size = 'small', leading = 'compact', characters = 10 }: TextSkeletonProps) {
  const charWidths = { xsmall: 8, small: 9, base: 10, large: 11, xlarge: 13 }

  return (
    <SkeletonBlock
      className={cn({
        'h-5': size === 'xsmall',
        'h-6': size === 'small',
        'h-7': size === 'base',
        'h-8': size === 'xlarge',
        'h-5!': leading === 'compact',
      })}
      style={{ width: `${charWidths[size] * characters}px` }}
    />
  )
}

export function IconButtonSkeleton() {
  return <SkeletonBlock className="h-7 w-7 rounded-md" />
}

export function GeneralSectionSkeleton({ rowCount = 0 }: { rowCount?: number }) {
  return (
    <Card className="gap-0 divide-y py-0" aria-hidden>
      <div className="flex items-center justify-between px-6 py-4">
        <HeadingSkeleton characters={16} />
        <IconButtonSkeleton />
      </div>
      {Array.from({ length: rowCount }, (_, i) => (
        <div key={i} className="grid grid-cols-2 items-center px-6 py-4">
          <TextSkeleton size="small" leading="compact" characters={12} />
          <TextSkeleton size="small" leading="compact" characters={24} />
        </div>
      ))}
    </Card>
  )
}

export function TableFooterSkeleton({ layout }: { layout: 'fill' | 'fit' }) {
  return (
    <div className={cn('flex items-center justify-between p-4', { 'border-t': layout === 'fill' })}>
      <SkeletonBlock className="h-7 w-34.5" />
      <div className="flex items-center gap-x-2">
        <SkeletonBlock className="h-7 w-24" />
        <SkeletonBlock className="h-7 w-11" />
        <SkeletonBlock className="h-7 w-11" />
      </div>
    </div>
  )
}

type TableSkeletonProps = {
  rowCount?: number
  search?: boolean
  filters?: boolean
  orderBy?: boolean
  pagination?: boolean
  layout?: 'fit' | 'fill'
}

export function TableSkeleton({
  rowCount = 10,
  search = true,
  filters = true,
  orderBy = true,
  pagination = true,
  layout = 'fit',
}: TableSkeletonProps) {
  const totalRowCount = rowCount + 1
  const hasToolbar = search || filters || orderBy

  return (
    <div aria-hidden className={cn({ 'flex h-full flex-col overflow-hidden': layout === 'fill' })}>
      {!!hasToolbar && (
        <div className="flex items-center justify-between px-6 py-4">
          {!!filters && <SkeletonBlock className="h-7 w-full max-w-33.75" />}
          {!!(search || orderBy) && (
            <div className="flex items-center gap-x-2">
              {!!search && <SkeletonBlock className="h-7 w-40" />}
              {!!orderBy && <SkeletonBlock className="h-7 w-7" />}
            </div>
          )}
        </div>
      )}
      <div className="flex flex-col divide-y border-y">
        {Array.from({ length: totalRowCount }, (_, i) => (
          <SkeletonBlock key={i} className="h-10 w-full rounded-none" />
        ))}
      </div>
      {!!pagination && <TableFooterSkeleton layout={layout} />}
    </div>
  )
}

export function TableSectionSkeleton(props: TableSkeletonProps) {
  return (
    <Card className="gap-0 divide-y py-0" aria-hidden>
      <div className="flex items-center justify-between px-6 py-4">
        <HeadingSkeleton level="h2" characters={16} />
        <IconButtonSkeleton />
      </div>
      <TableSkeleton {...props} />
    </Card>
  )
}

export function JsonViewSectionSkeleton() {
  return (
    <Card className="gap-0 divide-y py-0" aria-hidden>
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-x-4">
          <HeadingSkeleton level="h2" characters={16} />
          <SkeletonBlock className="h-5 w-12 rounded-md" />
        </div>
        <IconButtonSkeleton />
      </div>
    </Card>
  )
}

export function SingleColumnPageSkeleton({
  sections = 2,
  showJSON = false,
  showMetadata = false,
}: {
  sections?: number
  showJSON?: boolean
  showMetadata?: boolean
}) {
  return (
    <div className="flex flex-col gap-y-3">
      {Array.from({ length: sections }, (_, i) => (
        <SkeletonBlock key={i} className={cn('w-full rounded-lg', i === 0 ? 'h-54.75' : 'h-115')} />
      ))}
      {!!showMetadata && <SkeletonBlock className="h-15 w-full rounded-lg" />}
      {!!showJSON && <SkeletonBlock className="h-15 w-full rounded-lg" />}
    </div>
  )
}

export function TwoColumnPageSkeleton({
  mainSections = 2,
  sidebarSections = 1,
  showJSON = false,
  showMetadata = false,
}: {
  mainSections?: number
  sidebarSections?: number
  showJSON?: boolean
  showMetadata?: boolean
}) {
  const showExtraData = showJSON || showMetadata

  return (
    <div className="flex flex-col gap-y-3">
      <div className="flex flex-col gap-x-4 gap-y-3 xl:flex-row xl:items-start">
        <div className="flex w-full flex-col gap-y-3">
          {Array.from({ length: mainSections }, (_, i) => (
            <SkeletonBlock key={i} className={cn('w-full rounded-lg', i === 0 ? 'h-54.75' : 'h-115')} />
          ))}
          {!!showExtraData && (
            <div className="hidden flex-col gap-y-3 xl:flex">
              {!!showMetadata && <SkeletonBlock className="h-15 w-full rounded-lg" />}
              {!!showJSON && <SkeletonBlock className="h-15 w-full rounded-lg" />}
            </div>
          )}
        </div>
        <div className="flex w-full max-w-full flex-col gap-y-3 xl:mt-0 xl:max-w-110">
          {Array.from({ length: sidebarSections }, (_, i) => (
            <SkeletonBlock key={i} className={cn('w-full rounded-lg', i === 0 ? 'h-35' : 'h-80')} />
          ))}
          {!!showExtraData && (
            <div className="flex flex-col gap-y-3 xl:hidden">
              {!!showMetadata && <SkeletonBlock className="h-15 w-full rounded-lg" />}
              {!!showJSON && <SkeletonBlock className="h-15 w-full rounded-lg" />}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
