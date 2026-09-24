import { Trans, useLingui } from '@lingui/react/macro'
import { ButtonLink } from '#/components/button'
import { AuthHeading } from '#/features/auth/components/auth-heading'

/** Shown after signing up, or signing in to an account that has not confirmed its email yet. */
export function VerifyPending() {
  const { t } = useLingui()
  return (
    <>
      <AuthHeading title={t`Check your email`}>
        <Trans>
          We sent a verification link to your email. Click it to confirm your account, then come back and sign in.
        </Trans>
      </AuthHeading>
      <ButtonLink variant="outline" to="/login" className="mt-10 h-14 w-full font-semibold text-base">
        <Trans>Back to sign in</Trans>
      </ButtonLink>
    </>
  )
}
