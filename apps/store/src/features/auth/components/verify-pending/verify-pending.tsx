import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { ButtonLink } from '#/components/ui/button/button'
import { AuthHeading } from '#/features/auth/components/auth-heading/auth-heading'
import {
  verifyPending,
  verifyPendingBackToSignIn,
  verifyPendingHeading,
} from '#/features/auth/components/verify-pending/verify-pending.variants'
import type { LinkTarget } from '#/lib/link-target'

/** Shown after signing up, or signing in to an account that has not confirmed its email yet. */
export function VerifyPending({
  signInLink,
  className,
}: {
  /** BACK_TO_SIGN_IN. */ signInLink: LinkTarget
  className?: string
}) {
  const { t } = useLingui()
  return (
    <div className={cn(verifyPending(), className)}>
      <AuthHeading title={t`Check your email`} className={verifyPendingHeading()}>
        <Trans>
          We sent a verification link to your email. Click it to confirm your account, then come back and sign in.
        </Trans>
      </AuthHeading>
      <ButtonLink {...signInLink} variant="outline" size="lg" className={verifyPendingBackToSignIn()}>
        <Trans>Back to sign in</Trans>
      </ButtonLink>
    </div>
  )
}
