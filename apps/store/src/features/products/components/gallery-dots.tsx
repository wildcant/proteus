import { cn } from '@proteus/ui'

type GalleryDotsProps = {
  count: number
  activeIndex: number
  onSelect: (index: number) => void
}

/**
 * The carousel's length indicator, and its random access.
 *
 * This is the half of the deleted thumbnail rail that had to survive: the mosaic at `lg:` shows
 * every image at once, so there is nothing to navigate to there — but on the phone the carousel is
 * the whole gallery and nothing else on screen says how many photos exist. Hence `lg:hidden`.
 *
 * The mark is 8px; the button around it is 44px, because the mark is the affordance's appearance
 * and not its target.
 */
export function GalleryDots({ count, activeIndex, onSelect }: GalleryDotsProps) {
  if (count < 2) return null

  return (
    <ul className="flex items-center justify-center lg:hidden">
      {Array.from({ length: count }, (_, index) => (
        // Index is the identity here: the dots are positions, not images.
        // biome-ignore lint/suspicious/noArrayIndexKey: a dot is its position
        <li key={index}>
          <button
            type="button"
            onClick={() => onSelect(index)}
            aria-current={index === activeIndex}
            aria-label={`Show image ${index + 1}`}
            className="flex size-11 items-center justify-center -outline-offset-2 focus-visible:outline focus-visible:outline-ink"
          >
            <span
              className={cn(
                'size-2 rounded-full transition-colors',
                index === activeIndex ? 'bg-ink' : 'bg-ink-disabled',
              )}
            />
          </button>
        </li>
      ))}
    </ul>
  )
}
