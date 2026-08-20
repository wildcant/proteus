import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect } from 'react'
import { z } from 'zod'
import { Button } from '#/components/button'
import { useVerifyEmail } from '#/features/auth/api/auth'
import { getToken } from '#/lib/auth-token'

const verifySearchSchema = z.object({
  code: z.string().min(1),
})

export const Route = createFileRoute('/_main/verify')({
  validateSearch: verifySearchSchema,
  component: VerifyPage,
  errorComponent: VerifyError,
})

function VerifyError() {
  return (
    <main className="flex min-h-[calc(100vh-13rem)] items-center justify-center px-4">
      <div className="flex w-full max-w-sm flex-col items-center rounded-lg border border-border p-8">
        <h1 className="mb-2 font-bold text-foreground text-sm uppercase tracking-widest">Invalid verification link</h1>
        <p className="text-center text-foreground-muted text-sm">
          The verification link is invalid or has expired. Please request a new verification email.
        </p>
        <Button variant="outline" render={<Link to="/login" />} className="mt-6">
          Back to sign in
        </Button>
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
    <main className="flex min-h-[calc(100vh-13rem)] items-center justify-center px-4">
      <div className="flex w-full max-w-sm flex-col items-center rounded-lg border border-border p-8">
        {!!isPending && (
          <>
            <h1 className="mb-2 font-bold text-foreground text-sm uppercase tracking-widest">Verifying</h1>
            <p className="text-center text-foreground-muted text-sm">Please wait while we verify your email...</p>
          </>
        )}
        {!!isSuccess && (
          <>
            <h1 className="mb-2 font-bold text-foreground text-sm uppercase tracking-widest">Email verified</h1>
            <p className="text-center text-foreground-muted text-sm">
              Your email has been verified. You can now log in to your account.
            </p>
            <Button variant="outline" render={<Link to="/login" />} className="mt-6">
              Log in
            </Button>
          </>
        )}
        {!!isError && (
          <>
            <h1 className="mb-2 font-bold text-foreground text-sm uppercase tracking-widest">Verification failed</h1>
            <p className="text-center text-foreground-muted text-sm">{error.message}</p>
            {!getToken() && (
              <p className="mt-2 text-center text-foreground-muted text-xs">
                Make sure you open this link in the same browser you used to sign up or log in.
              </p>
            )}
            <Button variant="outline" render={<Link to="/login" />} className="mt-6">
              Back to sign in
            </Button>
          </>
        )}
      </div>
    </main>
  )
}
