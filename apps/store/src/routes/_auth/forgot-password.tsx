import { Trans, useLingui } from '@lingui/react/macro'
import { toast } from '@proteus/ui-core'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { ButtonLink } from '#/components/ui/button/button'
import { AuthHeading } from '#/features/auth/components/auth-heading/auth-heading'
import { ForgotPasswordForm } from '#/features/auth/components/forgot-password-form/forgot-password-form'
import { flowLinks } from '#/navigation/links'

const links = flowLinks('ForgotPasswordForm')

export const Route = createFileRoute('/_auth/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false)
  const { t } = useLingui()

  if (submitted) {
    return (
      <main className="mt-10 flex w-full max-w-md flex-col items-center">
        <AuthHeading title={t`Check your email`}>
          <Trans>If an account exists with that email, we've sent a link to reset your password.</Trans>
        </AuthHeading>
        <ButtonLink {...links.BACK_TO_SIGN_IN()} variant="outline" size="lg" className="mt-10 w-full">
          <Trans>Back to sign in</Trans>
        </ButtonLink>
      </main>
    )
  }

  return (
    <main className="mt-10 flex w-full max-w-md flex-col items-center">
      <AuthHeading title={t`Forgot your password?`}>
        <Trans>
          No problem. Enter your account email address and we'll send you instructions so you can reset your password.
        </Trans>
      </AuthHeading>
      <div className="mt-10 w-full">
        <ForgotPasswordForm
          onSuccess={() => setSubmitted(true)}
          onError={(error) => toast.add({ type: 'error', title: error })}
        />
      </div>
      <ButtonLink {...links.BACK_TO_SIGN_IN()} variant="link" className="mt-6">
        <Trans>Back to sign in</Trans>
      </ButtonLink>
    </main>
  )
}
