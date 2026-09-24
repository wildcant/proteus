import { Trans, useLingui } from '@lingui/react/macro'
import { toast } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { ButtonLink } from '#/components/button'
import { AuthHeading } from '#/features/auth/components/auth-heading'
import { ResetPasswordForm } from '#/features/auth/components/reset-password-form'

const searchSchema = z.object({
  token: z.string().min(1),
})

export const Route = createFileRoute('/_auth/reset-password')({
  validateSearch: searchSchema,
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { token } = Route.useSearch()
  const [success, setSuccess] = useState(false)
  const { t } = useLingui()

  if (success) {
    return (
      <main className="mt-10 flex w-full max-w-md flex-col items-center">
        <AuthHeading title={t`Password updated`}>
          <Trans>Your password has been reset. Sign in with your new password to pick up where you left off.</Trans>
        </AuthHeading>
        <ButtonLink to="/login" className="mt-10 h-14 w-full font-semibold text-base">
          <Trans>Sign in</Trans>
        </ButtonLink>
      </main>
    )
  }

  return (
    <main className="mt-10 flex w-full max-w-md flex-col items-center">
      <AuthHeading title={t`Set a new password`}>
        <Trans>Choose a new password for your account.</Trans>
      </AuthHeading>
      <div className="mt-10 w-full">
        <ResetPasswordForm
          token={token}
          onSuccess={() => setSuccess(true)}
          onError={(error) => toast.add({ type: 'error', title: error })}
        />
      </div>
      <ButtonLink variant="link" to="/login" className="mt-6 text-sm">
        <Trans>Back to sign in</Trans>
      </ButtonLink>
    </main>
  )
}
