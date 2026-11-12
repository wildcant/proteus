import { cn } from '@proteus/ui-core'
import { Link } from '@tanstack/react-router'
import { wordmark, wordmarkLabel } from '#/components/store/wordmark/wordmark.variants'

/**
 * The Proteus home link. Every layout that renders chrome renders this, so the wordmark
 * is one treatment rather than three hand-rolled ones.
 *
 * `type-heading` rather than a tracked-out micro-label: the wordmark is display type
 * doing a display job, and the role carries weight, leading and case together. The text is the
 * link's own children, so the label layer's type sits on the link itself.
 */
type WordmarkProps = {
  className?: string
}

export function Wordmark({ className }: WordmarkProps) {
  return (
    <Link to="/" className={cn(wordmark(), wordmarkLabel(), className)}>
      Proteus
    </Link>
  )
}
