import { cn } from '@proteus/ui-core'
import {
  selectorNotice,
  selectorNoticeMessage,
} from '#/features/checkout/components/selector-notice/selector-notice.variants'

/**
 * A note above the payment list: the wallet could not be read, or the chosen card has gone.
 *
 * `border-l-2 border-l-ink`: the store's notice carries an ink edge the drawing does not have yet.
 */
export function SelectorNotice({ message, className }: { message: string; className?: string }) {
  return (
    <div role="status" className={cn(selectorNotice(), 'border-l-2 border-l-ink', className)}>
      <p className={selectorNoticeMessage()}>{message}</p>
    </div>
  )
}
