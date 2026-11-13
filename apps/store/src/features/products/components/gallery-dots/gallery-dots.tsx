import { useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { GalleryDot } from '#/features/products/components/gallery-dot/gallery-dot'
import { galleryDots, galleryDotsDot } from '#/features/products/components/gallery-dots/gallery-dots.variants'

type GalleryDotsProps = {
  count: number
  activeIndex: number
  onSelect: (index: number) => void
  className?: string
}

/**
 * The carousel's length indicator, and its random access.
 *
 * This is the half of the deleted thumbnail rail that had to survive: the mosaic at `lg:` shows
 * every image at once, so there is nothing to navigate to there — but on the phone the carousel is
 * the whole gallery and nothing else on screen says how many photos exist. The gallery hides it
 * from `lg`.
 */
export function GalleryDots({ count, activeIndex, onSelect, className }: GalleryDotsProps) {
  const { t } = useLingui()

  if (count < 2) return null

  return (
    <ul className={cn(galleryDots(), className)}>
      {Array.from({ length: count }, (_, index) => {
        const position = index + 1
        return (
          // Index is the identity here: the dots are positions, not images.
          // biome-ignore lint/suspicious/noArrayIndexKey: a dot is its position
          <li key={index} className={galleryDotsDot()}>
            <GalleryDot
              current={index === activeIndex}
              onClick={() => onSelect(index)}
              aria-label={t`Show image ${position}`}
            />
          </li>
        )
      })}
    </ul>
  )
}
