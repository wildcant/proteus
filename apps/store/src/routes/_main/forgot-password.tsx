import { toast } from '@proteus/ui'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ForgotPasswordForm } from '#/features/auth/components/forgot-password-form'

export const Route = createFileRoute('/_main/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false)

  return (
    <main className="demo-center px-4">
      <div className="demo-panel max-w-sm w-full flex flex-col items-center">
        {!submitted ? (
          <>
            <h1 className="demo-section-title uppercase mb-2">Reset password</h1>
            <p className="mb-6 text-center text-sm text-[var(--sea-ink-soft)]">
              Enter your email and we'll send you a link to reset your password.
            </p>
            <ForgotPasswordForm
              onSuccess={() => setSubmitted(true)}
              onError={(error) => toast.add({ type: 'error', title: error })}
            />
            <span className="mt-6 text-center text-xs text-[var(--sea-ink-soft)]">
              Remember your password?{' '}
              <Link to="/login" className="underline">
                Sign in
              </Link>
              .
            </span>
          </>
        ) : (
          <>
            <h1 className="demo-section-title uppercase mb-2">Check your email</h1>
            <p className="text-center text-sm text-[var(--sea-ink-soft)]">
              If an account exists with that email, we've sent a password reset link. Please check your inbox.
            </p>
            <Link to="/login" className="demo-button mt-6">
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </main>
  )
}
