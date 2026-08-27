import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'
import { authVerificationConfirm } from '#/api/generated/auth/auth'
import { Button } from '#/components/button'
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
  /**
   * Confirming happens here rather than in an effect because the code is single-use.
   *
   * The router calls a loader once per navigation, outside React's render and effect cycle, so StrictMode's
   * remount cannot fire it twice. The failure is returned rather than thrown so it renders as a verification
   * outcome instead of falling through to errorComponent, which reports a malformed link.
   */
  loader: async ({ deps }) => {
    try {
      await authVerificationConfirm({ code: deps.code })
      return { verified: true as const }
    } catch (error) {
      return { verified: false as const, message: error instanceof Error ? error.message : 'Verification failed' }
    }
  },
  shouldReload: false,
  component: VerifyPage,
  pendingComponent: VerifyPending,
  errorComponent: VerifyError,
})

function VerifyPending() {
  return (
    <main className="mt-10 flex w-full max-w-md flex-col items-center">
      <AuthHeading title="Verifying">Hold on while we confirm your email.</AuthHeading>
    </main>
  )
}

function VerifyError() {
  return (
    <main className="mt-10 flex w-full max-w-md flex-col items-center">
      <AuthHeading title="Invalid link">
        This verification link is invalid or has expired. Request a new one from your account.
      </AuthHeading>
      <Button variant="outline" render={<Link to="/login" />} className="mt-10 h-14 w-full font-semibold text-base">
        Back to sign in
      </Button>
    </main>
  )
}

function VerifyPage() {
  const result = Route.useLoaderData()

  if (result.verified) {
    return (
      <main className="mt-10 flex w-full max-w-md flex-col items-center">
        <AuthHeading title="Email verified">
          Your email is confirmed. Sign in to pick up where you left off.
        </AuthHeading>
        <Button render={<Link to="/login" />} className="mt-10 h-14 w-full font-semibold text-base">
          Sign in
        </Button>
      </main>
    )
  }

  return (
    <main className="mt-10 flex w-full max-w-md flex-col items-center">
      <AuthHeading title="Verification failed">{result.message}</AuthHeading>
      {!getToken() && (
        <p className="mt-3 text-center text-ink-muted text-xs">
          Open this link in the same browser you signed up with.
        </p>
      )}
      <Button variant="outline" render={<Link to="/login" />} className="mt-10 h-14 w-full font-semibold text-base">
        Back to sign in
      </Button>
    </main>
  )
}
