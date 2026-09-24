import { Trans, useLingui } from '@lingui/react/macro'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ButtonLink } from '#/components/button'
import { confirmVerification } from '#/features/auth/api/auth'
import { AuthHeading } from '#/features/auth/components/auth-heading'
import { getToken } from '#/lib/auth-token'

const verifySearchSchema = z.object({
  code: z.string().min(1),
})

export const Route = createFileRoute('/_auth/verify')({
  validateSearch: verifySearchSchema,
  // The confirm reads the signup JWT out of localStorage, so it has to run in the browser.
  ssr: false,
  loaderDeps: ({ search }) => ({ code: search.code }),
  // A loader and not an effect because the code is single-use, and `confirmVerification` answers
  // with an outcome rather than throwing so both arms render here. Both reasons are on the
  // function; this page only chooses the words.
  loader: ({ deps }) => confirmVerification(deps.code),
  shouldReload: false,
  component: VerifyPage,
  pendingComponent: VerifyPending,
  errorComponent: VerifyError,
})

function VerifyPending() {
  const { t } = useLingui()
  return (
    <main className="mt-10 flex w-full max-w-md flex-col items-center">
      <AuthHeading title={t`Verifying`}>
        <Trans>Hold on while we confirm your email.</Trans>
      </AuthHeading>
    </main>
  )
}

function VerifyError() {
  const { t } = useLingui()
  return (
    <main className="mt-10 flex w-full max-w-md flex-col items-center">
      <AuthHeading title={t`Invalid link`}>
        <Trans>This verification link is invalid or has expired. Request a new one from your account.</Trans>
      </AuthHeading>
      <ButtonLink variant="outline" to="/login" className="mt-10 h-14 w-full font-semibold text-base">
        <Trans>Back to sign in</Trans>
      </ButtonLink>
    </main>
  )
}

function VerifyPage() {
  const result = Route.useLoaderData()
  const { t } = useLingui()

  if (result.verified) {
    return (
      <main className="mt-10 flex w-full max-w-md flex-col items-center">
        <AuthHeading title={t`Email verified`}>
          <Trans>Your email is confirmed. Sign in to pick up where you left off.</Trans>
        </AuthHeading>
        <ButtonLink to="/login" className="mt-10 h-14 w-full font-semibold text-base">
          <Trans>Sign in</Trans>
        </ButtonLink>
      </main>
    )
  }

  return (
    <main className="mt-10 flex w-full max-w-md flex-col items-center">
      <AuthHeading title={t`Verification failed`}>{result.message ?? t`Verification failed`}</AuthHeading>
      {!getToken() && (
        <p className="mt-3 text-center text-ink-muted text-xs">
          <Trans>Open this link in the same browser you signed up with.</Trans>
        </p>
      )}
      <ButtonLink variant="outline" to="/login" className="mt-10 h-14 w-full font-semibold text-base">
        <Trans>Back to sign in</Trans>
      </ButtonLink>
    </main>
  )
}
