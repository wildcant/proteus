import { cn } from '@proteus/ui-core'
import {
  selectorNotice,
  selectorNoticeBody,
  selectorNoticeMessage,
} from '#/features/checkout/components/selector-notice/selector-notice.variants'

/** A note above the payment list: the wallet could not be read, or the chosen card has gone. */
export function SelectorNotice({ message, className }: { message: string; className?: string }) {
  return (
    <div role="status" className={cn(selectorNotice(), className)}>
      <div className={selectorNoticeBody()}>
        <p className={selectorNoticeMessage()}>{message}</p>
      </div>
    </div>
  )
}
