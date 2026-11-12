import { Trans } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { Icon } from '#/components/ui/icon/icon'
import {
  testOnlyNotice,
  testOnlyNoticeIcon,
  testOnlyNoticeInfo,
  testOnlyNoticeMessage,
} from '#/features/checkout/components/test-only-notice/test-only-notice.variants'

/** Shown against a provider that takes no real money, wherever that provider is rendered. */
export function TestOnlyNotice({ className }: { className?: string }) {
  return (
    <span className={cn(testOnlyNotice(), className)}>
      {/* `mt-px` sets the 14px glyph on the 16px line's centre; the set aligns it to the top. */}
      <Icon
        name="info"
        className={cn(testOnlyNoticeIcon(), testOnlyNoticeInfo(), 'mt-px shrink-0')}
        aria-hidden="true"
      />
      <span className={testOnlyNoticeMessage()}>
        <Trans>For testing purposes only. No payment is taken.</Trans>
      </span>
    </span>
  )
}
