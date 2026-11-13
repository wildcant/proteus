import { cn } from '@proteus/ui-core'
import type { ComponentProps } from 'react'
import { galleryDot, galleryDotMark } from '#/features/products/components/gallery-dot/gallery-dot.variants'

/**
 * One position in the carousel. The mark is 8px; the button around it is 44px, because the mark
 * is the affordance's appearance and not its target.
 */
export function GalleryDot({
  current,
  className,
  ...props
}: Omit<ComponentProps<'button'>, 'type'> & { current: boolean }) {
  return (
    <button
      type="button"
      aria-current={current}
      className={cn(galleryDot(), '-outline-offset-2 focus-visible:outline focus-visible:outline-ink', className)}
      {...props}
    >
      <span className={cn(galleryDotMark({ current }), 'transition-colors')} />
    </button>
  )
}
