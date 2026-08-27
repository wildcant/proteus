import { cn } from '@proteus/ui'
import { Link } from '@tanstack/react-router'

/**
 * The Proteus home link. Every layout that renders chrome renders this, so the wordmark
 * is one treatment rather than three hand-rolled ones.
 *
 * `type-heading` rather than a tracked-out micro-label: the wordmark is display type
 * doing a display job, and the role carries weight, leading and case together.
 */
type WordmarkProps = {
  className?: string
}

export function Wordmark({ className }: WordmarkProps) {
  return (
    <Link to="/" className={cn('type-heading text-ink no-underline hover:text-ink-muted', className)}>
      Proteus
    </Link>
  )
}
