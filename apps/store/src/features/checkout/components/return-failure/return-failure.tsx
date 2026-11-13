import { Trans } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { ButtonLink } from '#/components/ui/button/button'
import {
  returnFailure,
  returnFailureBack,
  returnFailureIntro,
  returnFailureMessage,
  returnFailureTitle,
} from '#/features/checkout/components/return-failure/return-failure.variants'
import type { LinkTarget } from '#/lib/link-target'

/** The bank-redirect landing when the order could not be picked back up. */
export function ReturnFailure({
  message,
  checkoutLink,
}: {
  message: string
  /** BACK_TO_CHECKOUT. */
  checkoutLink: LinkTarget
}) {
  return (
    <div className={cn(returnFailure(), 'mx-auto w-full')}>
      <div className={returnFailureIntro()}>
        <h1 className={returnFailureTitle()}>
          <Trans>Your payment did not finish</Trans>
        </h1>
        <p role="alert" className={returnFailureMessage()}>
          {message}
        </p>
      </div>
      <ButtonLink {...checkoutLink} variant="outline" className={returnFailureBack()}>
        <Trans>Back to checkout</Trans>
      </ButtonLink>
    </div>
  )
}
