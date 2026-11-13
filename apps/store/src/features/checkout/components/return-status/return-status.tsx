import { Trans } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import {
  returnStatus,
  returnStatusHint,
  returnStatusTitle,
} from '#/features/checkout/components/return-status/return-status.variants'

/** The bank-redirect landing while the gateway is asked what happened. */
export function ReturnStatus({ title }: { title: string }) {
  return (
    <div className={cn(returnStatus(), 'mx-auto w-full')}>
      <h1 className={returnStatusTitle()}>{title}</h1>
      <p className={returnStatusHint()}>
        <Trans>Do not close this tab.</Trans>
      </p>
    </div>
  )
}
