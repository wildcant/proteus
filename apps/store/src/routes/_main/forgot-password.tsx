import { toast } from '@proteus/ui'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '#/components/button'
import { ForgotPasswordForm } from '#/features/auth/components/forgot-password-form'

export const Route = createFileRoute('/_main/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false)

  return (
    <main className="flex min-h-[calc(100vh-13rem)] items-center justify-center px-4">
      <div className="flex w-full max-w-sm flex-col items-center rounded-lg border border-border p-8">
        {!submitted ? (
          <>
            <h1 className="mb-2 text-sm font-bold uppercase tracking-widest text-foreground">Reset password</h1>
            <p className="mb-6 text-center text-sm text-(--foreground-muted)">
              Enter your email and we'll send you a link to reset your password.
            </p>
            <ForgotPasswordForm
              onSuccess={() => setSubmitted(true)}
              onError={(error) => toast.add({ type: 'error', title: error })}
            />
            <span className="mt-6 text-center text-xs text-(--foreground-muted)">
              Remember your password?{' '}
              <Link to="/login" className="underline">
                Sign in
              </Link>
              .
            </span>
          </>
        ) : (
          <>
            <h1 className="mb-2 text-sm font-bold uppercase tracking-widest text-foreground">Check your email</h1>
            <p className="text-center text-sm text-(--foreground-muted)">
              If an account exists with that email, we've sent a password reset link. Please check your inbox.
            </p>
            <Button variant="outline" render={<Link to="/login" />} className="mt-6">
              Back to sign in
            </Button>
          </>
        )}
      </div>
    </main>
  )
}
