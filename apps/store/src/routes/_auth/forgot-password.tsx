import { toast } from '@proteus/ui'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '#/components/button'
import { AuthHeading } from '#/features/auth/components/auth-heading'
import { ForgotPasswordForm } from '#/features/auth/components/forgot-password-form'

export const Route = createFileRoute('/_auth/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false)

  if (submitted) {
    return (
      <main className="mt-10 flex w-full max-w-md flex-col items-center">
        <AuthHeading title="Check your email">
          If an account exists with that email, we've sent a link to reset your password.
        </AuthHeading>
        <Button variant="outline" render={<Link to="/login" />} className="mt-10 h-14 w-full font-semibold text-base">
          Back to sign in
        </Button>
      </main>
    )
  }

  return (
    <main className="mt-10 flex w-full max-w-md flex-col items-center">
      <AuthHeading title="Forgot your password?">
        No problem. Enter your account email address and we'll send you instructions so you can reset your password.
      </AuthHeading>
      <div className="mt-10 w-full">
        <ForgotPasswordForm
          onSuccess={() => setSubmitted(true)}
          onError={(error) => toast.add({ type: 'error', title: error })}
        />
      </div>
      <Button variant="link" render={<Link to="/login" />} className="mt-6 text-sm">
        Back to sign in
      </Button>
    </main>
  )
}
