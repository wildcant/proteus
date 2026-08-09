import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect } from 'react'
import { z } from 'zod'
import { useVerifyEmail } from '#/features/auth/api/auth'
import { getToken } from '#/lib/auth-token'

const verifySearchSchema = z.object({
  code: z.string().min(1),
})

export const Route = createFileRoute('/verify')({
  validateSearch: verifySearchSchema,
  component: VerifyPage,
  errorComponent: VerifyError,
})

function VerifyError() {
  return (
    <main className="demo-center px-4">
      <div className="demo-panel max-w-sm w-full flex flex-col items-center">
        <h1 className="demo-section-title uppercase mb-2">Invalid verification link</h1>
        <p className="text-center text-sm text-[var(--sea-ink-soft)]">
          The verification link is invalid or has expired. Please request a new verification email.
        </p>
        <Link to="/login" className="demo-button mt-6">
          Back to sign in
        </Link>
      </div>
    </main>
  )
}

function VerifyPage() {
  const { code } = Route.useSearch()
  const { mutate, isPending, isSuccess, isError, error } = useVerifyEmail()

  useEffect(() => {
    mutate({ code })
  }, [code, mutate])

  return (
    <main className="demo-center px-4">
      <div className="demo-panel max-w-sm w-full flex flex-col items-center">
        {isPending && (
          <>
            <h1 className="demo-section-title uppercase mb-2">Verifying</h1>
            <p className="text-center text-sm text-[var(--sea-ink-soft)]">Please wait while we verify your email...</p>
          </>
        )}
        {isSuccess && (
          <>
            <h1 className="demo-section-title uppercase mb-2">Email verified</h1>
            <p className="text-center text-sm text-[var(--sea-ink-soft)]">
              Your email has been verified. You can now log in to your account.
            </p>
            <Link to="/login" className="demo-button mt-6">
              Log in
            </Link>
          </>
        )}
        {isError && (
          <>
            <h1 className="demo-section-title uppercase mb-2">Verification failed</h1>
            <p className="text-center text-sm text-[var(--sea-ink-soft)]">{error.message}</p>
            {!getToken() && (
              <p className="text-center text-xs text-[var(--sea-ink-soft)] mt-2">
                Make sure you open this link in the same browser you used to sign up or log in.
              </p>
            )}
            <Link to="/login" className="demo-button mt-6">
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </main>
  )
}
