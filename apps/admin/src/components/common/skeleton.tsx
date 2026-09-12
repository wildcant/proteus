import { cn, Skeleton } from '@proteus/ui'
import type { CSSProperties } from 'react'

type SkeletonBlockProps = {
  className?: string
  style?: CSSProperties
}

function SkeletonBlock({ className, style }: SkeletonBlockProps) {
  return <Skeleton aria-hidden className={cn('h-3 w-3', className)} style={style} />
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
